import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  normalizeAddress,
  getProfile,
  putProfile,
  revalidateFromIndexer,
} from "../lib/profileStore";

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

// Re-export for consumers that import from AuthContext
export { normalizeAddress } from "../lib/profileStore";

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

  // Wrap setProfile to also write to the ProfileStore
  const setProfile = useCallback((newProfile: UserProfile | null) => {
    setProfileState(newProfile);
    if (newProfile && newProfile.walletAddress) {
      putProfile({
        ...newProfile,
        walletAddress: normalizeAddress(newProfile.walletAddress),
      });
    }
  }, []);

  useEffect(() => {
    if (normalizedWallet) {
      let cancelled = false;

      // ——— INSTANT: Read from ProfileStore (0ms, no network) ———
      const cached = getProfile(normalizedWallet);
      if (cached) {
        setProfileState(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // ——— BACKGROUND: Revalidate from indexer (non-blocking) ———
      // Enriches the local store with latest collectionId and data.
      // If the user exists on-chain but not locally, this populates them.
      revalidateFromIndexer(normalizedWallet)
        .then(result => {
          if (!cancelled) {
            if (result) {
              setProfileState(result);
            } else if (!cached) {
              // No local data AND no indexer result → truly no profile
              setProfileState(null);
            }
            // If cached exists but indexer returned null:
            // keep the cached profile — indexer may be lagging.
            setLoading(false);
          }
        })
        .catch(err => {
          if (!cancelled) {
            console.error(err);
            if (!cached) {
              setProfileState(null);
            }
            setLoading(false);
          }
        });

      return () => { cancelled = true; };
    } else if (!connected) {
      setProfileState(null);
      setLoading(false);
    }
  }, [normalizedWallet, connected]);

  const refreshProfile = async () => {
    if (normalizedWallet) {
      setLoading(true);
      try {
        const result = await revalidateFromIndexer(normalizedWallet);
        if (result) {
          setProfileState(result);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const logout = () => {
    // Don't clear the store — user may reconnect the same wallet.
    // The store ensures instant recognition on re-login.
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
