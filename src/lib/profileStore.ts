/**
 * ProfileStore — Local-first profile data layer
 *
 * Architecture:
 *   localStorage is the PRIMARY write-through store.
 *   The Aptos indexer is a BACKGROUND revalidation channel.
 *   Users never wait for the indexer.
 *
 * This module replaces all scattered localStorage cache logic,
 * local registry logic, and indexer query/retry logic that was
 * previously spread across AuthContext, DirectoryPage, and
 * UserProfilePage.
 */

import type { UserProfile } from "../contexts/AuthContext";

// ——— Constants ———
const STORE_KEY = "circle_profiles"; // Map<normalizedAddress, UserProfile>
const INDEXER_URL = "https://api.testnet.aptoslabs.com/v1/graphql";
// Fullnode REST API — authoritative, zero propagation delay vs the indexer
const FULLNODE_REST = "https://fullnode.testnet.aptoslabs.com/v1";

// ——— Address Normalization ———
export function normalizeAddress(addr: string): string {
  let hex = addr.toLowerCase().trim();
  if (hex.startsWith("0x")) hex = hex.slice(2);
  return "0x" + hex.padStart(64, "0");
}

// ——— Internal Helpers ———

function readStore(): Record<string, UserProfile> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, UserProfile>): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // localStorage full or unavailable — non-fatal
  }
}

// ——— Public API ———

/**
 * Write a profile to the local store.
 * Called on: registration, profile edit, indexer revalidation.
 */
export function putProfile(profile: UserProfile): void {
  const key = normalizeAddress(profile.walletAddress);
  const store = readStore();
  // Merge: preserve existing collectionId if the incoming one is empty
  const existing = store[key];
  store[key] = {
    ...existing,
    ...profile,
    walletAddress: key,
    collectionId: profile.collectionId || existing?.collectionId || "",
  };
  writeStore(store);
}

/**
 * Read a profile from the local store. Instant, zero network calls.
 * Called on: login, profile page view.
 */
export function getProfile(walletAddress: string): UserProfile | null {
  const key = normalizeAddress(walletAddress);
  const store = readStore();
  return store[key] ?? null;
}

/**
 * Search profiles by username or fullName (case-insensitive substring).
 * Returns all matches. Instant, zero network calls.
 * Called on: directory search.
 */
export function searchProfiles(term: string): UserProfile[] {
  const lower = term.toLowerCase();
  const store = readStore();
  return Object.values(store).filter(
    (p) =>
      p.username?.toLowerCase().includes(lower) ||
      p.fullName?.toLowerCase().includes(lower)
  );
}

/**
 * Get all locally known profiles.
 */
export function getAllProfiles(): UserProfile[] {
  return Object.values(readStore());
}

// ——— Indexer Communication (Background Only) ———

const PROFILE_QUERY = `
  query GetProfile($creatorAddress: String, $collectionName: String) {
    current_collections_v2(
      where: {
        creator_address: {_eq: $creatorAddress},
        collection_name: {_eq: $collectionName}
      }
      limit: 1
    ) {
      collection_id
      creator_address
      description
      uri
    }
  }
`;

const ALL_PROFILES_QUERY = `
  query GetAllProfiles($collectionName: String) {
    current_collections_v2(
      where: {collection_name: {_eq: $collectionName}}
      order_by: {creator_address: asc}
      limit: 500
    ) {
      collection_id
      creator_address
      description
      uri
    }
  }
`;

function parseCollectionToProfile(
  collection: any
): UserProfile | null {
  const walletAddress = normalizeAddress(collection.creator_address);
  try {
    const data = JSON.parse(collection.description || "{}");
    return {
      ...data,
      walletAddress,
      collectionId: collection.collection_id,
      profilePictureUrl:
        data.profilePictureUrl ||
        (collection.uri !== "https://circle.storage/profile"
          ? collection.uri
          : ""),
    };
  } catch {
    return {
      username: collection.description || "Unknown",
      fullName: "Unknown",
      walletAddress,
      collectionId: collection.collection_id,
      profilePictureUrl:
        collection.uri !== "https://circle.storage/profile"
          ? collection.uri
          : "",
      createdAt: Date.now(),
    };
  }
}

/**
 * Background revalidation: fetch ONE profile from the indexer and
 * merge into the local store. Non-blocking, fire-and-forget safe.
 * Returns the profile if found, null otherwise.
 */
export async function revalidateFromIndexer(
  walletAddress: string
): Promise<UserProfile | null> {
  const normalized = normalizeAddress(walletAddress);
  try {
    const res = await fetch(INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: PROFILE_QUERY,
        variables: {
          creatorAddress: normalized,
          collectionName: "CircleProfile",
        },
      }),
    });
    const resData = await res.json();
    const collection = resData.data?.current_collections_v2?.[0];
    if (!collection) return null;

    const profile = parseCollectionToProfile(collection);
    if (profile) {
      putProfile(profile);
    }
    return profile;
  } catch (err) {
    console.error("ProfileStore: revalidation failed for", normalized, err);
    return null;
  }
}

