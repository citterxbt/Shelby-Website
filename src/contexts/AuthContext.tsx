import React, { createContext, useContext, useEffect, useState } from 'react';
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
async function fetchProfileWithRetry(walletAddress: string, retries = 3, delayMs = 1500): Promise<UserProfile | null> {
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Derive a stable address string to prevent useEffect re-triggers
  // from wallet adapter object reference changes
  const walletAddress = connected && account?.address
    ? (typeof account.address === 'string' ? account.address : account.address.toString())
    : null;

  useEffect(() => {
    if (walletAddress) {
      setLoading(true);
      let cancelled = false;

      fetchProfileWithRetry(walletAddress)
        .then(result => {
          if (!cancelled) {
            setProfile(result);
            setLoading(false);
          }
        })
        .catch(err => {
          if (!cancelled) {
            console.error(err);
            setProfile(null);
            setLoading(false);
          }
        });

      return () => { cancelled = true; };
    } else if (!connected) {
      // Only clear profile when wallet is disconnected, not during
      // transient states where account is briefly unavailable
      setProfile(null);
      setLoading(false);
    }
  }, [walletAddress, connected]);

  const refreshProfile = async () => {
    if (walletAddress) {
      setLoading(true);
      try {
        const result = await fetchProfileWithRetry(walletAddress);
        setProfile(result);
      } catch (err) {
        console.error(err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
  };

  const logout = () => {
    disconnect();
    setProfile(null);
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
