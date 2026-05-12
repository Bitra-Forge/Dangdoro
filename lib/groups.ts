import { Globe, Key, Mail } from "lucide-react";

export type GroupType = "friends" | "organization";
export type GroupPrivacy = "public" | "private-code" | "private-invite";

export interface SharedTask {
    id: string;
    title: string;
    description: string;
    assignedTo?: string;
    status: "todo" | "in-progress" | "in-review" | "done";
    priority: "high" | "medium" | "low";
    createdBy: string;
    createdAt: any;
    updatedAt?: any;
}

export interface ObjectiveTemplateDraft {
    title: string;
    priority: "high" | "medium" | "low";
    description?: string;
}

export interface FocusGroup {
    id: string;
    name: string;
    description: string;
    type: GroupType;
    hostId: string;
    hostName: string;
    members: string[];
    memberStats?: Record<string, {
        role: "host" | "admin" | "member";
        totalMinutes: number;
        joinedAt: any;
        lastActive?: any;
        isFocusing?: boolean;
        sessionStartedAt?: any;
    }>;
    memberDetails?: any[];
    startTime: any;
    status: "active" | "paused" | "idle";
    maxMembers?: number;
    privacy: GroupPrivacy;
    accessCode?: string;
    inviteToken?: string;
    pendingInvites?: string[];
    totalMinutes?: number;
    createdAt: any;
    settings?: {
        goalHours: number;
        maxMembers: number;
    };
}

export function generateInviteToken() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export function buildInviteLink(token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/groups?invite=${token}`;
}

export function fmtMinutes(mins: number) {
    if (!mins) return "0m";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

export const PRIVACY_META: Record<GroupPrivacy, { label: string; icon: any; color: string }> = {
    "public":         { label: "Public",          icon: Globe,  color: "text-emerald-400" },
    "private-code":   { label: "Code",            icon: Key,    color: "text-zinc-300" },
    "private-invite": { label: "Invite Only",     icon: Mail,   color: "text-violet-400" },
};

export const LIVE_SESSION_STALE_MS = 3 * 60 * 1000;

export function toMillis(ts: any): number | null {
    if (!ts) return null;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (typeof ts.seconds === "number") return ts.seconds * 1000;
    if (typeof ts === "number") return ts;
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === "object") return Date.now();
    return null;
}

export function getEarliestActiveStart(memberDetails: any[] | undefined): any | null {
    if (!memberDetails?.length) return null;
    const activeStarts = memberDetails
        .filter((m: any) => m.isFocusing && m.liveSessionStartedAt)
        .map((m: any) => ({ raw: m.liveSessionStartedAt, ms: toMillis(m.liveSessionStartedAt) }))
        .filter((item: any) => typeof item.ms === "number")
        .sort((a: any, b: any) => a.ms - b.ms);
    return activeStarts.length > 0 ? activeStarts[0].raw : null;
}

export function resolveLiveSessionsForGroup(groupId: string, sessions: any[]): any[] {
    const now = Date.now();
    const filtered = sessions.filter((s: any) => {
        if (s.groupId !== groupId) return false;
        const heartbeatMs = toMillis(s.lastHeartbeat) ?? toMillis(s.startedAt);
        if (!heartbeatMs) return s.status === "focusing";
        return now - heartbeatMs <= LIVE_SESSION_STALE_MS;
    });

    const byUser = new Map<string, any>();
    for (const session of filtered) {
        const key = session.userId;
        if (!key) continue;
        const current = byUser.get(key);
        if (!current) {
            byUser.set(key, session);
            continue;
        }

        const currentMs = toMillis(current.lastHeartbeat) ?? toMillis(current.startedAt) ?? 0;
        const nextMs = toMillis(session.lastHeartbeat) ?? toMillis(session.startedAt) ?? 0;
        if (nextMs >= currentMs) {
            byUser.set(key, session);
        }
    }
    return Array.from(byUser.values());
}

export function normalizeLiveSessions(sessions: any[]): any[] {
    const active = sessions.filter((s: any) => s?.status === "focusing");
    const byUser = new Map<string, any>();
    for (const session of active) {
        const userId = session?.userId;
        if (!userId) continue;
        const current = byUser.get(userId);
        if (!current) {
            byUser.set(userId, session);
            continue;
        }
        const currentMs = toMillis(current.lastHeartbeat) ?? toMillis(current.startedAt) ?? 0;
        const nextMs = toMillis(session.lastHeartbeat) ?? toMillis(session.startedAt) ?? 0;
        if (nextMs >= currentMs) byUser.set(userId, session);
    }
    return Array.from(byUser.values());
}

export function getManagementGroupKey(group: any): string {
    if (!group) return "";
    return `${group.id}-${group.members?.length}-${group.settings?.goalHours}-${group.settings?.maxMembers}-${group.hostId}`;
}

export function fmtElapsed(secs: number) {
    if (!secs) return "0s";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h === 0) {
        if (m === 0) return `${s}s`;
        return `${m}m ${s}s`;
    }
    return `${h}h ${m}m ${s}s`;
}
