import React, { useState, useRef, useEffect, useMemo } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
import { useUploadBlobs } from "@shelby-protocol/react";
import { UploadCloud, CheckCircle2, Loader2, AlertCircle, FileText, Wallet, Users, Download, Image as ImageIcon, Settings, X, Plus, Zap, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const SHELBY_API_BASE = "https://api.testnet.shelby.xyz/shelby/v1/blobs";
const SHELBY_EXPLORER_BASE = "https://explorer.shelby.xyz/testnet/account";

// ——— Dynamic Pricing Configuration ———
// Base rate per MB per day in APT (testnet play money)
const BASE_RATE_PER_MB_PER_DAY = 0.0001;

// Multiplier tiers: larger files get a slight discount per-MB
function getSizeMultiplier(totalBytes: number): number {
  const mb = totalBytes / (1024 * 1024);
  if (mb <= 1) return 1.0;
  if (mb <= 10) return 0.9;
  if (mb <= 100) return 0.75;
  if (mb <= 500) return 0.6;
  return 0.5; // 500MB+ gets best rate
}

// Duration multiplier: longer durations get a slight premium
function getDurationMultiplier(days: number): number {
  if (days <= 1) return 1.0;
  if (days <= 7) return 0.95;
  if (days <= 30) return 0.9;
  if (days <= 90) return 0.85;
  if (days <= 180) return 0.8;
  return 0.75; // 365+ gets best rate per-day
}

function calculateFee(totalBytes: number, retentionDays: number): number {
  const mb = totalBytes / (1024 * 1024);
  const effectiveDays = retentionDays === -1 ? 365 : retentionDays;
  const sizeMultiplier = getSizeMultiplier(totalBytes);
  const durationMultiplier = getDurationMultiplier(effectiveDays);
  return mb * effectiveDays * BASE_RATE_PER_MB_PER_DAY * sizeMultiplier * durationMultiplier;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Retention options
const RETENTION_OPTIONS = [
  { value: "1", label: "1 Day" },
  { value: "3", label: "3 Days" },
  { value: "7", label: "7 Days" },
  { value: "14", label: "14 Days" },
  { value: "30", label: "30 Days" },
  { value: "90", label: "90 Days" },
  { value: "180", label: "180 Days" },
  { value: "365", label: "365 Days" },
  { value: "-1", label: "Permanent" },
];

interface FileData {
  id: string;
  uploaderId: string;
  blobName: string;
  url: string;
  size: number;
  uploadDate: number;
  expirationDate: number;
}

export default function AppPage() {
  const { connected, connect, account, signAndSubmitTransaction } = useWallet();
  const { profile, loading: authLoading, logout, refreshProfile } = useAuth();
  
  // Multi-file state
  const [files, setFiles] = useState<File[]>([]);
  const [retention, setRetention] = useState<string>("30");
  const [step, setStep] = useState<"idle" | "initiating" | "approving" | "executing" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [txHash, setTxHash] = useState<string>("");
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  
  // Auth UI State
  const [authMode, setAuthMode] = useState<"gateway" | "login" | "register">("gateway");
  const [regUsername, setRegUsername] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regProfilePicFile, setRegProfilePicFile] = useState<File | null>(null);
  const [regProfilePicPreview, setRegProfilePicPreview] = useState<string>("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState("");

  // My Files State
  const [myFiles, setMyFiles] = useState<FileData[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);

  // Dynamic pricing calculation
  const totalSize = useMemo(() => files.reduce((acc, f) => acc + f.size, 0), [files]);
  const retentionDays = parseInt(retention);
  const estimatedFee = useMemo(() => calculateFee(totalSize, retentionDays), [totalSize, retentionDays]);

  const fetchMyFiles = async () => {
    if (!profile) return;
    setLoadingFiles(true);
    try {
      const res = await fetch(`${SHELBY_API_BASE}/${profile.walletAddress}/files.json`);
      if (res.ok) {
        const data = await res.json();
        setMyFiles(Array.isArray(data) ? data : []);
      } else {
        setMyFiles([]);
      }
    } catch (err) {
      console.error(err);
      setMyFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchMyFiles();
    }
  }, [profile]);

  const uploadBlobs = useUploadBlobs({});

  const uploadProfilePic = useUploadBlobs({});

  // Multi-file change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
      setStep("idle");
      setErrorMsg("");
    }
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRegProfilePicFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setRegProfilePicPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Build the correct Shelby explorer link for a given file
  const buildExplorerLink = (address: string, fileName: string) => {
    const encodedName = encodeURIComponent(fileName);
    return `${SHELBY_EXPLORER_BASE}/${address}/blobs?name=${encodedName}`;
  };

  // Build the tx hash explorer link
  const buildTxExplorerLink = (hash: string) => {
    return `https://explorer.shelby.xyz/testnet/tx/${hash}`;
  };

  const handleUploadFlow = async () => {
    if (files.length === 0 || !connected || !account || !signAndSubmitTransaction) {
      setErrorMsg("Please select files and connect your Aptos wallet first.");
      return;
    }

    // Reset previous state
    setTxHash("");
    setUploadedFileNames([]);
    setErrorMsg("");

    try {
      setStep("initiating");
      
      // Build blob entries for all files
      // Note: Shelby protocol requires blobs >= 1024 bytes; pad if needed
      const blobEntries: { blobName: string; blobData: Uint8Array }[] = [];
      const newFileRecords: FileData[] = [];
      const explorerLinks: string[] = [];
      const fileNames: string[] = [];
      const walletAddress = account.address.toString();

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        let fileData = new Uint8Array(arrayBuffer);
        
        // Shelby protocol minimum blob size: pad to 1024 bytes if needed
        if (fileData.length < 1024) {
          const paddedData = new Uint8Array(1024);
          paddedData.set(fileData);
          fileData = paddedData;
        }
        
        const blobName = file.name;
        const url = `${SHELBY_API_BASE}/${walletAddress}/${encodeURIComponent(blobName)}`;
        const explorerLink = buildExplorerLink(walletAddress, blobName);
        explorerLinks.push(explorerLink);
        fileNames.push(blobName);

        const expirationDate = retention === "-1" ? -1 : Date.now() + parseInt(retention) * 86400000;

        newFileRecords.push({
          id: `${walletAddress}_${Date.now()}_${blobName}`,
          uploaderId: walletAddress,
          blobName,
          url,
          size: file.size,
          uploadDate: Date.now(),
          expirationDate
        });

        blobEntries.push({ blobName, blobData: fileData });
      }

      setResultUrls(explorerLinks);
      setUploadedFileNames(fileNames);

      // Fetch existing files.json and merge
      let existingFiles: FileData[] = [];
      try {
        const existingRes = await fetch(`${SHELBY_API_BASE}/${walletAddress}/files.json`);
        if (existingRes.ok) {
          // Read as text and strip any null bytes from previous padded uploads
          const rawText = await existingRes.text();
          const cleanText = rawText.replace(/\0+$/g, '').trim();
          if (cleanText) {
            const existingData = JSON.parse(cleanText);
            if (Array.isArray(existingData)) {
              existingFiles = existingData;
            }
          }
        }
      } catch {
        // No existing files.json or corrupted, starting fresh
      }

      // Merge: add new files, avoid duplicates by blobName
      const newBlobNames = new Set(newFileRecords.map(f => f.blobName));
      const filteredExisting = existingFiles.filter(f => !newBlobNames.has(f.blobName));
      const updatedFiles = [...newFileRecords, ...filteredExisting];
      const filesBlobData = new TextEncoder().encode(JSON.stringify(updatedFiles));

      // Add files.json to the batch (no padding — original code never padded metadata)
      blobEntries.push({ blobName: 'files.json', blobData: filesBlobData });

      setStep("approving");
      
      const expirationMicros = retention === "-1" 
        ? Date.now() * 1000 + 365 * 86400000000 // 1 year for permanent
        : Date.now() * 1000 + parseInt(retention) * 86400000000;

      // Use mutateAsync to properly await the on-chain transaction result
      // This is the critical fix: .mutate() is fire-and-forget and causes
      // the step state to race ahead of the actual transaction outcome.
      // .mutateAsync() returns a promise that resolves/rejects with the
      // actual on-chain result, so we can correctly determine success/failure.
      setStep("executing");
      
      const result = await uploadBlobs.mutateAsync({
        signer: { account: walletAddress, signAndSubmitTransaction },
        blobs: blobEntries,
        expirationMicros
      });

      // Extract tx hash from the mutation result
      const hash = (result as any)?.hash || (result as any)?.transaction_hash || (result as any)?.txHash || "";
      if (hash) {
        setTxHash(hash);
      }

      // ✅ Transaction confirmed on-chain — update UI immediately
      setStep("success");

      // Optimistic update: immediately add new files to the local file list
      // so the user sees them without waiting for the Shelby API to propagate
      setMyFiles(prev => {
        const currentBlobNames = new Set(prev.map(f => f.blobName));
        const trulyNew = newFileRecords.filter(f => !currentBlobNames.has(f.blobName));
        return [...trulyNew, ...prev];
      });

      // Also do a delayed refetch to sync with the authoritative on-chain state
      setTimeout(() => fetchMyFiles(), 5000);
      setTimeout(() => fetchMyFiles(), 15000);
      
    } catch (err: any) {
      console.error("Upload failed:", err);
      
      // Build a descriptive error message based on the failure context
      let descriptiveError = "";
      const rawMsg = err?.message || String(err);
      
      if (rawMsg.includes("rejected") || rawMsg.includes("User rejected") || rawMsg.includes("cancelled") || rawMsg.includes("denied")) {
        descriptiveError = "Transaction rejected: You declined the transaction in your wallet. No files were uploaded and no fees were charged.";
      } else if (rawMsg.includes("insufficient") || rawMsg.includes("balance") || rawMsg.includes("INSUFFICIENT_BALANCE")) {
        descriptiveError = `Insufficient balance: Your wallet does not have enough APT to cover the upload fee of ~${estimatedFee.toFixed(6)} APT. Please fund your wallet and try again.`;
      } else if (rawMsg.includes("timeout") || rawMsg.includes("ETIMEDOUT") || rawMsg.includes("network")) {
        descriptiveError = "Network error: The connection to the Shelby testnet timed out. Please check your internet connection and try again.";
      } else if (rawMsg.includes("blob") || rawMsg.includes("size") || rawMsg.includes("too large")) {
        descriptiveError = `File size error: One or more files exceed the allowed blob size for the Shelby protocol. Total upload size: ${formatFileSize(totalSize)}.`;
      } else if (rawMsg.includes("already exists") || rawMsg.includes("duplicate")) {
        descriptiveError = "Duplicate upload: One or more files with the same name already exist on-chain. Consider renaming the files and trying again.";
      } else if (rawMsg.includes("SEQUENCE_NUMBER") || rawMsg.includes("sequence")) {
        descriptiveError = "Transaction sequencing error: A previous transaction is still pending. Please wait a moment and try again.";
      } else {
        descriptiveError = `Upload failed: ${rawMsg}. Please verify your wallet connection and try again. If the issue persists, check the Shelby block explorer to confirm whether the transaction was processed.`;
      }
      
      setErrorMsg(descriptiveError);
      setStep("error");
    }
  };

  const handleDownload = (f: FileData) => {
    const isExpired = f.expirationDate !== -1 && f.expirationDate < Date.now();
    if (isExpired) {
      alert("File has expired and is no longer accessible.");
      return;
    }
    window.open(f.url, "_blank");
  };

  const resetState = () => {
    setFiles([]);
    setStep("idle");
    setErrorMsg("");
    setResultUrls([]);
    setTxHash("");
    setUploadedFileNames([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !account || !signAndSubmitTransaction) {
      setAuthError("Please connect your wallet first.");
      return;
    }
    if (!regUsername || !regFullName || !regProfilePicFile) {
      setAuthError("Please fill all fields and upload a profile picture.");
      return;
    }
    setIsAuthenticating(true);
    setAuthError("");
    
    try {
      let profilePicUrl = "";
      
      // 1. Upload profile picture to Shelby
      try {
        let arrayBuffer = await regProfilePicFile.arrayBuffer();
        let fileData = new Uint8Array(arrayBuffer);
        
        const blobName = `profile_${Date.now()}_${regProfilePicFile.name}`;
        const encodedBlobName = encodeURIComponent(blobName);
        profilePicUrl = `${SHELBY_API_BASE}/${account.address.toString()}/${encodedBlobName}`;
        
        await uploadProfilePic.mutateAsync({
          signer: { account: account.address.toString(), signAndSubmitTransaction },
          blobs: [
            { blobName, blobData: fileData }
          ],
          expirationMicros: Date.now() * 1000 + 365 * 86400000000 // 1 year
        });
      } catch (err: any) {
        throw new Error("Failed to upload profile picture: " + err.message);
      }

      // 2. Create Aptos Collection
      const profileData = {
        username: regUsername,
        fullName: regFullName,
        profilePictureUrl: profilePicUrl,
        createdAt: Date.now()
      };
      
      const descriptionString = JSON.stringify(profileData);
      if (new TextEncoder().encode(descriptionString).length > 2048) {
        setAuthError("Profile metadata is too large.");
        setIsAuthenticating(false);
        return;
      }
      
      const payload = {
        data: {
          function: "0x4::aptos_token::create_collection",
          typeArguments: [],
          functionArguments: [
            descriptionString, // description
            "1", // maxSupply
            "CircleProfile", // name
            "https://circle.storage/profile", // uri
            true, true, true, true, true, true, true, true, true, "0", "1"
          ]
        }
      };

      await signAndSubmitTransaction(payload as any);
      
      // Wait for indexer to catch up, then refresh with retry
      setTimeout(() => {
        refreshProfile();
        setIsAuthenticating(false);
      }, 3000);
      
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Registration failed. Please try again.");
      setIsAuthenticating(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-16 border-b border-white/10 pb-6">
          <Link to="/" className="text-xl font-bold tracking-widest flex items-center gap-3 text-white">
            CIRCLE STORAGE
          </Link>
          
          <div className="flex items-center gap-8">
            <Link to="/directory" className="text-xs font-bold tracking-widest text-gray-400 hover:text-white transition-colors flex items-center gap-2">
              <Users className="w-4 h-4" />
              DIRECTORY
            </Link>
            
            {profile ? (
              <div className="flex items-center gap-4">
                {/* FIX #4: Profile icon links to user's settings/profile page */}
                <Link to={`/directory/${profile.walletAddress}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity" title="My Profile & Settings">
                  <img 
                    src={profile.profilePictureUrl || "https://picsum.photos/seed/user/100/100"} 
                    alt={profile.username} 
                    className="w-8 h-8 rounded-full object-cover border border-white/20"
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-xs tracking-widest font-medium text-white uppercase">{profile.username}</span>
                </Link>
                <Button variant="outline" size="sm" onClick={logout} className="border-white/10 text-gray-400 hover:text-white hover:bg-white/10 bg-transparent rounded-none text-xs tracking-widest">
                  LOGOUT
                </Button>
              </div>
            ) : (
              <div className="text-xs font-bold tracking-widest text-gray-500">NOT LOGGED IN</div>
            )}
          </div>
        </header>

        <main>
          {(!profile || authMode === "register") ? (
            <div className="max-w-md mx-auto w-full mt-24">
              <div className="bg-[#141414] border border-white/10 p-8">
                {authMode === "gateway" && (
                  <>
                    <h2 className="text-3xl font-light tracking-tight text-white mb-2">Welcome to Circle</h2>
                    <p className="text-gray-400 text-sm mb-8">Secure, decentralized storage on Aptos.</p>
                    <div className="space-y-4">
                      <Button 
                        onClick={() => { setAuthMode("login"); if (!connected) connect("Petra" as any); }} 
                        className="w-full bg-orange-500 hover:bg-orange-600 text-black text-xs font-bold tracking-widest rounded-none h-12"
                      >
                        <Wallet className="w-4 h-4 mr-2" />
                        LOGIN WITH WALLET
                      </Button>
                      <Button 
                        onClick={() => { setAuthMode("register"); if (!connected) connect("Petra" as any); }} 
                        variant="outline"
                        className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10 bg-transparent text-xs font-bold tracking-widest rounded-none h-12"
                      >
                        REGISTER NEW ACCOUNT
                      </Button>
                    </div>
                  </>
                )}

                {authMode === "login" && (
                  <>
                    <h2 className="text-3xl font-light tracking-tight text-white mb-2">Welcome Back</h2>
                    <p className="text-gray-400 text-sm mb-8">Connect your wallet to access your decentralized storage.</p>
                    
                    {authError && (
                      <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium tracking-widest uppercase">
                        {authError}
                      </div>
                    )}

                    {!connected ? (
                      <Button 
                        onClick={() => connect("Petra" as any)} 
                        className="w-full bg-orange-500 hover:bg-orange-600 text-black text-xs font-bold tracking-widest rounded-none h-12"
                      >
                        <Wallet className="w-4 h-4 mr-2" />
                        CONNECT WALLET
                      </Button>
                    ) : !profile ? (
                      <div className="text-center space-y-6">
                        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium tracking-widest uppercase">
                          No account found for this wallet.
                        </div>
                        <Button 
                          onClick={() => setAuthMode("register")} 
                          variant="outline"
                          className="w-full border-white/10 text-gray-400 hover:text-white hover:bg-white/10 bg-transparent text-xs font-bold tracking-widest rounded-none h-12"
                        >
                          CREATE ACCOUNT
                        </Button>
                        <Button 
                          onClick={() => setAuthMode("gateway")} 
                          variant="ghost"
                          className="w-full text-gray-500 hover:text-white hover:bg-transparent text-xs font-bold tracking-widest rounded-none h-12"
                        >
                          BACK
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}

                {authMode === "register" && (
                  <>
                    <h2 className="text-3xl font-light tracking-tight text-white mb-2">Join Beta Program</h2>
                    <p className="text-gray-400 text-sm mb-8">Create an account to start uploading.</p>
                    
                    {authError && (
                      <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium tracking-widest uppercase">
                        {authError}
                      </div>
                    )}

                    {!connected ? (
                      <Button 
                        onClick={() => connect("Petra" as any)} 
                        className="w-full bg-orange-500 hover:bg-orange-600 text-black text-xs font-bold tracking-widest rounded-none h-12"
                      >
                        <Wallet className="w-4 h-4 mr-2" />
                        CONNECT WALLET
                      </Button>
                    ) : profile ? (
                      <div className="text-center space-y-6">
                        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium tracking-widest uppercase">
                          An account already exists for this wallet.
                        </div>
                        <Button 
                          onClick={() => setAuthMode("login")} 
                          variant="outline"
                          className="w-full border-white/10 text-gray-400 hover:text-white hover:bg-white/10 bg-transparent text-xs font-bold tracking-widest rounded-none h-12"
                        >
                          GO TO LOGIN
                        </Button>
                        <Button 
                          onClick={() => setAuthMode("gateway")} 
                          variant="ghost"
                          className="w-full text-gray-500 hover:text-white hover:bg-transparent text-xs font-bold tracking-widest rounded-none h-12"
                        >
                          BACK
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleRegister} className="space-y-6">
                        <div className="p-4 bg-black border border-white/10 flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs text-gray-300 tracking-widest">
                            <CheckCircle2 className="w-4 h-4 text-orange-500" />
                            WALLET CONNECTED
                          </div>
                          <span className="text-xs font-mono text-gray-500">
                            {account?.address.toString().slice(0, 6)}...{account?.address.toString().slice(-4)}
                          </span>
                        </div>

                        <div className="space-y-3">
                          <label className="text-xs tracking-widest text-gray-400">USERNAME</label>
                          <Input 
                            value={regUsername} 
                            onChange={(e) => setRegUsername(e.target.value)} 
                            className="bg-black border-white/10 rounded-none focus-visible:ring-orange-500 h-12" 
                            required 
                            disabled={!connected || isAuthenticating}
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs tracking-widest text-gray-400">FULL NAME</label>
                          <Input 
                            value={regFullName} 
                            onChange={(e) => setRegFullName(e.target.value)} 
                            className="bg-black border-white/10 rounded-none focus-visible:ring-orange-500 h-12" 
                            required 
                            disabled={!connected || isAuthenticating}
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs tracking-widest text-gray-400">PROFILE PICTURE</label>
                          <div className="flex items-center gap-4">
                            <div 
                              className={`w-16 h-16 shrink-0 rounded-full border border-white/10 flex items-center justify-center overflow-hidden bg-black ${!connected || isAuthenticating ? 'opacity-50' : 'cursor-pointer hover:border-orange-500/50 transition-colors'}`}
                              onClick={() => connected && !isAuthenticating && profilePicInputRef.current?.click()}
                            >
                              {regProfilePicPreview ? (
                                <img src={regProfilePicPreview} alt="Preview" className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="w-6 h-6 text-gray-600" />
                              )}
                            </div>
                            <div className="flex-1">
                              <Button 
                                type="button"
                                variant="outline"
                                disabled={!connected || isAuthenticating}
                                onClick={() => profilePicInputRef.current?.click()}
                                className="bg-black border-white/10 text-gray-300 hover:text-white hover:bg-white/5 rounded-none text-xs tracking-widest h-10"
                              >
                                UPLOAD IMAGE
                              </Button>
                              <input 
                                type="file" 
                                accept="image/*"
                                className="hidden" 
                                ref={profilePicInputRef}
                                onChange={handleProfilePicChange}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-4 pt-4">
                          <Button 
                            type="submit" 
                            disabled={isAuthenticating || !connected} 
                            className="flex-1 bg-white hover:bg-gray-200 text-black text-xs font-bold tracking-widest rounded-none h-12"
                          >
                            {isAuthenticating ? <Loader2 className="w-4 h-4 animate-spin" /> : "REGISTER"}
                          </Button>
                          <Button 
                            type="button" 
                            variant="ghost"
                            disabled={isAuthenticating} 
                            onClick={() => setAuthMode("gateway")}
                            className="flex-1 text-gray-500 hover:text-white hover:bg-transparent text-xs font-bold tracking-widest rounded-none h-12"
                          >
                            CANCEL
                          </Button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="grid lg:grid-cols-12 gap-12">
              <div className="lg:col-span-5 space-y-8">
                <div>
                  <h1 className="text-4xl font-light tracking-tight mb-3 text-white">UPLOAD</h1>
                  <p className="text-gray-400 text-sm leading-relaxed">Bulk upload files onchain — no size limits.</p>
                </div>

                <div className="bg-[#141414] border border-white/10 p-8 space-y-8">
                  {/* ——— Multi-File Drop Zone ——— */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs tracking-widest text-gray-400">FILE SELECTION</label>
                      {files.length > 0 && (
                        <button 
                          onClick={clearAllFiles}
                          className="text-xs tracking-widest text-red-400 hover:text-red-300 transition-colors"
                        >
                          CLEAR ALL
                        </button>
                      )}
                    </div>
                    <div 
                      className={`border border-dashed p-8 text-center transition-all duration-300 ${files.length > 0 ? 'border-orange-500/50 bg-orange-500/5' : 'border-white/10 hover:border-orange-500/30 bg-black hover:bg-white/5 cursor-pointer'}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const droppedFiles = Array.from(e.dataTransfer.files);
                        if (droppedFiles.length > 0) {
                          setFiles(prev => [...prev, ...droppedFiles]);
                          setStep("idle");
                          setErrorMsg("");
                        }
                      }}
                    >
                      <input 
                        type="file" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        multiple
                      />
                      {files.length > 0 ? (
                        <div className="flex flex-col items-center gap-3">
                          <UploadCloud className="w-8 h-8 text-orange-500" />
                          <span className="text-sm font-medium text-white">{files.length} file{files.length > 1 ? 's' : ''} selected</span>
                          <span className="text-xs text-gray-400">Total: {formatFileSize(totalSize)}</span>
                          <span className="text-xs text-gray-500">Click or drop to add more</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <UploadCloud className="w-8 h-8 text-gray-600" />
                          <span className="text-xs tracking-widest font-bold text-gray-300">CLICK OR DROP FILES</span>
                          <span className="text-xs text-gray-500">Select multiple files — any type, any size</span>
                        </div>
                      )}
                    </div>

                    {/* ——— File List ——— */}
                    <AnimatePresence>
                      {files.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2 max-h-48 overflow-y-auto"
                        >
                          {files.map((f, idx) => (
                            <motion.div
                              key={`${f.name}-${idx}-${f.lastModified}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              transition={{ delay: idx * 0.03 }}
                              className="flex items-center justify-between bg-black border border-white/5 px-4 py-3 group hover:border-white/15 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <FileText className="w-4 h-4 text-gray-500 shrink-0" />
                                <span className="text-xs text-gray-300 truncate">{f.name}</span>
                                <span className="text-xs text-gray-600 shrink-0">{formatFileSize(f.size)}</span>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                                className="text-gray-600 hover:text-red-400 transition-colors ml-3 shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ——— Retention Duration ——— */}
                  <div className="space-y-3">
                    <label className="text-xs tracking-widest text-gray-400">RETENTION DURATION</label>
                    <Select 
                      value={retention} 
                      onChange={(e) => setRetention(e.target.value)}
                      className="bg-black border-white/10 text-white focus:ring-orange-500/50 rounded-none h-12"
                      disabled={step !== "idle" && step !== "error"}
                    >
                      {RETENTION_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-black text-white">{opt.label}</option>
                      ))}
                    </Select>
                  </div>

                  {/* ——— Dynamic Pricing Panel ——— */}
                  <AnimatePresence>
                    {files.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 p-6 space-y-4"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-4 h-4 text-orange-400" />
                          <h3 className="text-xs font-bold tracking-widest text-orange-400">ESTIMATED FEE</h3>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Files</span>
                            <span className="text-white font-medium">{files.length} file{files.length > 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Total Size</span>
                            <span className="text-white font-medium">{formatFileSize(totalSize)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Duration</span>
                            <span className="text-white font-medium">{retention === "-1" ? "Permanent (365d)" : `${retention} day${parseInt(retention) > 1 ? 's' : ''}`}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Rate Discount</span>
                            <span className="text-orange-400 font-medium">
                              {(() => {
                                const sm = getSizeMultiplier(totalSize);
                                const dm = getDurationMultiplier(retentionDays === -1 ? 365 : retentionDays);
                                const discount = Math.round((1 - sm * dm) * 100);
                                return discount > 0 ? `-${discount}%` : "Standard";
                              })()}
                            </span>
                          </div>
                          
                          <div className="border-t border-orange-500/20 pt-3 mt-3">
                            <div className="flex justify-between items-baseline">
                              <span className="text-xs tracking-widest text-gray-400">TOTAL</span>
                              <div className="text-right">
                                <span className="text-lg font-light text-white">{estimatedFee.toFixed(6)}</span>
                                <span className="text-xs text-orange-400 ml-1.5">APT</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ——— Upload Button ——— */}
                  <Button 
                    className="w-full bg-orange-500 hover:bg-orange-600 text-black h-12 text-xs font-bold tracking-widest rounded-none transition-all"
                    disabled={files.length === 0 || !connected || (step !== "idle" && step !== "error")}
                    onClick={handleUploadFlow}
                  >
                    {!connected ? "CONNECT WALLET" : files.length === 0 ? "SELECT FILES" : `UPLOAD ${files.length} FILE${files.length > 1 ? 'S' : ''}`}
                  </Button>
                </div>

                {/* ——— Transaction Status ——— */}
                {step !== "idle" && (
                  <div className="bg-[#141414] border border-white/10 p-8">
                    <h3 className="text-xs font-bold tracking-widest text-gray-400 mb-8">TRANSACTION STATUS</h3>
                    <div className="space-y-8 relative">
                      <div className="absolute left-[15px] top-2 bottom-2 w-[1px] bg-white/10" />

                      <StatusStep 
                        title="UPLOAD INITIATION" 
                        description={`Preparing ${files.length} file${files.length > 1 ? 's' : ''} for Shelby testnet.`}
                        status={step === "idle" ? "pending" : step === "initiating" ? "active" : "complete"}
                      />
                      
                      <StatusStep 
                        title="USER APPROVAL" 
                        description="Sign the transaction in your Aptos wallet."
                        status={["idle", "initiating"].includes(step) ? "pending" : step === "approving" ? "active" : "complete"}
                      />
                      
                      <StatusStep 
                        title="TRANSACTION EXECUTION" 
                        description="Finalizing the upload on the blockchain."
                        status={["idle", "initiating", "approving"].includes(step) ? "pending" : step === "executing" ? "active" : step === "success" ? "complete" : step === "error" ? "error" : "pending"}
                      />
                    </div>

                    <AnimatePresence mode="wait">
                      {step === "success" && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-8 p-6 bg-orange-500/10 border border-orange-500/30"
                        >
                          <div className="flex items-start gap-4">
                            <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                            <div className="w-full">
                              <h4 className="text-xs font-bold tracking-widest text-orange-400 mb-2">UPLOAD SUCCESSFUL</h4>
                              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                                {uploadedFileNames.length} file{uploadedFileNames.length > 1 ? 's have' : ' has'} been secured on the Shelby testnet.
                              </p>

                              {/* Transaction Hash Link */}
                              {txHash && (
                                <div className="mb-4 p-3 bg-black border border-orange-500/20">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs tracking-widest text-gray-500">TX HASH</span>
                                  </div>
                                  <a 
                                    href={buildTxExplorerLink(txHash)} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-xs font-mono text-orange-400 hover:text-orange-300 underline break-all flex items-center gap-1.5"
                                  >
                                    {txHash.slice(0, 12)}...{txHash.slice(-10)}
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                  </a>
                                </div>
                              )}

                              {/* Explorer Links per File */}
                              <div className="space-y-2 mb-6 max-h-40 overflow-y-auto">
                                {uploadedFileNames.map((name, i) => {
                                  const explorerUrl = resultUrls[i] || buildExplorerLink(account?.address.toString() || "", name);
                                  return (
                                    <a 
                                      key={i}
                                      href={explorerUrl} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="flex items-center gap-2 text-xs text-gray-300 hover:text-orange-300 transition-colors group"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-gray-500 group-hover:text-orange-400 shrink-0" />
                                      <span className="truncate">{name}</span>
                                      <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-orange-400 shrink-0 ml-auto" />
                                    </a>
                                  );
                                })}
                              </div>
                              <Button 
                                variant="outline" 
                                onClick={resetState}
                                className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/20 bg-transparent rounded-none text-xs tracking-widest h-10"
                              >
                                UPLOAD MORE FILES
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {step === "error" && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-8 p-6 bg-red-500/10 border border-red-500/30"
                        >
                          <div className="flex items-start gap-4">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div className="w-full">
                              <h4 className="text-xs font-bold tracking-widest text-red-400 mb-2">UPLOAD FAILED</h4>
                              <p className="text-xs text-red-400/80 font-medium leading-relaxed mb-4">{errorMsg}</p>
                              <div className="p-3 bg-black border border-red-500/10 mb-6">
                                <p className="text-xs text-gray-500 leading-relaxed">
                                  If you believe this transaction succeeded on-chain, check the{" "}
                                  <a 
                                    href="https://explorer.shelby.xyz/testnet" 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-red-400 hover:text-red-300 underline"
                                  >
                                    Shelby Block Explorer
                                  </a>
                                  {" "}to verify the transaction status.
                                </p>
                              </div>
                              <div className="flex gap-3">
                                <Button 
                                  variant="outline" 
                                  onClick={() => { setStep("idle"); setErrorMsg(""); }}
                                  className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/20 bg-transparent rounded-none text-xs tracking-widest h-10"
                                >
                                  TRY AGAIN
                                </Button>
                                <Button 
                                  variant="outline" 
                                  onClick={() => fetchMyFiles()}
                                  className="flex-1 border-white/10 text-gray-400 hover:bg-white/10 bg-transparent rounded-none text-xs tracking-widest h-10"
                                >
                                  REFRESH FILES
                                </Button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* ——— My Files Panel ——— */}
              <div className="lg:col-span-7">
                <div className="bg-[#141414] border border-white/10 p-8 min-h-[600px]">
                  <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                    <h2 className="text-xs font-bold tracking-widest text-gray-400">MY FILES</h2>
                    <span className="text-xs text-gray-500">{myFiles.length} ITEMS</span>
                  </div>

                  {loadingFiles ? (
                    <div className="flex justify-center py-20">
                      <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                    </div>
                  ) : myFiles.length > 0 ? (
                    <div className="space-y-4">
                      {myFiles.map(f => {
                        const isExpired = f.expirationDate !== -1 && f.expirationDate < Date.now();
                        return (
                          <div key={f.id} className={`bg-black border border-white/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isExpired ? 'opacity-50' : 'hover:border-white/20 transition-colors'}`}>
                            <div className="flex items-center gap-4 overflow-hidden">
                              <div className="w-10 h-10 bg-[#141414] flex items-center justify-center shrink-0 border border-white/5">
                                <FileText className="w-4 h-4 text-gray-500" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-sm font-medium text-white truncate">{f.blobName}</h3>
                                <div className="flex gap-3 text-xs text-gray-500 mt-1">
                                  <span>{formatFileSize(f.size)}</span>
                                  <span>•</span>
                                  <span>{new Date(f.uploadDate).toLocaleDateString()}</span>
                                  {f.expirationDate !== -1 && (
                                    <>
                                      <span>•</span>
                                      <span className={isExpired ? "text-red-400" : "text-orange-400"}>
                                        {isExpired ? "Expired" : `Expires ${new Date(f.expirationDate).toLocaleDateString()}`}
                                      </span>
                                    </>
                                  )}
                                  {f.expirationDate === -1 && (
                                    <>
                                      <span>•</span>
                                      <span className="text-orange-400">Permanent</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <Button 
                              onClick={() => handleDownload(f)}
                              className={`shrink-0 rounded-none text-xs tracking-widest font-bold h-10 px-6 ${isExpired ? 'bg-[#141414] text-gray-600 hover:bg-[#141414] cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200'}`}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              {isExpired ? "EXPIRED" : "DOWNLOAD"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-32 text-gray-500 border border-dashed border-white/5 bg-black">
                      <FileText className="w-8 h-8 mx-auto mb-4 opacity-20" />
                      <p className="text-xs tracking-widest">NO FILES UPLOADED YET.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function StatusStep({ title, description, status }: { title: string, description: string, status: "pending" | "active" | "complete" | "error" }) {
  return (
    <div className="relative flex gap-5">
      <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border shrink-0 bg-[#141414] transition-colors duration-300
        ${status === "complete" ? "border-orange-500 text-orange-500" : 
          status === "active" ? "border-orange-400 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]" : 
          status === "error" ? "border-red-500 text-red-500" :
          "border-white/10 text-gray-600"}`}
      >
        {status === "complete" ? <CheckCircle2 className="w-4 h-4" /> : 
         status === "active" ? <Loader2 className="w-4 h-4 animate-spin" /> : 
         status === "error" ? <AlertCircle className="w-4 h-4" /> :
         <div className="w-2 h-2 rounded-full bg-white/10" />}
      </div>
      <div className="pt-1.5">
        <h4 className={`text-xs font-bold tracking-widest transition-colors duration-300
          ${status === "complete" ? "text-orange-500" : 
            status === "active" ? "text-orange-400" : 
            status === "error" ? "text-red-500" :
            "text-gray-500"}`}
        >
          {title}
        </h4>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
