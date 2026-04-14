"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BackgroundTheme } from "@/components/background-theme";
import { AuthRequired } from "@/components/auth-required";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Space_Grotesk } from "next/font/google";
import { cn } from "@/lib/utils";
import {
    UserPlus, X, Search, Users, Clock, Trophy, LogOut, Check,
    Hourglass, Plus, Play, StopCircle, UserCheck, Sparkles,
    Timer, Target, Zap, Settings, Lock, Globe, Copy, Key,
    ListTodo, ChevronRight, Trash2, Edit2, Shield, UserX
} from "lucide-react";
import {
    sendFriendRequest, acceptFriendRequest, declineFriendRequest,
    removeFriend, cancelFriendRequest, getReceivedFriendRequests,
    getSentFriendRequests, getFriendsList, searchUsers,
    subscribeToReceivedFriendRequests, subscribeToFriendsList
} from "@/lib/friendship";
import { toast } from "sonner";
import { doc, setDoc, onSnapshot, deleteDoc, collection, serverTimestamp, updateDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-space-grotesk",
    weight: ["300", "400", "500", "600", "700"],
});

type Tab = "groups" | "friends" | "requests" | "search";

interface FocusGroup {
    id: string;
    name: string;
    description: string;
    hostId: string;
    hostName: string;
    members: string[];
    memberDetails?: any[];
    startTime: any;
    status: "active" | "paused" | "idle";
    maxMembers?: number;
    privacy: "public" | "private" | "code";
    accessCode?: string;
    sharedTasks: any[];
    createdAt: any;
}

interface SharedTask {
    id: string;
    title: string;
    description: string;
    assignedTo: string;
    assignedName: string;
    status: "todo" | "in-progress" | "done";
    createdBy: string;
    createdAt: any;
    priority: "low" | "medium" | "high";
}

