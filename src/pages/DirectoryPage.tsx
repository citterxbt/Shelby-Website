import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Users, Loader2 } from "lucide-react";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";

const INDEXER_URL = "https://api.testnet.aptoslabs.com/v1/graphql";

// Normalize any Aptos address to full 66-char lowercase hex (0x + 64 chars)
// Pure JS - no SDK dependency
function normalizeAddress(addr: string): string {
  let hex = addr.toLowerCase().trim();
  if (hex.startsWith("0x")) hex = hex.slice(2);
  return "0x" + hex.padStart(64, "0");
}

// ——— Stable Search Cache ———
// Caches the full list of CircleProfile collections to prevent the issue
// where repeated identical searches return different results due to
// indexer load balancing across replicas and non-deterministic ordering.
// The cache has a short TTL (30s) to stay reasonably fresh while
// ensuring stability within a user's search session.
interface CachedSearchData {
  collections: Array<{ creator_address: string; description: string }>;
  fetchedAt: number;
}

const SEARCH_CACHE_TTL_MS = 30_000; // 30 seconds
let searchCache: CachedSearchData | null = null;

async function fetchAllProfiles(): Promise<Array<{ creator_address: string; description: string }>> {
  // Return from cache if still valid
  if (searchCache && (Date.now() - searchCache.fetchedAt) < SEARCH_CACHE_TTL_MS) {
    return searchCache.collections;
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

  // Update cache
  searchCache = {
    collections,
    fetchedAt: Date.now()
  };

  return collections;
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
    
    // Otherwise, search by username using the cached profile list
    setIsSearching(true);
    setSearchError("");
    const mySearchId = ++searchIdRef.current;

    // Retry logic for indexer consistency
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // On retry, invalidate cache to force a fresh fetch
        if (attempt > 0) {
          searchCache = null;
        }

        const collections = await fetchAllProfiles();

        // Discard if a newer search has started
        if (searchIdRef.current !== mySearchId) return;

        let foundAddress: string | null = null;
        
        for (const col of collections) {
          try {
            const data = JSON.parse(col.description);
            if (data.username && data.username.toLowerCase() === term.toLowerCase()) {
              foundAddress = col.creator_address;
              break;
            }
          } catch (e) {}
        }
        
        if (foundAddress) {
          navigate(`/directory/${normalizeAddress(foundAddress)}`);
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
          // Invalidate cache before retry
          searchCache = null;
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