/**
 * Background bulk sync: fetch ALL CircleProfile collections from
 * the indexer and merge into the local store. Called once on
 * DirectoryPage mount to enrich the local store for search.
 */
export async function syncAllFromIndexer(): Promise<void> {
  try {
    const res = await fetch(INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: ALL_PROFILES_QUERY,
        variables: { collectionName: "CircleProfile" },
      }),
    });
    const resData = await res.json();
    const collections = resData.data?.current_collections_v2 || [];

    for (const collection of collections) {
      const profile = parseCollectionToProfile(collection);
      if (profile) {
        putProfile(profile);
      }
    }
  } catch (err) {
    console.error("ProfileStore: bulk sync failed", err);
  }
}

// ——— Retry-Capable Revalidation ———

/**
 * Retry indexer revalidation with exponential backoff.
 * Used when localStorage is empty (fresh browser) and we need to wait
 * for the indexer to catch up with the on-chain state.
 *
 * @param onPhase  Optional callback fired when the retry phase changes.
 *                 The UI can use this to display progress (e.g. "Attempt 2/3…").
 */
export async function revalidateWithRetry(
  walletAddress: string,
  maxRetries = 3,
  onPhase?: (attempt: number, maxAttempts: number) => void
): Promise<UserProfile | null> {
  const delays = [2000, 4000, 8000]; // ms between retries

  // First attempt — immediate
  onPhase?.(1, maxRetries + 1);
  const first = await revalidateFromIndexer(walletAddress);
  if (first) return first;

  // Retries with exponential backoff
  for (let i = 0; i < maxRetries; i++) {
    onPhase?.(i + 2, maxRetries + 1);
    await new Promise((r) => setTimeout(r, delays[i] ?? delays[delays.length - 1]));
    const result = await revalidateFromIndexer(walletAddress);
    if (result) return result;
  }

  return null;
}

// ——— Direct Fullnode Verification (Layer 3) ———

/**
 * Query the Aptos fullnode REST API directly to verify a CircleProfile exists.
 * Unlike the indexer (Layer 2), the fullnode reflects the latest on-chain
 * state with ZERO propagation delay.
 *
 * Strategy: fetch the account's transactions from the fullnode and search
 * for the `create_collection` call with "CircleProfile" as the collection
 * name. The profile data is embedded in the transaction payload's
 * description argument, so we can reconstruct the full profile without
 * any indexer dependency.
 *
 * This is the ultimate fallback — if this returns null, the profile
 * genuinely does not exist on-chain.
 */
export async function verifyProfileOnChain(
  walletAddress: string
): Promise<UserProfile | null> {
  const normalized = normalizeAddress(walletAddress);
  try {
    // ——— Step 1: Confirm the account exists on the fullnode ———
    // This is authoritative — if the fullnode doesn't recognise this
    // address, the account has never transacted on-chain.
    const accountRes = await fetch(
      `${FULLNODE_REST}/accounts/${normalized}`
    );
    if (!accountRes.ok) return null;

    // ——— Step 2: Search the account's transactions for CircleProfile ———
    // The fullnode REST endpoint `/accounts/{addr}/transactions` returns
    // transactions submitted BY this account, ordered by sequence number.
    // We scan for the `create_collection` entry-function call whose
    // third argument (collection name) is "CircleProfile".
    const txRes = await fetch(
      `${FULLNODE_REST}/accounts/${normalized}/transactions?limit=100`
    );
    if (!txRes.ok) return null;

    const transactions: any[] = await txRes.json();

    for (const tx of transactions) {
      // Only inspect successful user transactions
      if (tx.type !== "user_transaction" || !tx.success) continue;

      const payload = tx.payload;
      if (!payload || payload.type !== "entry_function_payload") continue;

      // Match any create_collection variant
      if (!payload.function?.includes("create_collection")) continue;

      // Arguments layout: [description, maxSupply, name, uri, ...]
      const args: string[] = payload.arguments || [];
      if (args[2] !== "CircleProfile") continue;

      // ✅ Found the CircleProfile creation transaction.
      // args[0] is the description — a JSON-encoded profile payload.
      const description = args[0];
      try {
        const data = JSON.parse(description);
        const profile: UserProfile = {
          walletAddress: normalized,
          username: data.username || "Unknown",
          fullName: data.fullName || "Unknown",
          profilePictureUrl: data.profilePictureUrl || "",
          createdAt: data.createdAt || Date.now(),
          collectionId: "", // Populated later by background indexer revalidation
        };
        putProfile(profile);
        return profile;
      } catch {
        // Description wasn't valid JSON — build a minimal profile
        const profile: UserProfile = {
          walletAddress: normalized,
          username: description || "Unknown",
          fullName: "Unknown",
          profilePictureUrl: "",
          createdAt: Date.now(),
          collectionId: "",
        };
        putProfile(profile);
        return profile;
      }
    }

    // No CircleProfile creation found in the account's transactions
    return null;
  } catch (err) {
    console.error(
      "ProfileStore: on-chain verification failed for",
      normalized,
      err
    );
    return null;
  }
}

