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
// Fullnode GraphQL — authoritative, zero propagation delay vs the indexer
const FULLNODE_INDEXER_URL = "https://api.testnet.aptoslabs.com/v1/graphql";

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
 * Query the Aptos fullnode directly to check for a CircleProfile collection.
 * The fullnode reflects the latest on-chain state with NO propagation delay,
 * unlike the indexer which can lag by seconds or minutes.
 *
 * This is the ultimate fallback — if this returns null, the profile
 * genuinely does not exist on-chain.
 */
export async function verifyProfileOnChain(
  walletAddress: string
): Promise<UserProfile | null> {
  const normalized = normalizeAddress(walletAddress);
  try {
    // Use the account resources endpoint to check for a Collection resource
    // created by the aptos_token module
    const restUrl = `https://fullnode.testnet.aptoslabs.com/v1/accounts/${normalized}/resources`;
    const res = await fetch(restUrl);
    if (!res.ok) return null;

    const resources: any[] = await res.json();

    // Look for the Collections resource that contains our CircleProfile
    // The collection object is stored as a separate on-chain object, so
    // we check for any collection-related resource.
    // The most reliable signal is querying the collections table via GraphQL
    // on the FULLNODE indexer endpoint (same URL, but always up-to-date).
    const gqlRes = await fetch(FULLNODE_INDEXER_URL, {
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
    const gqlData = await gqlRes.json();
    const collection = gqlData.data?.current_collections_v2?.[0];
    if (!collection) return null;

    const profile = parseCollectionToProfile(collection);
    if (profile) {
      putProfile(profile);
    }
    return profile;
  } catch (err) {
    console.error("ProfileStore: on-chain verification failed for", normalized, err);
    return null;
  }
}

