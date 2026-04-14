import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Users, Loader2 } from "lucide-react";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import {
  normalizeAddress,
  searchProfilesByName,
} from "../lib/profileStore";

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
    
    // Otherwise, search by username/fullName via live indexer query
    setIsSearching(true);
    setSearchError("");
    const mySearchId = ++searchIdRef.current;

    try {
      const results = await searchProfilesByName(term);

      // Discard if a newer search has started
      if (searchIdRef.current !== mySearchId) return;

      // Exact username match takes priority
      const exactMatch = results.find(
        (p) => p.username?.toLowerCase() === term.toLowerCase()
      );

      if (exactMatch) {
        navigate(`/directory/${exactMatch.walletAddress}`);
        return;
      }

      // Partial match — use the first result
      if (results.length > 0) {
        navigate(`/directory/${results[0].walletAddress}`);
        return;
      }

      // No results
      setSearchError("User not found. Try searching by wallet address (0x...) for best results.");
    } catch (err) {
      console.error("Directory search error:", err);
      setSearchError("Search failed. Please try again.");
    } finally {
      if (searchIdRef.current === mySearchId) {
        setIsSearching(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-6 md:p-12 flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
        <header className="flex justify-between items-center mb-16 border-b border-white/10 pb-6">
          <Link to="/" className="text-xl font-bold tracking-widest flex items-center gap-3 text-white">
            CIRCLE STORAGE
          </Link>
          <Link to="/app" className="text-xs font-bold tracking-widest text-white hover:text-orange-400 transition-colors">
            RETURN TO APP
          </Link>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center -mt-20">
          <Users className="w-16 h-16 text-white mb-8" />
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
                className="bg-[#141414] border-white/10 rounded-none focus-visible:ring-white h-14 font-mono text-sm flex-1"
                disabled={isSearching}
              />
              <Button 
                type="submit"
                disabled={!searchAddress.trim() || isSearching}
                className="bg-white hover:bg-white text-black rounded-none text-xs font-bold tracking-widest px-8 h-14"
              >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </Button>
            </div>
            {isSearching && (
              <div className="text-orange-400 text-xs font-bold tracking-widest mt-2 px-2 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                SEARCHING...
              </div>
            )}
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
