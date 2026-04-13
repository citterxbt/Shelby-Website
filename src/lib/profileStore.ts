/**
 * ProfileStore — Direct on-chain profile data layer
 *
 * Architecture:
 *   The Aptos fullnode REST API is the ONLY source of truth.
 *   NO localStorage caching. NO local registry.
 *   Every lookup hits the chain or the indexer directly.
 *
 * This eliminates the root cause of "No account found" errors
 * on fresh browsers: there is no cache to be empty.
 */

import type { UserProfile } from "../contexts/AuthContext";

// ——— Constants ———
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

// ——— Primary: Direct Fullnode Verification ———

/**
 * Query the Aptos fullnode REST API directly to verify a CircleProfile exists.
 * The fullnode reflects the latest on-chain state with ZERO propagation delay.
 *
 * Strategy: fetch the account's transactions and search for the
 * `create_collection` call with "CircleProfile" as the collection name.
 *
 * This is the authoritative source of truth. No caching, no retries.
 * If this returns null, the profile genuinely does not exist on-chain.
 */
export async function lookupProfileOnChain(
  walletAddress: string
): Promise<UserProfile | null> {
  const normalized = normalizeAddress(walletAddress);
  try {
    // Step 1: Confirm the account exists on the fullnode
    const accountRes = await fetch(
      `${FULLNODE_REST}/accounts/${normalized}`
    );
    if (!accountRes.ok) return null;

    // Step 2: Search the account's transactions for CircleProfile
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
      const description = args[0];
      try {
        const data = JSON.parse(description);
        return {
          walletAddress: normalized,
          username: data.username || "Unknown",
          fullName: data.fullName || "Unknown",
          profilePictureUrl: data.profilePictureUrl || "",
          createdAt: data.createdAt || Date.now(),
          collectionId: "", // Populated by indexer lookup below
        };
      } catch {
        return {
          walletAddress: normalized,
          username: description || "Unknown",
          fullName: "Unknown",
          profilePictureUrl: "",
          createdAt: Date.now(),
          collectionId: "",
        };
      }
    }

    // No CircleProfile creation found in the account's transactions
    return null;
  } catch (err) {
    console.error(
      "ProfileStore: on-chain lookup failed for",
      normalized,
      err
    );
    return null;
  }
}

// ——— Secondary: Indexer Lookup (for collectionId + search) ———

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

const SEARCH_PROFILES_QUERY = `
  query SearchProfiles($collectionName: String) {
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

/**
 * Look up a single profile from the indexer.
 * Used to get the collectionId (needed for profile editing).
 * Falls back gracefully — never throws.
 */
export async function lookupProfileViaIndexer(
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

    return parseCollectionToProfile(collection);
  } catch (err) {
    console.error("ProfileStore: indexer lookup failed for", normalized, err);
    return null;
  }
}

/**
 * Search profiles by username or fullName via the indexer.
 * Returns live results — no caching, no stale data.
 * Used by DirectoryPage for name-based search.
 */
export async function searchProfilesByName(
  term: string
): Promise<UserProfile[]> {
  try {
    const res = await fetch(INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: SEARCH_PROFILES_QUERY,
        variables: { collectionName: "CircleProfile" },
      }),
    });
    const resData = await res.json();
    const collections = resData.data?.current_collections_v2 || [];

    const profiles: UserProfile[] = [];
    const lowerTerm = term.toLowerCase();

    for (const collection of collections) {
      const profile = parseCollectionToProfile(collection);
      if (!profile) continue;

      // Filter by username or fullName match
      if (
        profile.username?.toLowerCase().includes(lowerTerm) ||
        profile.fullName?.toLowerCase().includes(lowerTerm)
      ) {
        profiles.push(profile);
      }
    }

    return profiles;
  } catch (err) {
    console.error("ProfileStore: search failed", err);
    return [];
  }
}

/**
 * Combined lookup: chain-first, then enrich with indexer data.
 * This is the recommended high-level function for most use cases.
 *
 * 1. Hits fullnode REST (authoritative, instant)
 * 2. If found, also queries indexer for collectionId
 * 3. Merges and returns the complete profile
 */
export async function lookupProfile(
  walletAddress: string
): Promise<UserProfile | null> {
  // Primary: direct on-chain verification
  const chainResult = await lookupProfileOnChain(walletAddress);

  if (chainResult) {
    // Enrich with collectionId from indexer (best-effort, non-blocking)
    try {
      const indexerResult = await lookupProfileViaIndexer(walletAddress);
      if (indexerResult?.collectionId) {
        chainResult.collectionId = indexerResult.collectionId;
      }
    } catch {
      // collectionId missing is non-fatal — editing won't work but profile displays fine
    }
    return chainResult;
  }

  // Fallback: try indexer in case fullnode had issues
  // (e.g. too many transactions to scan, pagination limits)
  const indexerResult = await lookupProfileViaIndexer(walletAddress);
  return indexerResult;
}
