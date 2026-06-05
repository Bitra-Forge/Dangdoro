"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, Check, X, User, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { acceptFriendRequest, declineFriendRequest } from "@/lib/friendship";
import { acceptGroupInvite, declineGroupInvite, fetchUserProfiles } from "@/lib/db";
import { useDockPopoverStore } from "@/lib/dock-popover-store";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

interface UserProfile {
    uid: string;
    displayName?: string | null;
    photoURL?: string | null;
}

export function NotificationsMenu() {

    const { user, openAuthVault } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const isOpen = useDockPopoverStore((s) => s.active === "notifications");
    const toggleMenu = useDockPopoverStore((s) => s.toggle);
    const closeMenu = useDockPopoverStore((s) => s.close);
    const isUnauthenticated = !user || user.isAnonymous;
    const [requests, setRequests] = useState<FriendRequestItem[]>([]);
    const [groupInvites, setGroupInvites] = useState<GroupInviteItem[]>([]);
    const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
    const [objectiveAssignments, setObjectiveAssignments] = useState<ObjectiveAssignmentItem[]>([]);
    const [friendRequestAccepted, setFriendRequestAccepted] = useState<FriendRequestAcceptedItem[]>([]);
    const menuRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    const totalUnread = requests.length + groupInvites.length + objectiveAssignments.length + friendRequestAccepted.length;
    const hasUnread = totalUnread > 0;

    useEffect(() => {
        setMounted(true);
    }, []);


    type FriendRequestItem = {
        id: string;
        fromUserId: string;
        toUserId: string;
        status: "pending" | "accepted" | "declined";
    };

    type GroupInviteItem = {
        id: string;
        name?: string;
        hostId?: string;
        hostName?: string;
        privacy?: string;
    };

    type ObjectiveAssignmentItem = {
        id: string;
        type: "objective_assignment";
        toUserId: string;
        fromUserId?: string;
        groupId?: string;
        groupName?: string;
        taskTitle?: string;
        read?: boolean;
    };

    type FriendRequestAcceptedItem = {
        id: string;
        type: "friend_request_accepted";
        toUserId: string;
        fromUserId?: string;
        friendRequestId?: string;
        read?: boolean;
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const isClickInsideMenu = menuRef.current?.contains(e.target as Node);
            const isClickInsidePopover = popoverRef.current?.contains(e.target as Node);
            if (!isClickInsideMenu && !isClickInsidePopover) {
                closeMenu("notifications");
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, closeMenu]);

    useEffect(() => {
        if (!user || user.isAnonymous) return;

        const q = query(
            collection(db, "friendRequests"),
            where("toUserId", "==", user.uid),
            where("status", "==", "pending")
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequestItem));
            setRequests(reqs);

            const senderIds = reqs.map((r) => r.fromUserId).filter((id) => id && !profiles[id]);
            if (senderIds.length > 0) {
                const newProfiles = await fetchUserProfiles(senderIds);
                setProfiles(prev => {
                    const next = { ...prev };
                    newProfiles.forEach((p: any) => {
                        if (p && p.uid) next[p.uid] = p as UserProfile;
                    });
                    return next;
                });
            }
        });

        return () => unsubscribe();
    }, [user, profiles]);

    useEffect(() => {
        if (!user || user.isAnonymous) return;

        const q = query(
            collection(db, "notifications"),
            where("toUserId", "==", user.uid),
            where("read", "==", false)
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const assignmentNotifs = snapshot.docs
                .map((d) => ({ id: d.id, ...d.data() } as ObjectiveAssignmentItem))
                .filter((n) => n.type === "objective_assignment");
            setObjectiveAssignments(assignmentNotifs);

            const acceptedNotifs = snapshot.docs
                .map((d) => ({ id: d.id, ...d.data() } as FriendRequestAcceptedItem))
                .filter((n) => n.type === "friend_request_accepted");
            setFriendRequestAccepted(acceptedNotifs);

            const senderIds = [...assignmentNotifs, ...acceptedNotifs]
                .map((n) => n.fromUserId)
                .filter((id): id is string => !!id && !profiles[id]);

            if (senderIds.length > 0) {
                const newProfiles = await fetchUserProfiles(senderIds);
                setProfiles(prev => {
                    const next = { ...prev };
                    newProfiles.forEach((p: any) => {
                        if (p && p.uid) next[p.uid] = p as UserProfile;
                    });
                    return next;
                });
            }
        });

        return () => unsubscribe();
    }, [user, profiles]);

    useEffect(() => {
        if (!user || user.isAnonymous) return;

        const q = query(
            collection(db, "focusGroups"),
            where("pendingInvites", "array-contains", user.uid)
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const invites = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GroupInviteItem));
            setGroupInvites(invites);

            const hostIds = invites
                .map((g) => g.hostId)
                .filter((id): id is string => !!id && !profiles[id]);

            if (hostIds.length > 0) {
                const newProfiles = await fetchUserProfiles(hostIds);
                setProfiles(prev => {
                    const next = { ...prev };
                    newProfiles.forEach((p: any) => {
                        if (p && p.uid) next[p.uid] = p as UserProfile;
                    });
                    return next;
                });
            }
        });

        return () => unsubscribe();
    }, [user, profiles]);

    if (pathname.startsWith("/friends")) return null;
    if (pathname.match(/^\/groups\/[^/]+/)) return null;

    const handleAccept = async (reqId: string, fromUserId: string) => {
        if (!user) return;
        if (await acceptFriendRequest(reqId, fromUserId, user.uid)) {
            toast.success("Friend request accepted");
        } else {
            toast.error("Failed to accept friend request");
        }
    };

    const handleDecline = async (reqId: string) => {
        if (await declineFriendRequest(reqId)) {
            toast.info("Friend request declined");
        } else {
            toast.error("Failed to decline friend request");
        }
    };

    const handleAcceptGroupInvite = async (groupId: string) => {
        if (!user) return;
        if (await acceptGroupInvite(groupId, user.uid, user.displayName, user.photoURL)) {
            toast.success("Joined group");
        } else {
            toast.error("Failed to join group");
        }
    };

    const handleDeclineGroupInvite = async (groupId: string) => {
        if (!user) return;
        if (await declineGroupInvite(groupId, user.uid)) {
            toast.info("Invite declined");
        } else {
            toast.error("Failed to decline invite");
        }
    };

    const handleMarkAssignmentRead = async (notificationId: string) => {
        await updateDoc(doc(db, "notifications", notificationId), { read: true });
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => {
                    if (isUnauthenticated) {
                        openAuthVault();
                        return;
                    }
                    toggleMenu("notifications");
                }}
                className={cn(
                    "p-2.5 rounded-full backdrop-blur-sm transition-all duration-300 cursor-pointer relative overflow-visible",
                    isOpen
                        ? "bg-white/15 text-white shadow-[inset_0_0_10px_rgba(255,255,255,0.1)]"
                        : "bg-zinc-900/80 text-zinc-400 hover:text-white"
                )}
            >
                {/* Glass highlights */}
                <div className={cn(
                    "absolute inset-0 rounded-full border-t-[0.5px] pointer-events-none transition-colors duration-300",
                    isOpen ? "border-white/40" : "border-white/20"
                )} />
                <div className="absolute inset-0 rounded-full border-b-[0.5px] border-white/10 pointer-events-none" />

                <Bell className={cn("w-4 h-4 transition-transform", isOpen && "scale-110")} />
                {hasUnread && (
                    <div className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-white text-black text-[10px] font-bold rounded-full flex items-center justify-center shadow-md z-20">
                        {totalUnread}
                    </div>
                )}
            </button>

            {isOpen && mounted ? createPortal(
                <div ref={popoverRef} className="fixed top-22 right-2 w-[480px] max-w-[calc(100vw-16px)] z-[100] bg-zinc-950 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 sm:fixed sm:top-22 sm:right-8 sm:w-80 sm:max-w-none sm:rounded-[15px] sm:bg-zinc-900/95 sm:backdrop-blur-xl">
                    <div className="max-h-[400px] overflow-y-auto">
                        {requests.length === 0 && groupInvites.length === 0 && objectiveAssignments.length === 0 && friendRequestAccepted.length === 0 ? (
                            <div className="p-8 flex flex-col items-center justify-center text-center opacity-40">
                                <Bell className="w-8 h-8 mb-3 opacity-20" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">No new notifications</p>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {objectiveAssignments.map((notif) => {
                                    const senderProfile = notif.fromUserId ? profiles[notif.fromUserId] : null;
                                    return (
                                        <div key={`assignment-${notif.id}`} className="p-4 border-b border-white/5">
                                            <div className="flex items-center gap-3 mb-3">
                                                <Avatar className="w-8 h-8 rounded-full border border-white/10 overflow-hidden shrink-0">
                                                    <AvatarImage src={senderProfile?.photoURL || undefined} className="rounded-full" />
                                                    <AvatarFallback className="rounded-full"><Check className="w-4 h-4" /></AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[11px] font-space-grotesk font-bold text-white truncate">
                                                        Assigned objective
                                                    </span>
                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">
                                                        {notif.groupName || "Group"} - {notif.taskTitle || "New objective"}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    className="flex-1 h-8 rounded-lg bg-white hover:bg-zinc-200 text-black text-[10px] font-black uppercase tracking-wider cursor-pointer"
                                                    onClick={() => {
                                                        closeMenu("notifications");
                                                        handleMarkAssignmentRead(notif.id);
                                                        if (notif.groupId) {
                                                            router.push(`/groups/${notif.groupId}?tab=mine`);
                                                        } else {
                                                            router.push("/groups");
                                                        }
                                                    }}
                                                >
                                                    Open Groups
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="flex-1 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-wider border border-white/5 cursor-pointer"
                                                    onClick={() => handleMarkAssignmentRead(notif.id)}
                                                >
                                                    Dismiss
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {friendRequestAccepted.map((notif) => {
                                    const accepterProfile = notif.fromUserId ? profiles[notif.fromUserId] : null;
                                    return (
                                        <div key={`friend-accepted-${notif.id}`} className="p-4 border-b border-white/5">
                                            <div className="flex items-center gap-3 mb-3">
                                                <Avatar className="w-8 h-8 rounded-full border border-white/10 overflow-hidden shrink-0">
                                                    <AvatarImage src={accepterProfile?.photoURL || undefined} className="rounded-full" />
                                                    <AvatarFallback className="rounded-full"><User className="w-4 h-4" /></AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[11px] font-space-grotesk font-bold text-white truncate">
                                                        {accepterProfile?.displayName || "Someone"} accepted your friend request
                                                    </span>
                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">
                                                        Friend Request Accepted
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    className="flex-1 h-8 rounded-lg bg-white hover:bg-zinc-200 text-black text-[10px] font-black uppercase tracking-wider cursor-pointer"
                                                    onClick={() => {
                                                        closeMenu("notifications");
                                                        handleMarkAssignmentRead(notif.id);
                                                        if (notif.fromUserId) {
                                                            router.push(`/profile?user=${notif.fromUserId}`);
                                                        }
                                                    }}
                                                >
                                                    View Profile
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="flex-1 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-wider border border-white/5 cursor-pointer"
                                                    onClick={() => handleMarkAssignmentRead(notif.id)}
                                                >
                                                    Dismiss
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {groupInvites.map(invite => {
                                    const hostProfile = invite.hostId ? profiles[invite.hostId] : null;
                                    return (
                                        <div key={`group-${invite.id}`} className="p-4 border-b border-white/5">
                                            <div className="flex items-center gap-3 mb-3">
                                                <Avatar className="w-8 h-8 rounded-full border border-white/10 overflow-hidden shrink-0">
                                                    <AvatarImage src={hostProfile?.photoURL || undefined} className="rounded-full" />
                                                    <AvatarFallback className="rounded-full"><Users className="w-4 h-4" /></AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[11px] font-space-grotesk font-bold text-white truncate">
                                                        {invite.name || "Group invite"}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">
                                                        Invite from {invite.hostName || hostProfile?.displayName || "Host"}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    className="flex-1 h-8 rounded-lg bg-white hover:bg-zinc-200 text-black text-[10px] font-black uppercase tracking-wider cursor-pointer"
                                                    onClick={() => handleAcceptGroupInvite(invite.id)}
                                                >
                                                    <Check className="w-3 h-3 mr-1" /> Accept
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="flex-1 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-wider border border-white/5 cursor-pointer"
                                                    onClick={() => handleDeclineGroupInvite(invite.id)}
                                                >
                                                    <X className="w-3 h-3 mr-1" /> Decline
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {requests.map(req => {
                                    const profile = profiles[req.fromUserId];
                                    return (
                                        <div key={req.id} className="p-4 border-b border-white/5">
                                            <Link 
                                                href={`/profile?user=${req.fromUserId}`}
                                                onClick={() => closeMenu("notifications")}
                                                className="flex items-center gap-3 mb-3 group/user cursor-pointer"
                                            >
                                                <Avatar className="w-8 h-8 rounded-full border border-white/10 overflow-hidden shrink-0">
                                                    <AvatarImage src={profile?.photoURL || undefined} className="rounded-full" />
                                                    <AvatarFallback className="rounded-full"><User className="w-4 h-4" /></AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-space-grotesk font-bold text-white">{profile?.displayName || "Someone"}</span>
                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Friend Request</span>
                                                </div>
                                            </Link>
                                            <div className="flex gap-2">
                                                <Button 
                                                    size="sm" 
                                                    className="flex-1 h-8 rounded-lg bg-white hover:bg-zinc-200 text-black text-[10px] font-black uppercase tracking-wider cursor-pointer"
                                                    onClick={() => handleAccept(req.id, req.fromUserId)}
                                                >
                                                    <Check className="w-3 h-3 mr-1" /> Accept
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="secondary"
                                                    className="flex-1 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-wider border border-white/5 cursor-pointer"
                                                    onClick={() => handleDecline(req.id)}
                                                >
                                                    <X className="w-3 h-3 mr-1" /> Decline
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            ) : null}
        </div>
    );
}
