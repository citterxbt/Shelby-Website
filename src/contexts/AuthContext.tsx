import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  normalizeAddress,
  getProfile,
  putProfile,
  revalidateWithRetry,
  verifyProfileOnChain,
} from "../lib/profileStore";

export interface UserProfile {
  walletAddress: string;
  username: string;
  fullName: string;
  profilePictureUrl: string;
  createdAt: number;
  collectionId: string;
}

/**
 * Lookup phases — lets the UI show progressive feedback
 * instead of a binary loading/error state.
 */
export type LookupPhase =
  | "idle"        // No lookup in progress
  | "cache"       // Checking localStorage (instant)
  | "indexer"     // Querying indexer with retries
  | "chain"       // Direct fullnode verification
  | "done";       // All phases complete

interface AuthContextType {
  profile: UserProfile | null;
  loading: boolean;
  lookupPhase: LookupPhase;
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
  const [lookupPhase, setLookupPhase] = useState<LookupPhase>("idle");

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

      // ——— PHASE 1: localStorage (0ms, instant) ———
      setLookupPhase("cache");
      const cached = getProfile(normalizedWallet);
      if (cached) {
        setProfileState(cached);
        setLoading(false);
        setLookupPhase("done");

        // Still revalidate in background to keep data fresh,
        // but user is already authenticated.
        revalidateWithRetry(normalizedWallet).then(result => {
          if (!cancelled && result) {
            setProfileState(result);
          }
        });

        return () => { cancelled = true; };
      }

      // ——— No cache — run full multi-phase lookup ———
      setLoading(true);

      (async () => {
        // PHASE 2: Indexer with retry (2s/4s/8s backoff)
        if (cancelled) return;
        setLookupPhase("indexer");
        const indexerResult = await revalidateWithRetry(normalizedWallet, 3);

        if (cancelled) return;
        if (indexerResult) {
          setProfileState(indexerResult);
          setLoading(false);
          setLookupPhase("done");
          return;
        }

        // PHASE 3: Direct fullnode verification (authoritative)
        setLookupPhase("chain");
        const chainResult = await verifyProfileOnChain(normalizedWallet);

        if (cancelled) return;
        if (chainResult) {
          setProfileState(chainResult);
          setLoading(false);
          setLookupPhase("done");
          return;
        }

        // All 3 layers failed — profile genuinely does not exist
        setProfileState(null);
        setLoading(false);
        setLookupPhase("done");
      })().catch(err => {
        if (!cancelled) {
          console.error("AuthContext: multi-phase lookup failed", err);
          setProfileState(null);
          setLoading(false);
          setLookupPhase("done");
        }
      });

      return () => { cancelled = true; };
    } else if (!connected) {
      setProfileState(null);
      setLoading(false);
      setLookupPhase("idle");
    }
  }, [normalizedWallet, connected]);

  const refreshProfile = async () => {
    if (normalizedWallet) {
      setLoading(true);
      setLookupPhase("indexer");
      try {
        const result = await revalidateWithRetry(normalizedWallet, 2);
        if (result) {
          setProfileState(result);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setLookupPhase("done");
      }
    }
  };

  const logout = () => {
    // Don't clear the store — user may reconnect the same wallet.
    // The store ensures instant recognition on re-login.
    disconnect();
    setProfileState(null);
    setLookupPhase("idle");
  };

  return (
    <AuthContext.Provider value={{ profile, loading, lookupPhase, setProfile, refreshProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
