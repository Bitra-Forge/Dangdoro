"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
    X, Link2, CheckCircle2, Copy, Zap, 
    Users, Search, Check, Mail, Send 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { buildInviteLink, generateInviteToken } from "@/lib/groups";

export function InviteModal({ group, user, friends, onClose }: any) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
    const [sending, setSending] = useState(false);
    const [copied, setCopied] = useState(false);
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);
    
    const inviteLink = group.inviteToken ? buildInviteLink(group.inviteToken) : null;
    
    const nonMemberFriends = friends.filter((f: any) => f.userData && !group.members.includes(f.friendId));
    const filtered = searchTerm 
        ? nonMemberFriends.filter((f: any) => (f.userData?.displayName || "").toLowerCase().includes(searchTerm.toLowerCase()))
        : nonMemberFriends;

    const toggleFriend = (uid: string) => {
        setSelectedFriends(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
    };

    const handleCopyLink = () => {
        if (!inviteLink) return;
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Invite link copied!");
    };

    const handleRegenerateToken = async () => {
        const newToken = generateInviteToken();
        await updateDoc(doc(db, "focusGroups", group.id), { inviteToken: newToken });
        toast.success("New invite link generated");
    };

    const handleSendInvites = async () => {
        if (!selectedFriends.length) return;
        setSending(true);
        try {
            await updateDoc(doc(db, "focusGroups", group.id), {
                pendingInvites: arrayUnion(...selectedFriends)
            });
            toast.success(`Invited ${selectedFriends.length} friend${selectedFriends.length > 1 ? "s" : ""}!`);
            setSelectedFriends([]);
        } catch (e) {
            toast.error("Failed to send invites");
        }
        setSending(false);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className={cn("relative w-full max-w-lg border border-white/10 rounded-3xl shadow-2xl overflow-hidden", settingsGlassmorphism ? "bg-zinc-900/80 backdrop-blur-md" : "bg-zinc-900")}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-white">Invite to {group.name}</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">Pick friends or share an invite link</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-zinc-500 transition-all"><X className="w-4 h-4" /></button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Invite Link section */}
                    {(group.privacy === "private-invite" || group.privacy === "public") && (
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest flex items-center gap-2">
                                <Link2 className="w-3.5 h-3.5" /> Invite Link
                            </p>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 flex items-center overflow-hidden">
                                    <span className="text-xs text-zinc-500 truncate font-mono">
                                        {inviteLink ?? "No invite link yet"}
                                    </span>
                                </div>
                                <button onClick={handleCopyLink} disabled={!inviteLink} className={cn("px-4 py-3 rounded-xl border font-black text-xs transition-all flex items-center gap-2", copied ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-white hover:bg-white/10")}>
                                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copied ? "Copied!" : "Copy"}
                                </button>
                            </div>
                            {group.hostId === user.uid && (
                                <button onClick={handleRegenerateToken} className="text-[10px] text-zinc-600 hover:text-zinc-400 font-bold uppercase tracking-wider transition-all flex items-center gap-1.5">
                                    <Zap className="w-3 h-3" /> Regenerate link (invalidates old one)
                                </button>
                            )}
                        </div>
                    )}

                    {/* Friend picker */}
                    {nonMemberFriends.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest flex items-center gap-2">
                                <Users className="w-3.5 h-3.5" /> Invite Friends
                            </p>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search friends..." className="w-full bg-zinc-950 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-white/15 transition-all" />
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                {filtered.map((f: any) => {
                                    const isSelected = selectedFriends.includes(f.friendId);
                                    const isPending = group.pendingInvites?.includes(f.friendId);
                                    return (
                                        <button key={f.friendId} onClick={() => !isPending && toggleFriend(f.friendId)} disabled={isPending} className={cn("w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left", isSelected ? "bg-violet-500/15 border-violet-500/30" : isPending ? "bg-zinc-900/60 border-white/5 opacity-60 cursor-default" : "bg-zinc-900/40 border-white/5 hover:border-white/10")}>
                                            <Avatar className="w-9 h-9 border border-white/10">
                                                <AvatarImage src={f.userData?.photoURL} />
                                                <AvatarFallback>{f.userData?.displayName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{f.userData?.displayName}</p>
                                                {isPending && <p className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">Invite pending</p>}
                                            </div>
                                            {isSelected && <Check className="w-4 h-4 text-violet-400 shrink-0" />}
                                            {isPending && <Mail className="w-4 h-4 text-violet-400/50 shrink-0" />}
                                        </button>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <p className="text-center py-6 text-xs text-zinc-600 font-bold uppercase tracking-wider">
                                        {searchTerm ? "No matching friends" : "All friends are already members"}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {selectedFriends.length > 0 && (
                    <div className="p-4 border-t border-white/5 flex gap-3">
                        <button onClick={handleSendInvites} disabled={sending} className="flex-1 py-3 bg-violet-500 text-white font-black rounded-xl text-sm hover:bg-violet-400 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            <Send className="w-4 h-4" />
                            {sending ? "Sending..." : `Invite ${selectedFriends.length} friend${selectedFriends.length > 1 ? "s" : ""}`}
                        </button>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
