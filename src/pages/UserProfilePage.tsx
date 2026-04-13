import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { UserProfile } from "../contexts/AuthContext";
import { Loader2, AlertCircle, ArrowLeft, ShieldAlert, FileText, Download, Edit2, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useUploadBlobs, useAccountBlobs } from "@shelby-protocol/react";
import { useRef } from "react";

const SHELBY_API_BASE = "https://api.testnet.shelby.xyz/shelby/v1/blobs";
const INDEXER_URL = "https://api.testnet.aptoslabs.com/v1/graphql";

// Normalize any Aptos address to full 66-char lowercase hex (0x + 64 chars)
// Pure JS - no SDK dependency
function normalizeAddress(addr: string): string {
  let hex = addr.toLowerCase().trim();
  if (hex.startsWith("0x")) hex = hex.slice(2);
  return "0x" + hex.padStart(64, "0");
}

interface FileData {
  id: string;
  uploaderId: string;
  blobName: string;
  url: string;
  size: number;
  uploadDate: number;
  expirationDate: number;
}

export default function UserProfilePage() {
  const { userId: rawUserId } = useParams<{ userId: string }>();
  const userId = rawUserId ? normalizeAddress(rawUserId) : undefined;
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const normalizedWalletAddr = account ? normalizeAddress(account.address.toString()) : "";
  const isOwner = connected && normalizedWalletAddr === userId;
  // My Files — powered by Shelby SDK's useAccountBlobs
  // This queries the Shelby indexer directly, so ALL uploaded blobs appear
  const { data: accountBlobs, isLoading: loadingFiles } = useAccountBlobs({
    account: userId ?? '',
    enabled: !!userId && isOwner,
  });

  // Map BlobMetadata[] from the SDK to our FileData[] for display
  // Filter out internal blobs (files.json, profile pics)
  const myFiles: FileData[] = useMemo(() => {
    if (!accountBlobs || !userId) return [];
    return accountBlobs
      .filter(blob => {
        const suffix = blob.blobNameSuffix;
        if (suffix === 'files.json') return false;
        if (suffix.startsWith('profile_pic')) return false;
        if (blob.isDeleted) return false;
        return true;
      })
      .map(blob => ({
        id: `${userId}_${blob.creationMicros}_${blob.blobNameSuffix}`,
        uploaderId: userId,
        blobName: blob.blobNameSuffix,
        url: `${SHELBY_API_BASE}/${userId}/${encodeURIComponent(blob.blobNameSuffix)}`,
        size: blob.size,
        uploadDate: Math.floor(blob.creationMicros / 1000),
        expirationDate: blob.expirationMicros === 0 ? -1 : Math.floor(blob.expirationMicros / 1000),
      }));
  }, [accountBlobs, userId]);

  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editProfilePicFile, setEditProfilePicFile] = useState<File | null>(null);
  const [editProfilePicPreview, setEditProfilePicPreview] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const uploadProfilePic = useUploadBlobs({});

  // FIX #3: Add retry logic for indexer queries + fetch collection_id
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      
      const query = `
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

      // Retry up to 3 times for indexer consistency
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(INDEXER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query,
              variables: { 
                creatorAddress: userId,
                collectionName: "CircleProfile" 
              }
            })
          });
          
          const resData = await res.json();
          const collections = resData.data?.current_collections_v2 || [];
          const collection = collections[0];
          
          if (collection) {
            try {
              const data = JSON.parse(collection.description || "{}");
              const p: UserProfile = { 
                ...data, 
                walletAddress: userId,
                collectionId: collection.collection_id,
                profilePictureUrl: data.profilePictureUrl || (collection.uri !== "https://circle.storage/profile" ? collection.uri : "")
              };
              setProfile(p);
              setEditUsername(p.username);
              setEditFullName(p.fullName);
              setEditProfilePicPreview(p.profilePictureUrl);
              setLoading(false);
              return; // Success, exit retry loop
            } catch (e) {
              const p: UserProfile = {
                username: collection.description || "Unknown",
                fullName: "Unknown",
                walletAddress: userId,
                collectionId: collection.collection_id,
                profilePictureUrl: collection.uri !== "https://circle.storage/profile" ? collection.uri : "",
                createdAt: Date.now()
              };
              setProfile(p);
              setEditUsername(p.username);
              setEditFullName(p.fullName);
              setEditProfilePicPreview(p.profilePictureUrl);
              setLoading(false);
              return; // Success, exit retry loop
            }
          }
        } catch (error) {
          console.error(`Profile fetch attempt ${attempt + 1} failed:`, error);
        }
        
        // Wait before retrying (except on last attempt)
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
      
      // All retries exhausted
      setLoading(false);
    };
    fetchData();
  }, [userId]);

  // Build the correct blob download URL from address + filename
  // Never trust the stored `url` field — older records have explorer URLs
  const getBlobUrl = (f: FileData) => {
    const addr = f.uploaderId || userId || '';
    return `${SHELBY_API_BASE}/${addr}/${encodeURIComponent(f.blobName)}`;
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditProfilePicFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setEditProfilePicPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // FIX #2: Correct typeArguments and functionArguments for set_collection_description
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !signAndSubmitTransaction || !profile) return;
    
    setIsSaving(true);
    setEditError("");
    
    try {
      let profilePicUrl = profile.profilePictureUrl;
      
      if (editProfilePicFile) {
        let arrayBuffer = await editProfilePicFile.arrayBuffer();
        let fileData = new Uint8Array(arrayBuffer);
        
        if (fileData.length < 1024) {
          const paddedData = new Uint8Array(1024);
          paddedData.set(fileData);
          fileData = paddedData;
        }
        
        const blobName = `profile_${Date.now()}_${editProfilePicFile.name}`;
        const encodedBlobName = encodeURIComponent(blobName);
        profilePicUrl = `${SHELBY_API_BASE}/${account.address.toString()}/${encodedBlobName}`;
        
        await uploadProfilePic.mutateAsync({
          signer: { account: account.address.toString(), signAndSubmitTransaction },
          blobs: [
            { blobName, blobData: fileData }
          ],
          expirationMicros: Date.now() * 1000 + 365 * 86400000000 // 1 year
        });
      }

      const profileData = {
        username: editUsername,
        fullName: editFullName,
        profilePictureUrl: profilePicUrl,
        createdAt: profile.createdAt
      };
      
      const descriptionString = JSON.stringify(profileData);
      if (new TextEncoder().encode(descriptionString).length > 2048) {
        setEditError("Profile metadata is too large.");
        setIsSaving(false);
        return;
      }
      
      // FIX #2: Use correct type argument and collection object address
      const payload = {
        data: {
          function: "0x4::aptos_token::set_collection_description",
          typeArguments: ["0x4::aptos_token::AptosCollection"],
          functionArguments: [
            profile.collectionId, // collection object address (not name string)
            descriptionString // new description
          ]
        }
      };

      await signAndSubmitTransaction(payload as any);
      
      setProfile({ ...profile, ...profileData });
      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      setEditError(err.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-light mb-4 tracking-tight">PROFILE NOT FOUND</h2>
        <p className="text-gray-400 text-sm mb-8 max-w-md">
          We could not find a decentralized profile associated with the address <span className="font-mono text-xs text-orange-500 break-all">{userId}</span> on the Shelby testnet.
        </p>
        <Link to="/directory">
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/10 rounded-none tracking-widest text-xs">
            RETURN TO LOOKUP
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between mb-16 border-b border-white/10 pb-6">
          <div className="flex items-center gap-6">
            <Link to="/directory" className="text-gray-500 hover:text-white transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div className="text-xs font-bold tracking-widest text-gray-400">USER PROFILE</div>
          </div>
          {isOwner && !isEditing && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsEditing(true)}
              className="border-white/10 text-gray-400 hover:text-white hover:bg-white/10 bg-transparent rounded-none text-xs tracking-widest"
            >
              <Edit2 className="w-3 h-3 mr-2" />
              EDIT PROFILE
            </Button>
          )}
        </header>

        {isEditing ? (
          <div className="bg-[#141414] border border-white/10 p-8 md:p-12 mb-8">
            <h2 className="text-xl font-light tracking-tight text-white mb-6">EDIT PROFILE</h2>
            {editError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium tracking-widest uppercase">
                {editError}
              </div>
            )}
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs tracking-widest text-gray-400">PROFILE PICTURE</label>
                <div className="flex items-center gap-4">
                  <div 
                    className={`w-20 h-20 shrink-0 rounded-full border border-white/10 flex items-center justify-center overflow-hidden bg-black ${isSaving ? 'opacity-50' : 'cursor-pointer hover:border-orange-500/50 transition-colors'}`}
                    onClick={() => !isSaving && profilePicInputRef.current?.click()}
                  >
                    {editProfilePicPreview ? (
                      <img src={editProfilePicPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Button 
                      type="button"
                      variant="outline"
                      disabled={isSaving}
                      onClick={() => profilePicInputRef.current?.click()}
                      className="bg-black border-white/10 text-gray-300 hover:text-white hover:bg-white/5 rounded-none text-xs tracking-widest h-10"
                    >
                      UPLOAD NEW IMAGE
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
              <div className="space-y-3">
                <label className="text-xs tracking-widest text-gray-400">USERNAME</label>
                <Input 
                  value={editUsername} 
                  onChange={(e) => setEditUsername(e.target.value)} 
                  className="bg-black border-white/10 rounded-none focus-visible:ring-orange-500 h-12" 
                  required 
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs tracking-widest text-gray-400">FULL NAME</label>
                <Input 
                  value={editFullName} 
                  onChange={(e) => setEditFullName(e.target.value)} 
                  className="bg-black border-white/10 rounded-none focus-visible:ring-orange-500 h-12" 
                  required 
                  disabled={isSaving}
                />
              </div>
              <div className="flex gap-4 pt-4">
                <Button 
                  type="submit" 
                  disabled={isSaving} 
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-black text-xs font-bold tracking-widest rounded-none h-12"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "SAVE CHANGES"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  disabled={isSaving} 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 border-white/10 text-gray-400 hover:text-white hover:bg-white/10 bg-transparent rounded-none text-xs tracking-widest h-12"
                >
                  CANCEL
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-[#141414] border border-white/10 p-8 md:p-12 flex flex-col md:flex-row items-center md:items-start gap-8 mb-8">
            <div className="w-32 h-32 shrink-0 rounded-full overflow-hidden border border-white/10 bg-black">
              <img 
                src={profile.profilePictureUrl || "https://picsum.photos/seed/user/100/100"} 
                alt={profile.username} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`;
                }}
              />
            </div>
            <div className="text-center md:text-left flex-1 min-w-0">
              <h1 className="text-3xl md:text-4xl font-light tracking-tight text-white mb-2 truncate">{profile.fullName}</h1>
              <p className="text-sm text-orange-500 tracking-widest uppercase mb-6 truncate">@{profile.username}</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-white/5">
                <div className="min-w-0">
                  <div className="text-xs tracking-widest text-gray-500 mb-1">WALLET ADDRESS</div>
                  <div className="text-sm font-mono text-gray-300 truncate">
                    {profile.walletAddress}
                  </div>
                </div>
                <div>
                  <div className="text-xs tracking-widest text-gray-500 mb-1">JOINED</div>
                  <div className="text-sm text-gray-300">
                    {new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isOwner ? (
          <div className="bg-[#141414] border border-white/10 p-8">
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
                            <span>{(f.size / 1024).toFixed(2)} KB</span>
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
                      
                      {isExpired ? (
                        <Button 
                          disabled
                          className="shrink-0 rounded-none text-xs tracking-widest font-bold h-10 px-6 bg-[#141414] text-gray-600 hover:bg-[#141414] cursor-not-allowed"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          EXPIRED
                        </Button>
                      ) : (
                        <a 
                          href={getBlobUrl(f)} 
                          target="_blank" 
                          rel="noreferrer"
                          className="shrink-0 rounded-none text-xs tracking-widest font-bold h-10 px-6 bg-white text-black hover:bg-gray-200 inline-flex items-center justify-center"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          DOWNLOAD
                        </a>
                      )}
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
        ) : (
          <div className="bg-black border border-dashed border-white/10 p-8 text-center">
            <ShieldAlert className="w-8 h-8 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xs font-bold tracking-widest text-gray-400 mb-2">RESTRICTED ACCESS</h3>
            <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
              For privacy and security reasons, user files are strictly confidential and cannot be viewed publicly. Only the authenticated owner has access to their stored data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
