import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Users, Loader2 } from "lucide-react";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { normalizeAddress, getLocalRegistry } from "../contexts/AuthContext";

const INDEXER_URL = "https://api.testnet.aptoslabs.com/v1/graphql";

// ——— localStorage-backed Search Cache ———
// The search cache persists across page navigations (unlike the previous
// in-memory-only cache) and merges indexer results with the local profile
// registry. This guarantees:
// 1. Repeated searches always return the same results (no indexer replica drift)
// 2. Newly registered profiles are instantly discoverable
// 3. Search survives page navigation without re-fetching

const SEARCH_CACHE_KEY = "circle_search_cache";
const SEARCH_CACHE_TTL_MS = 60_000; // 60 seconds — longer TTL for stability

interface CachedSearchData {
  collections: Array<{ creator_address: string; description: string }>;
  fetchedAt: number;
}

function getSearchCache(): CachedSearchData | null {
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedSearchData = JSON.parse(raw);
    if (cached && cached.collections && (Date.now() - cached.fetchedAt) < SEARCH_CACHE_TTL_MS) {
      return cached;
    }
  } catch {
    // Corrupted — ignore
  }
  return null;
}

function setSearchCache(data: CachedSearchData): void {
  try {
    localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Non-fatal
  }
}

function clearSearchCache(): void {
  try {
    localStorage.removeItem(SEARCH_CACHE_KEY);
  } catch {
    // Ignore
  }
}

async function fetchAllProfiles(): Promise<Array<{ creator_address: string; description: string }>> {
  // Return from localStorage cache if still valid
  const cached = getSearchCache();
  if (cached) {
    return cached.collections;
  }

  const query = `
    query GetProfiles($collectionName: String) {
      current_collections_v2(
        where: {collection_name: {_eq: $collectionName}}
        order_by: {creator_address: asc}
        limit: 500
      ) {
        creator_address
        description
      }
    }
  `;

  const res = await fetch(INDEXER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { collectionName: "CircleProfile" }
    })
  });

  const resData = await res.json();
  const collections = resData.data?.current_collections_v2 || [];

  // Persist to localStorage
  setSearchCache({
    collections,
    fetchedAt: Date.now()
  });

  return collections;
}

// ——— Unified Search ———
// Searches both the indexer results (cached) AND the local profile registry.
// The local registry contains profiles created on this device that the
// indexer may not have ingested yet. This eliminates the window where a
// newly registered user is unsearchable.
function searchByUsername(
  term: string,
  indexerCollections: Array<{ creator_address: string; description: string }>
): string | null {
  const lowerTerm = term.toLowerCase();

  // 1. Search indexer results first (authoritative when available)
  for (const col of indexerCollections) {
    try {
      const data = JSON.parse(col.description);
      if (data.username && data.username.toLowerCase() === lowerTerm) {
        return normalizeAddress(col.creator_address);
      }
    } catch {}
  }

  // 2. Fall back to local registry (covers indexer lag)
  const localProfiles = getLocalRegistry();
  for (const entry of localProfiles) {
    if (entry.username.toLowerCase() === lowerTerm) {
      return entry.walletAddress; // Already normalized
    }
  }

  return null;
}

export default function DirectoryPage() {
  const [searchAddress, setSearchAddress] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const navigate = useNavigate();
  // Track the current search request to discard stale responses
  const searchIdRef = useRef(0);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchAddress.trim();
    if (!term) return;
    
    // If it looks like an address, normalize and go directly
    if (/^0x[0-9a-fA-F]+$/.test(term)) {
      navigate(`/directory/${normalizeAddress(term)}`);
      return;
    }
    
    // Otherwise, search by username
    setIsSearching(true);
    setSearchError("");
    const mySearchId = ++searchIdRef.current;

    // Retry logic for indexer consistency
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // On retry, invalidate cache to force a fresh indexer fetch
        if (attempt > 0) {
          clearSearchCache();
        }

        const collections = await fetchAllProfiles();

        // Discard if a newer search has started
        if (searchIdRef.current !== mySearchId) return;

        const foundAddress = searchByUsername(term, collections);
        
        if (foundAddress) {
          navigate(`/directory/${foundAddress}`);
          setIsSearching(false);
          return;
        }
        
        // If no result found and we still have retries, wait and try again
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (err) {
        console.error(`Search attempt ${attempt + 1} failed:`, err);
        if (attempt < 2) {
          clearSearchCache();
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }
    
    // Discard if a newer search has started
    if (searchIdRef.current !== mySearchId) return;

    // All retries exhausted
    setSearchError("User not found. Try searching by wallet address (0x...) for best results.");
    setIsSearching(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-6 md:p-12 flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
        <header className="flex justify-between items-center mb-16 border-b border-white/10 pb-6">
          <Link to="/" className="text-xl font-bold tracking-widest flex items-center gap-3 text-white">
            CIRCLE STORAGE
          </Link>
          <Link to="/app" className="text-xs font-bold tracking-widest text-orange-500 hover:text-orange-400 transition-colors">
            RETURN TO APP
          </Link>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center -mt-20">
          <Users className="w-16 h-16 text-orange-500 mb-8" />
          <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-4 text-center">
            DECENTRALIZED LOOKUP
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed text-center max-w-lg mb-12">
            Enter an Aptos wallet address or username to view their public profile. Because Circle Storage is fully decentralized, there is no central database of users.
          </p>

          <form onSubmit={handleSearch} className="w-full max-w-xl flex flex-col gap-2">
            <div className="flex gap-2 w-full">
              <Input 
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                placeholder="Enter Username or Aptos Wallet Address (0x...)"
                className="bg-[#141414] border-white/10 rounded-none focus-visible:ring-orange-500 h-14 font-mono text-sm flex-1"
                disabled={isSearching}
              />
              <Button 
                type="submit"
                disabled={!searchAddress.trim() || isSearching}
                className="bg-orange-500 hover:bg-orange-600 text-black rounded-none text-xs font-bold tracking-widest px-8 h-14"
              >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </Button>
            </div>
            {searchError && (
              <div className="text-red-500 text-xs font-bold tracking-widest mt-2 px-2">
                {searchError}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
