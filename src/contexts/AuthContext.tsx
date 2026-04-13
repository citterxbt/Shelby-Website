import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";

export interface UserProfile {
  walletAddress: string;
  username: string;
  fullName: string;
  profilePictureUrl: string;
  createdAt: number;
  collectionId: string;
}

interface AuthContextType {
  profile: UserProfile | null;
  loading: boolean;
  setProfile: (profile: UserProfile | null) => void;
  refreshProfile: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INDEXER_URL = "https://api.testnet.aptoslabs.com/v1/graphql";
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

// ——— localStorage Profile Cache ———
// Profiles are cached by normalized wallet address to survive wallet
// disconnect/reconnect cycles. This prevents the "No account found"
// error caused by indexer eventual-consistency lag on re-login.
const PROFILE_CACHE_KEY_PREFIX = "circle_profile_";

function getCachedProfile(walletAddress: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY_PREFIX + walletAddress);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    // Basic sanity check: must have username and walletAddress
    if (cached && cached.username && cached.walletAddress) {
      return cached as UserProfile;
    }
  } catch {
    // Corrupted cache — ignore
  }
  return null;
}

function setCachedProfile(walletAddress: string, profile: UserProfile): void {
  try {
    localStorage.setItem(
      PROFILE_CACHE_KEY_PREFIX + walletAddress,
      JSON.stringify(profile)
    );
  } catch {
    // localStorage full or unavailable — non-fatal
  }
}

function clearCachedProfile(walletAddress: string): void {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY_PREFIX + walletAddress);
  } catch {
    // Ignore
  }
}

// Normalize any Aptos address to full 66-char lowercase hex (0x + 64 chars)
// Pure JS - no SDK dependency
function normalizeAddress(addr: string): string {
  let hex = addr.toLowerCase().trim();
  if (hex.startsWith("0x")) hex = hex.slice(2);
  return "0x" + hex.padStart(64, "0");
}

async function queryIndexer(walletAddress: string): Promise<UserProfile | null> {
  const normalizedAddress = normalizeAddress(walletAddress);

  const res = await fetch(INDEXER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: PROFILE_QUERY,
      variables: {
        creatorAddress: normalizedAddress,
        collectionName: "CircleProfile"
      }
    })
  });

  const resData = await res.json();
  const collections = resData.data?.current_collections_v2 || [];
  const collection = collections[0];

  if (!collection) return null;

  try {
    const data = JSON.parse(collection.description || "{}");
    return {
      ...data,
      walletAddress: normalizedAddress,
      collectionId: collection.collection_id,
      profilePictureUrl: data.profilePictureUrl || (collection.uri !== "https://circle.storage/profile" ? collection.uri : "")
    };
  } catch (e) {
    return {
      username: collection.description || "Unknown",
      fullName: "Unknown",
      walletAddress: normalizedAddress,
      collectionId: collection.collection_id,
      profilePictureUrl: collection.uri !== "https://circle.storage/profile" ? collection.uri : "",
      createdAt: Date.now()
    };
  }
}

// Retry logic to handle Aptos indexer eventual consistency lag
// Increased to 5 retries with 2s delay (10s total) for reliability
async function fetchProfileWithRetry(walletAddress: string, retries = 5, delayMs = 2000): Promise<UserProfile | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await queryIndexer(walletAddress);
      if (result) return result;
    } catch (err) {
      console.error(`Profile fetch attempt ${attempt + 1} failed:`, err);
    }
    if (attempt < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { connected, account, disconnect } = useWallet();
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Derive a stable address string to prevent useEffect re-triggers
  // from wallet adapter object reference changes
  const walletAddress = connected && account?.address
    ? (typeof account.address === 'string' ? account.address : account.address.toString())
    : null;

  const normalizedWallet = walletAddress ? normalizeAddress(walletAddress) : null;

  // Wrap setProfile to also update the localStorage cache
  const setProfile = useCallback((newProfile: UserProfile | null) => {
    setProfileState(newProfile);
    if (newProfile && newProfile.walletAddress) {
      setCachedProfile(normalizeAddress(newProfile.walletAddress), newProfile);
    }
  }, []);

  useEffect(() => {
    if (normalizedWallet) {
      let cancelled = false;

      // ——— PHASE 1: Load from cache immediately ———
      // This prevents the "No account found" flash on re-login by
      // showing the cached profile while we revalidate from the indexer.
      const cached = getCachedProfile(normalizedWallet);
      if (cached) {
        setProfileState(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // ——— PHASE 2: Revalidate from the indexer in background ———
      fetchProfileWithRetry(normalizedWallet)
        .then(result => {
          if (!cancelled) {
            if (result) {
              // Update with fresh data from indexer
              setProfileState(result);
              setCachedProfile(normalizedWallet, result);
            } else if (!cached) {
              // No cached profile AND indexer returned nothing
              setProfileState(null);
            }
            // If cached exists but indexer returned null, keep the cached
            // profile — the indexer is likely just lagging
            setLoading(false);
          }
        })
        .catch(err => {
          if (!cancelled) {
            console.error(err);
            // On error, keep the cached profile if we have one
            if (!cached) {
              setProfileState(null);
            }
            setLoading(false);
          }
        });

      return () => { cancelled = true; };
    } else if (!connected) {
      // Only clear profile when wallet is disconnected, not during
      // transient states where account is briefly unavailable
      setProfileState(null);
      setLoading(false);
    }
  }, [normalizedWallet, connected]);

  const refreshProfile = async () => {
    if (normalizedWallet) {
      setLoading(true);
      try {
        const result = await fetchProfileWithRetry(normalizedWallet);
        if (result) {
          setProfileState(result);
          setCachedProfile(normalizedWallet, result);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const logout = () => {
    // Don't clear the cache on logout — user may reconnect the same wallet
    // The cache ensures instant recognition on re-login
    disconnect();
    setProfileState(null);
  };

  return (
    <AuthContext.Provider value={{ profile, loading, setProfile, refreshProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