export default function FriendsPage() {
    const { user, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>("groups");
    const [friends, setFriends] = useState<any[]>([]);
    const [receivedRequests, setReceivedRequests] = useState<any[]>([]);
    const [sentRequests, setSentRequests] = useState<any[]>([]);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [focusGroups, setFocusGroups] = useState<FocusGroup[]>([]);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupDesc, setNewGroupDesc] = useState("");
    const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
    const [privacy, setPrivacy] = useState<"public" | "private" | "code">("private");
    const [showGroupSettings, setShowGroupSettings] = useState<string | null>(null);
    const [showSharedTasks, setShowSharedTasks] = useState<string | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");

    // Subscribe to real-time updates
    useEffect(() => {
        if (!user) return;

        const unsubFriends = subscribeToFriendsList(user.uid, (friendsData) => {
            setFriends(friendsData);
            setLoading(false);
        });

        const unsubRequests = subscribeToReceivedFriendRequests(user.uid, (requests) => {
            setReceivedRequests(requests);
        });

        const loadSentRequests = async () => {
            const sent = await getSentFriendRequests(user.uid);
            setSentRequests(sent);
        };
        loadSentRequests();

        // Subscribe to focus groups
        const unsubGroups = onSnapshot(collection(db, "focusGroups"), async (snapshot) => {
            const groups: FocusGroup[] = [];
            snapshot.forEach(docSnapshot => {
                const data = docSnapshot.data();
                groups.push({
                    id: docSnapshot.id,
                    ...data
                } as FocusGroup);
            });

            // Enrich with member details
            for (const group of groups) {
                const memberDetails: any[] = [];
                for (const memberId of group.members) {
                    const friend = friends.find(f => f.friendId === memberId);
                    if (memberId === user.uid) {
                        memberDetails.push({
                            uid: user.uid,
                            displayName: user.displayName,
                            photoURL: user.photoURL,
                            isHost: group.hostId === user.uid
                        });
                    } else if (friend?.userData) {
                        memberDetails.push({
                            ...friend.userData,
                            isHost: group.hostId === memberId
                        });
                    }
                }
                group.memberDetails = memberDetails;
            }

            setFocusGroups(groups);
        });

        return () => {
            unsubFriends();
            unsubRequests();
            unsubGroups();
        };
    }, [user, friends]);

    const handleSendRequest = async (toUserId: string, displayName: string) => {
        if (!user) return;
        const success = await sendFriendRequest(user.uid, toUserId);
        if (success) {
            toast.success(`Friend request sent to ${displayName}`);
            const sent = await getSentFriendRequests(user.uid);
            setSentRequests(sent);
        } else {
            toast.error("Failed to send friend request");
        }
    };

    const handleAcceptRequest = async (requestId: string, fromUserId: string) => {
        const success = await acceptFriendRequest(requestId, fromUserId, user!.uid);
        if (success) {
            toast.success("Friend request accepted!");
            setReceivedRequests(prev => prev.filter(r => r.id !== requestId));
        } else {
            toast.error("Failed to accept request");
        }
    };

    const handleDeclineRequest = async (requestId: string) => {
        const success = await declineFriendRequest(requestId);
        if (success) {
            toast.info("Friend request declined");
            setReceivedRequests(prev => prev.filter(r => r.id !== requestId));
        } else {
            toast.error("Failed to decline request");
        }
    };

    const handleRemoveFriend = async (friendId: string) => {
        if (!user) return;
        const success = await removeFriend(user.uid, friendId);
        if (success) toast.success("Friend removed");
        else toast.error("Failed to remove friend");
    };

    const handleCancelRequest = async (requestId: string) => {
        const success = await cancelFriendRequest(requestId);
        if (success) {
            toast.info("Friend request canceled");
            setSentRequests(prev => prev.filter(r => r.id !== requestId));
        } else {
            toast.error("Failed to cancel request");
        }
    };

    const handleSearch = async () => {
        if (!user || !searchQuery.trim()) return;
        setSearching(true);
        const results = await searchUsers(searchQuery, user.uid);
        setSearchResults(results);
        setSearching(false);
    };

    const generateAccessCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    };

    const handleCreateGroup = async () => {
        if (!user || !newGroupName.trim()) return;

        const accessCode = privacy === "code" ? generateAccessCode() : undefined;

        const groupRef = doc(collection(db, "focusGroups"));
        const groupData: any = {
            name: newGroupName,
            description: newGroupDesc,
            hostId: user.uid,
            hostName: user.displayName || "Host",
            members: [user.uid, ...selectedFriends],
            startTime: serverTimestamp(),
            status: "idle",
            maxMembers: 20,
            privacy,
            sharedTasks: [],
            createdAt: serverTimestamp()
        };

        if (accessCode) {
            groupData.accessCode = accessCode;
        }

        await setDoc(groupRef, groupData);

        toast.success(`Focus group "${newGroupName}" created!`);
        setNewGroupName("");
        setNewGroupDesc("");
        setSelectedFriends([]);
        setShowCreateGroup(false);
    };

    const handleDeleteGroup = async (groupId: string) => {
        const group = focusGroups.find(g => g.id === groupId);
        if (!group || group.hostId !== user?.uid) {
            toast.error("Only the host can delete this group");
            return;
        }

        await deleteDoc(doc(db, "focusGroups", groupId));
        toast.success("Group deleted");
        setShowGroupSettings(null);
    };

    const handleLeaveGroup = async (groupId: string) => {
        if (!user) return;

        const group = focusGroups.find(g => g.id === groupId);
        if (!group) return;

        const groupRef = doc(db, "focusGroups", groupId);
        const newMembers = group.members.filter(m => m !== user.uid);

        if (newMembers.length === 0) {
            await deleteDoc(groupRef);
        } else {
            // Transfer host to first remaining member if current host leaves
            const newHostId = group.hostId === user.uid ? newMembers[0] : group.hostId;
            const newHost = newHostId === user.uid ? undefined : 
                newMembers.find(m => m === newHostId) ? 
                (newHostId === user.uid ? user.displayName : friends.find(f => f.friendId === newHostId)?.userData?.displayName) : "Unknown";
            
            await updateDoc(groupRef, {
                members: newMembers,
                ...(group.hostId === user.uid && { hostId: newHostId, hostName: newHost })
            });
        }

        toast.info("Left focus group");
    };

    const handleStartGroup = async (groupId: string) => {
        const groupRef = doc(db, "focusGroups", groupId);
        await updateDoc(groupRef, { status: "active", startTime: serverTimestamp() });
        toast.success("Focus session started!");
    };

    const handlePauseGroup = async (groupId: string) => {
        const groupRef = doc(db, "focusGroups", groupId);
        await updateDoc(groupRef, { status: "paused" });
        toast.info("Focus session paused");
    };

    const handleAddSharedTask = async (groupId: string) => {
        if (!newTaskTitle.trim()) return;

        const taskRef = doc(collection(db, "focusGroups", groupId, "tasks"));
        await setDoc(taskRef, {
            title: newTaskTitle,
            description: newTaskDesc,
            assignedTo: user!.uid,
            assignedName: user!.displayName,
            status: "todo",
            createdBy: user!.uid,
            createdAt: serverTimestamp(),
            priority: "medium"
        });

        toast.success("Task added!");
        setNewTaskTitle("");
        setNewTaskDesc("");
    };

    const handleUpdateTaskStatus = async (groupId: string, taskId: string, status: string) => {
        const taskRef = doc(db, "focusGroups", groupId, "tasks", taskId);
        await updateDoc(taskRef, { status });
        toast.success("Task updated");
    };

    const handleDeleteTask = async (groupId: string, taskId: string) => {
        const taskRef = doc(db, "focusGroups", groupId, "tasks", taskId);
        await deleteDoc(taskRef);
        toast.info("Task deleted");
    };

    const handleRegenerateCode = async (groupId: string) => {
        const newCode = generateAccessCode();
        const groupRef = doc(db, "focusGroups", groupId);
        await updateDoc(groupRef, { accessCode: newCode });
        toast.success("New access code generated");
    };

    const handleRemoveMember = async (groupId: string, memberId: string) => {
        const group = focusGroups.find(g => g.id === groupId);
        if (!group || group.hostId !== user?.uid) {
            toast.error("Only the host can remove members");
            return;
        }

        if (memberId === user.uid) {
            toast.error("You can't remove yourself");
            return;
        }

        const groupRef = doc(db, "focusGroups", groupId);
        await updateDoc(groupRef, {
            members: group.members.filter(m => m !== memberId)
        });
        toast.success("Member removed");
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-12 h-12 border-4 border-[#C9B037]/20 border-t-[#C9B037] rounded-full animate-spin" />
            </div>
        );
    }

    if (!user || user.isAnonymous) {
        return (
            <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#C9B037]/10 rounded-full blur-[120px] pointer-events-none" />
                <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                    <AuthRequired title="Groups Locked" description="Sign in to create focus groups and work together with friends." />
                </main>
            </div>
        );
    }

    const userGroups = focusGroups.filter(g => g.members.includes(user.uid));
    const publicGroups = focusGroups.filter(g => g.privacy === "public" && !g.members.includes(user.uid));

    return (
        <BackgroundTheme>
            <div className={cn(
                "relative min-h-screen bg-zinc-950 flex flex-col pt-16 overflow-x-hidden",
                spaceGrotesk.variable, "font-sans"
            )} style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-zinc-900/40 to-transparent pointer-events-none" />

                <main className="relative z-10 flex flex-col items-center pb-48 px-4 w-full flex-1 max-w-6xl mx-auto">
                    {/* Header */}
                    <header className="flex flex-col items-center text-center mb-12 w-full">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-[1px] bg-zinc-900/50" />
                            <span className="text-[10px] font-black tracking-[0.4em] text-zinc-600 uppercase">Focus Together</span>
                            <div className="w-12 h-[1px] bg-zinc-900/50" />
                        </div>

                        <div className="flex items-center gap-8 w-full justify-center">
                            <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-r from-transparent via-zinc-800 to-transparent shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
                            <h1 className="text-3xl md:text-5xl font-bold text-white text-center font-sans drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]">
                                Focus Groups
                            </h1>
                            <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-l from-transparent via-zinc-800 to-transparent shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
                        </div>
                    </header>

                    {/* Tabs */}
                    <div className="flex items-center gap-2 p-2 bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl mb-8 w-full max-w-2xl">
                        {[
                            { id: "groups" as Tab, label: "Groups", icon: Users, count: userGroups.length },
                            { id: "friends" as Tab, label: "Friends", icon: UserCheck, count: friends.length },
                            { id: "requests" as Tab, label: "Requests", icon: UserPlus, count: receivedRequests.length },
                            { id: "search" as Tab, label: "Search", icon: Search, count: null },
                        ].map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn(
                                    "relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 flex-1 justify-center",
                                    isActive ? "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                                )}>
                                    <Icon className="w-5 h-5" />
                                    <span className="text-xs font-bold tracking-wide">{tab.label}</span>
                                    {tab.count !== null && tab.count > 0 && (
                                        <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold">{tab.count}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Content */}
                    <div className="w-full max-w-4xl">
                        {/* Groups Tab */}
                        {activeTab === "groups" && (
                            <div className="space-y-6">
                                {/* Create Group Button */}
                                <button onClick={() => setShowCreateGroup(!showCreateGroup)} className="w-full p-4 rounded-[1rem] bg-zinc-800/40 border border-white/15 hover:bg-zinc-800/60 hover:border-white/25 transition-all duration-300 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-[#C9B037]/20 flex items-center justify-center">
                                        <Plus className="w-6 h-6 text-[#C9B037]" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-zinc-300">Create Focus Group</p>
                                        <p className="text-xs text-zinc-600">Start a shared focus session with friends</p>
                                    </div>
                                </button>

                                {/* Create Group Modal */}
                                {showCreateGroup && (
                                    <div className="p-6 rounded-[1rem] bg-zinc-800/60 border border-white/20 space-y-4">
                                        <h3 className="text-lg font-bold text-white">New Focus Group</h3>
                                        <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Group name (e.g., Morning Focus)" className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 outline-none text-sm" />
                                        <textarea value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 outline-none text-sm resize-none" />
                                        
                                        {/* Privacy Settings */}
                                        <div>
                                            <p className="text-xs text-zinc-500 mb-2">Privacy:</p>
                                            <div className="flex gap-2">
                                                {[
                                                    { id: "private" as const, label: "Private", icon: Lock, desc: "Invite only" },
                                                    { id: "public" as const, label: "Public", icon: Globe, desc: "Anyone can join" },
                                                    { id: "code" as const, label: "Access Code", icon: Key, desc: "Join with code" },
                                                ].map(p => {
                                                    const Icon = p.icon;
                                                    const isSelected = privacy === p.id;
                                                    return (
                                                        <button key={p.id} onClick={() => setPrivacy(p.id)} className={cn(
                                                            "flex-1 p-3 rounded-xl border transition-all text-left",
                                                            isSelected ? "bg-[#C9B037]/20 border-[#C9B037]/40" : "bg-zinc-900/30 border-white/5 hover:border-white/10"
                                                        )}>
                                                            <Icon className={cn("w-4 h-4 mb-1", isSelected ? "text-[#C9B037]" : "text-zinc-500")} />
                                                            <p className={cn("text-xs font-bold", isSelected ? "text-[#C9B037]" : "text-zinc-400")}>{p.label}</p>
                                                            <p className="text-[10px] text-zinc-600">{p.desc}</p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Invite Friends */}
                                        <div>
                                            <p className="text-xs text-zinc-500 mb-2">Invite friends (optional):</p>
                                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                                {friends.map(friend => {
                                                    const userData = friend.userData;
                                                    if (!userData) return null;
                                                    const isSelected = selectedFriends.includes(friend.friendId);
                                                    return (
                                                        <button key={friend.friendId} onClick={() => {
                                                            setSelectedFriends(prev => isSelected ? prev.filter(id => id !== friend.friendId) : [...prev, friend.friendId]);
                                                        }} className={cn(
                                                            "w-full flex items-center gap-3 p-3 rounded-lg transition-all",
                                                            isSelected ? "bg-[#C9B037]/20 border border-[#C9B037]/30" : "bg-zinc-900/30 border border-white/5 hover:border-white/10"
                                                        )}>
                                                            <div className="w-8 h-8 rounded-full overflow-hidden">
                                                                <Avatar className="w-full h-full">
                                                                    <AvatarImage src={userData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.uid}`} />
                                                                    <AvatarFallback className="text-xs">{userData.displayName?.slice(0, 1)}</AvatarFallback>
                                                                </Avatar>
                                                            </div>
                                                            <span className="text-sm text-zinc-300">{userData.displayName}</span>
                                                            {isSelected && <Check className="w-4 h-4 ml-auto text-[#C9B037]" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="flex gap-3">
                                            <button onClick={handleCreateGroup} disabled={!newGroupName.trim()} className="flex-1 px-6 py-3 bg-[#C9B037]/20 hover:bg-[#C9B037]/30 disabled:opacity-50 disabled:cursor-not-allowed text-[#C9B037] rounded-xl transition-all duration-300 font-bold text-sm">Create Group</button>
                                            <button onClick={() => setShowCreateGroup(false)} className="px-6 py-3 bg-zinc-700/30 hover:bg-zinc-700/50 text-zinc-400 rounded-xl transition-all duration-300 font-bold text-sm">Cancel</button>
                                        </div>
                                    </div>
                                )}

                                {/* My Groups */}
                                {userGroups.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                            <Timer className="w-5 h-5 text-[#C9B037]" />
                                            Your Groups
                                        </h3>
                                        <div className="space-y-4">
                                            {userGroups.map(group => {
                                                const isHost = group.hostId === user.uid;
                                                const memberCount = group.members.length;
                                                const isActive = group.status === "active";
                                                const isPrivate = group.privacy === "private";

                                                return (
                                                    <div key={group.id} className="group relative p-5 rounded-[1rem] bg-zinc-800/40 border border-white/15 hover:bg-zinc-800/60 hover:border-white/25 transition-all duration-300">
                                                        {/* Header */}
                                                        <div className="flex items-start justify-between mb-4">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h4 className="text-base font-bold text-white">{group.name}</h4>
                                                                    {isPrivate ? <Lock className="w-3 h-3 text-zinc-500" /> : <Globe className="w-3 h-3 text-green-400" />}
                                                                </div>
                                                                {group.description && <p className="text-xs text-zinc-500 mb-2">{group.description}</p>}
                                                                <p className="text-xs text-zinc-600">Hosted by {group.hostName}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className={cn(
                                                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                                                    isActive ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                                                                )}>
                                                                    {isActive ? "Focusing" : group.status === "paused" ? "Paused" : "Idle"}
                                                                </div>
                                                                <button onClick={() => setShowGroupSettings(showGroupSettings === group.id ? null : group.id)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                                                    <Settings className="w-4 h-4 text-zinc-500" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Group Settings Panel */}
                                                        {showGroupSettings === group.id && (
                                                            <div className="p-4 bg-zinc-900/50 rounded-xl border border-white/10 mb-4 space-y-4">
                                                                <h5 className="text-sm font-bold text-white flex items-center gap-2">
                                                                    <Settings className="w-4 h-4" />
                                                                    Group Settings
                                                                </h5>

                                                                {/* Privacy & Access Code */}
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs text-zinc-500">Privacy</span>
                                                                        <span className="text-xs text-zinc-300 capitalize flex items-center gap-1">
                                                                            {group.privacy === "private" ? <Lock className="w-3 h-3" /> : group.privacy === "code" ? <Key className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                                                                            {group.privacy}
                                                                        </span>
                                                                    </div>
                                                                    {group.accessCode && (
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-xs text-zinc-500">Access Code</span>
                                                                            <div className="flex items-center gap-2">
                                                                                <code className="px-2 py-1 bg-zinc-800 rounded text-[#C9B037] font-mono text-xs">{group.accessCode}</code>
                                                                                <button onClick={() => { navigator.clipboard.writeText(group.accessCode!); toast.success("Code copied!"); }} className="p-1 hover:bg-white/10 rounded">
                                                                                    <Copy className="w-3 h-3 text-zinc-500" />
                                                                                </button>
                                                                                {isHost && (
                                                                                    <button onClick={() => handleRegenerateCode(group.id)} className="p-1 hover:bg-white/10 rounded">
                                                                                        <Key className="w-3 h-3 text-zinc-500" />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Members Management */}
                                                                {isHost && (
                                                                    <div className="space-y-2">
                                                                        <span className="text-xs text-zinc-500">Members ({memberCount})</span>
                                                                        {group.memberDetails?.map((member: any) => (
                                                                            <div key={member.uid} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg">
                                                                                <div className="flex items-center gap-2">
                                                                                    <Avatar className="w-6 h-6">
                                                                                        <AvatarImage src={member.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.uid}`} />
                                                                                        <AvatarFallback className="text-[8px]">{member.displayName?.slice(0, 1)}</AvatarFallback>
                                                                                    </Avatar>
                                                                                    <span className="text-xs text-zinc-300">{member.displayName}{member.isHost && " (Host)"}</span>
                                                                                </div>
                                                                                {!member.isHost && (
                                                                                    <button onClick={() => handleRemoveMember(group.id, member.uid)} className="p-1 hover:bg-red-500/20 rounded">
                                                                                        <UserX className="w-3 h-3 text-zinc-500 hover:text-red-400" />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Danger Zone */}
                                                                {isHost && (
                                                                    <div className="pt-2 border-t border-white/10">
                                                                        <button onClick={() => handleDeleteGroup(group.id)} className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all text-xs font-bold flex items-center justify-center gap-2">
                                                                            <Trash2 className="w-3 h-3" />
                                                                            Delete Group
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Members */}
                                                        <div className="flex items-center gap-2 mb-4">
                                                            <div className="flex -space-x-2">
                                                                {group.memberDetails?.slice(0, 5).map((member: any, i: number) => (
                                                                    <div key={i} className="w-8 h-8 rounded-full border-2 border-zinc-800 overflow-hidden">
                                                                        <Avatar className="w-full h-full">
                                                                            <AvatarImage src={member.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.uid}`} />
                                                                            <AvatarFallback className="text-[8px]">{member.displayName?.slice(0, 1) || "U"}</AvatarFallback>
                                                                        </Avatar>
                                                                    </div>
                                                                ))}
                                                                {memberCount > 5 && (
                                                                    <div className="w-8 h-8 rounded-full border-2 border-zinc-800 bg-zinc-700 flex items-center justify-center">
                                                                        <span className="text-[8px] font-bold text-zinc-300">+{memberCount - 5}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-xs text-zinc-500 ml-2">{memberCount} {memberCount === 1 ? "member" : "members"}</span>
                                                        </div>

                                                        {/* Shared Tasks Preview */}
                                                        <div className="mb-4">
                                                            <button onClick={() => setShowSharedTasks(showSharedTasks === group.id ? null : group.id)} className="w-full flex items-center justify-between p-3 bg-zinc-900/30 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                                                                <div className="flex items-center gap-2">
                                                                    <ListTodo className="w-4 h-4 text-zinc-500" />
                                                                    <span className="text-xs text-zinc-400 font-bold">Shared Tasks</span>
                                                                </div>
                                                                <ChevronRight className={cn("w-4 h-4 text-zinc-600 transition-transform", showSharedTasks === group.id ? "rotate-90" : "")} />
                                                            </button>

                                                            {showSharedTasks === group.id && (
                                                                <SharedTasksPanel
                                                                    groupId={group.id}
                                                                    group={group}
                                                                    isHost={isHost}
                                                                    userId={user.uid}
                                                                    newTaskTitle={newTaskTitle}
                                                                    setNewTaskTitle={setNewTaskTitle}
                                                                    newTaskDesc={newTaskDesc}
                                                                    setNewTaskDesc={setNewTaskDesc}
                                                                    onAddTask={handleAddSharedTask}
                                                                    onUpdateTask={handleUpdateTaskStatus}
                                                                    onDeleteTask={handleDeleteTask}
                                                                    members={group.memberDetails || []}
                                                                />
                                                            )}
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-2">
                                                            {isHost && (
                                                                <>
                                                                    {isActive ? (
                                                                        <button onClick={() => handlePauseGroup(group.id)} className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-xl transition-all text-xs font-bold flex items-center gap-2">
                                                                            <StopCircle className="w-3 h-3" />
                                                                            Pause
                                                                        </button>
                                                                    ) : (
                                                                        <button onClick={() => handleStartGroup(group.id)} className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl transition-all text-xs font-bold flex items-center gap-2">
                                                                            <Play className="w-3 h-3" />
                                                                            Start Focus
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                            <button onClick={() => handleLeaveGroup(group.id)} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-all text-xs font-bold flex items-center gap-2 ml-auto">
                                                                <LogOut className="w-3 h-3" />
                                                                Leave
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Public Groups */}
                                {publicGroups.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-zinc-500" />
                                            Public Groups
                                        </h3>
                                        <div className="space-y-3">
                                            {publicGroups.map(group => (
                                                <div key={group.id} className="group relative p-4 rounded-[1rem] bg-zinc-800/40 border border-white/15 hover:bg-zinc-800/60 hover:border-white/25 transition-all duration-300">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="text-base font-bold text-white">{group.name}</h4>
                                                                <Globe className="w-3 h-3 text-green-400" />
                                                            </div>
                                                            <p className="text-xs text-zinc-500">Hosted by {group.hostName}</p>
                                                        </div>
                                                        <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", group.status === "active" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400")}>
                                                            {group.status === "active" ? "Focusing" : "Idle"}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <div className="flex -space-x-2">
                                                            {group.memberDetails?.slice(0, 5).map((member: any, i: number) => (
                                                                <div key={i} className="w-8 h-8 rounded-full border-2 border-zinc-800 overflow-hidden">
                                                                    <Avatar className="w-full h-full">
                                                                        <AvatarImage src={member.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.uid}`} />
                                                                        <AvatarFallback className="text-[8px]">{member.displayName?.slice(0, 1) || "U"}</AvatarFallback>
                                                                    </Avatar>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <span className="text-xs text-zinc-500 ml-2">{group.members.length} members</span>
                                                    </div>

                                                    <button onClick={() => {/* Join logic */ }} className="mt-4 w-full px-4 py-2 bg-[#C9B037]/20 hover:bg-[#C9B037]/30 text-[#C9B037] rounded-xl transition-all text-xs font-bold flex items-center justify-center gap-2">
                                                        <UserPlus className="w-3 h-3" />
                                                        Join Group
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {userGroups.length === 0 && publicGroups.length === 0 && !showCreateGroup && (
                                    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                                        <Users className="w-16 h-16 text-zinc-700" />
                                        <h3 className="text-xl font-bold text-zinc-400">No Groups Yet</h3>
                                        <p className="text-sm text-zinc-600 max-w-md">Create a focus group to work together with friends in real-time!</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Friends Tab */}
                        {activeTab === "friends" && <FriendsTab friends={friends} loading={loading} onRemoveFriend={handleRemoveFriend} onGoToSearch={() => setActiveTab("search")} />}

                        {/* Requests Tab */}
                        {activeTab === "requests" && <RequestsTab receivedRequests={receivedRequests} sentRequests={sentRequests} onAccept={handleAcceptRequest} onDecline={handleDeclineRequest} onCancel={handleCancelRequest} />}

                        {/* Search Tab */}
                        {activeTab === "search" && <SearchTab searchQuery={searchQuery} setSearchQuery={setSearchQuery} onSearch={handleSearch} searching={searching} searchResults={searchResults} onSendRequest={handleSendRequest} />}
                    </div>
                </main>
            </div>
        </BackgroundTheme>
    );
}

// Shared Tasks Panel Component
function SharedTasksPanel({ groupId, group, isHost, userId, newTaskTitle, setNewTaskTitle, newTaskDesc, setNewTaskDesc, onAddTask, onUpdateTask, onDeleteTask, members }: any) {
    const [tasks, setTasks] = useState<any[]>([]);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "focusGroups", groupId, "tasks"), (snapshot) => {
            const taskList: any[] = [];
            snapshot.forEach(doc => {
                taskList.push({ id: doc.id, ...doc.data() });
            });
            setTasks(taskList.sort((a, b) => {
                const order = { todo: 0, "in-progress": 1, done: 2 };
                return order[a.status as keyof typeof order] - order[b.status as keyof typeof order];
            }));
        });
        return () => unsub();
    }, [groupId]);

    return (
        <div className="mt-2 p-3 bg-zinc-900/50 rounded-xl border border-white/10 space-y-3">
            <h6 className="text-xs font-bold text-white flex items-center gap-2">
                <ListTodo className="w-3 h-3 text-[#C9B037]" />
                Shared Tasks ({tasks.length})
            </h6>

            {/* Add Task */}
            <div className="space-y-2">
                <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Task title..." className="w-full bg-zinc-800/50 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-zinc-600 outline-none text-xs" />
                <textarea value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full bg-zinc-800/50 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-zinc-600 outline-none text-xs resize-none" />
                <button onClick={() => onAddTask(groupId)} disabled={!newTaskTitle.trim()} className="w-full px-3 py-2 bg-[#C9B037]/20 hover:bg-[#C9B037]/30 disabled:opacity-50 text-[#C9B037] rounded-lg transition-all text-xs font-bold">Add Task</button>
            </div>

            {/* Tasks List */}
            {tasks.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {tasks.map((task: any) => (
                        <div key={task.id} className="p-2 bg-zinc-800/50 rounded-lg border border-white/5">
                            <div className="flex items-start justify-between mb-1">
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-zinc-300">{task.title}</p>
                                    {task.description && <p className="text-[10px] text-zinc-600 mt-0.5">{task.description}</p>}
                                    <p className="text-[10px] text-zinc-700 mt-1">Assigned to: {task.assignedName}</p>
                                </div>
                                <button onClick={() => onDeleteTask(groupId, task.id)} className="p-1 hover:bg-red-500/20 rounded">
                                    <Trash2 className="w-3 h-3 text-zinc-600 hover:text-red-400" />
                                </button>
                            </div>
                            <div className="flex items-center gap-1 mt-2">
                                {["todo", "in-progress", "done"].map((status) => (
                                    <button key={status} onClick={() => onUpdateTask(groupId, task.id, status)} className={cn(
                                        "px-2 py-1 rounded text-[9px] font-bold uppercase transition-all",
                                        task.status === status
                                            ? status === "done" ? "bg-green-500/30 text-green-400" : status === "in-progress" ? "bg-yellow-500/30 text-yellow-400" : "bg-zinc-600/30 text-zinc-400"
                                            : "bg-zinc-800 text-zinc-600 hover:text-zinc-500"
                                    )}>
                                        {status === "in-progress" ? "Doing" : status}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Friends Tab Component
function FriendsTab({ friends, loading, onRemoveFriend, onGoToSearch }: any) {
    return (
        <div className="space-y-4">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <div className="w-12 h-12 border-4 border-[#C9B037]/10 border-t-[#C9B037] rounded-full animate-spin" />
                    <p className="text-xs font-black uppercase text-zinc-600 tracking-widest animate-pulse">Loading Friends...</p>
                </div>
            ) : friends.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                    <Users className="w-16 h-16 text-zinc-700" />
                    <h3 className="text-xl font-bold text-zinc-400">No Friends Yet</h3>
                    <p className="text-sm text-zinc-600 max-w-md">Search for users and send friend requests to start focusing together!</p>
                    <button onClick={onGoToSearch} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-300 flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        <span className="text-sm font-bold">Find Friends</span>
                    </button>
                </div>
            ) : (
                friends.map((friend: any) => {
                    const userData = friend.userData;
                    if (!userData) return null;
                    const totalMinutes = userData.totalMinutes || 0;
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;

                    return (
                        <div key={friend.friendId} className="group relative flex items-center gap-6 p-4 rounded-[1rem] bg-zinc-800/40 border border-white/15 hover:bg-zinc-800/60 hover:border-white/25 transition-all duration-300">
                            <div className="relative w-12 h-12 rounded-full border border-white/10 group-hover:border-white/20 transition-all duration-300 overflow-hidden">
                                <Avatar className="w-full h-full border-0 rounded-full">
                                    <AvatarImage src={userData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.uid}`} className="object-cover w-full h-full" />
                                    <AvatarFallback className="text-sm rounded-full">{userData.displayName?.slice(0, 1)}</AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors uppercase tracking-wider">{userData.displayName}</p>
                                <div className="flex items-center gap-4 mt-1">
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-[#C9B037]/70" />
                                        <span className="text-xs text-zinc-500">{hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Trophy className="w-3 h-3 text-zinc-700" />
                                        <span className="text-xs text-zinc-500">{userData.totalPomodoros || 0} sessions</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onRemoveFriend(friend.friendId)} className="p-2 hover:bg-red-500/20 rounded-lg transition-colors group/remove" title="Remove Friend">
                                    <LogOut className="w-4 h-4 text-zinc-500 group-hover/remove:text-red-400" />
                                </button>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}

// Requests Tab Component
function RequestsTab({ receivedRequests, sentRequests, onAccept, onDecline, onCancel }: any) {
    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-[#C9B037]" />
                    Received Requests
                    {receivedRequests.length > 0 && (
                        <span className="px-2 py-0.5 bg-[#C9B037]/20 text-[#C9B037] rounded-full text-xs font-bold">{receivedRequests.length}</span>
                    )}
                </h3>
                {receivedRequests.length === 0 ? (
                    <p className="text-sm text-zinc-600">No pending requests</p>
                ) : (
                    <div className="space-y-3">
                        {receivedRequests.map((request: any) => (
                            <RequestCard key={request.id} request={request} onAccept={() => onAccept(request.id, request.fromUserId)} onDecline={() => onDecline(request.id)} direction="received" />
                        ))}
                    </div>
                )}
            </div>
            <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Hourglass className="w-5 h-5 text-zinc-500" />
                    Sent Requests
                </h3>
                {sentRequests.length === 0 ? (
                    <p className="text-sm text-zinc-600">No sent requests</p>
                ) : (
                    <div className="space-y-3">
                        {sentRequests.map((request: any) => (
                            <RequestCard key={request.id} request={request} onCancel={() => onCancel(request.id)} direction="sent" />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Search Tab Component
function SearchTab({ searchQuery, setSearchQuery, onSearch, searching, searchResults, onSendRequest }: any) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 p-2 bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSearch()} placeholder="Search by name, email, or user ID..." className="flex-1 bg-transparent text-white placeholder:text-zinc-600 px-4 py-2 outline-none text-sm" />
                <button onClick={onSearch} disabled={searching || !searchQuery.trim()} className="px-6 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-300 flex items-center gap-2">
                    {searching ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                    <span className="text-sm font-bold">Search</span>
                </button>
            </div>

            {searchResults.length === 0 && searchQuery && !searching ? (
                <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
                    <Search className="w-12 h-12 text-zinc-700" />
                    <p className="text-sm text-zinc-600">No users found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {searchResults.map((resultUser: any) => (
                        <div key={resultUser.id} className="group relative flex items-center gap-6 p-4 rounded-[1rem] bg-zinc-800/40 border border-white/15 hover:bg-zinc-800/60 hover:border-white/25 transition-all duration-300">
                            <div className="relative w-12 h-12 rounded-full border border-white/10 group-hover:border-white/20 transition-all duration-300 overflow-hidden">
                                <Avatar className="w-full h-full border-0 rounded-full">
                                    <AvatarImage src={resultUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${resultUser.uid}`} className="object-cover w-full h-full" />
                                    <AvatarFallback className="text-sm rounded-full">{resultUser.displayName?.slice(0, 1)}</AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors uppercase tracking-wider">{resultUser.displayName}</p>
                                {resultUser.email && <p className="text-xs text-zinc-600 mt-1">{resultUser.email}</p>}
                                <p className="text-[10px] text-zinc-700 font-mono mt-1">ID: {resultUser.id}</p>
                            </div>
                            <button onClick={() => onSendRequest(resultUser.id, resultUser.displayName)} className="px-4 py-2 bg-[#C9B037]/20 hover:bg-[#C9B037]/30 text-[#C9B037] rounded-xl transition-all duration-300 flex items-center gap-2 text-sm font-bold">
                                <UserPlus className="w-4 h-4" />
                                Add
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Request Card Component
function RequestCard({ request, onAccept, onDecline, onCancel, direction }: any) {
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            const userId = direction === "received" ? request.fromUserId : request.toUserId;
            const { doc, getDoc } = await import("firebase/firestore");
            const { db } = await import("@/lib/firebase");
            const userRef = doc(db, "users", userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                setUserData({ id: userSnap.id, ...userSnap.data() });
            }
            setLoading(false);
        };
        fetchUserData();
    }, [request, direction]);

    if (loading) {
        return (
            <div className="flex items-center gap-6 p-4 rounded-[1rem] bg-zinc-800/40 border border-white/15">
                <div className="w-12 h-12 rounded-full bg-zinc-700 animate-pulse" />
                <div className="flex-1 space-y-2">
                    <div className="w-32 h-4 bg-zinc-700 rounded animate-pulse" />
                    <div className="w-24 h-3 bg-zinc-700 rounded animate-pulse" />
                </div>
            </div>
        );
    }

    if (!userData) return null;

    return (
        <div className="group relative flex items-center gap-6 p-4 rounded-[1rem] bg-zinc-800/40 border border-white/15">
            <div className="relative w-12 h-12 rounded-full border border-white/10 overflow-hidden">
                <Avatar className="w-full h-full border-0 rounded-full">
                    <AvatarImage src={userData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.uid}`} className="object-cover w-full h-full" />
                    <AvatarFallback className="text-sm rounded-full">{userData.displayName?.slice(0, 1)}</AvatarFallback>
                </Avatar>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-zinc-300 uppercase tracking-wider">{userData.displayName}</p>
                <p className="text-xs text-zinc-600 mt-1">{direction === "received" ? "Wants to be your friend" : "Request pending"}</p>
                <p className="text-[10px] text-zinc-700 font-mono mt-1">ID: {userData.id}</p>
            </div>
            <div className="flex items-center gap-2">
                {direction === "received" && (
                    <>
                        <button onClick={onAccept} className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors" title="Accept"><Check className="w-4 h-4" /></button>
                        <button onClick={onDecline} className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors" title="Decline"><X className="w-4 h-4" /></button>
                    </>
                )}
                {direction === "sent" && (
                    <button onClick={onCancel} className="p-2 bg-zinc-500/20 hover:bg-zinc-500/30 text-zinc-400 rounded-lg transition-colors" title="Cancel Request"><X className="w-4 h-4" /></button>
                )}
            </div>
        </div>
    );
}
