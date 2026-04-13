import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  normalizeAddress,
  lookupProfile,
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

  // setProfile updates React state only — no localStorage
  const setProfile = useCallback((newProfile: UserProfile | null) => {
    setProfileState(newProfile);
  }, []);

  useEffect(() => {
    if (normalizedWallet) {
      let cancelled = false;
      setLoading(true);

      // Single lookup — direct to chain + indexer enrichment
      lookupProfile(normalizedWallet)
        .then(result => {
          if (cancelled) return;
          setProfileState(result);
          setLoading(false);
        })
        .catch(err => {
          if (!cancelled) {
            console.error("AuthContext: profile lookup failed", err);
            setProfileState(null);
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
        const result = await lookupProfile(normalizedWallet);
        setProfileState(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const logout = () => {
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
