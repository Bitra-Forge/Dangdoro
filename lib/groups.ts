import { Globe, Key, Mail, LucideIcon } from "lucide-react";
import { Timestamp } from "firebase/firestore";

export type GroupType = "friends" | "organization";
export type GroupPrivacy = "public" | "private-code" | "private-invite";

export interface FirebaseTimestampLike {
    toMillis?: () => number;
    seconds?: number;
    nanoseconds?: number;
}

export interface UserProfileData {
    uid: string;
    displayName?: string;
    photoURL?: string;
    email?: string;
    totalMinutes?: number;
    nickname?: string;
    bio?: string;
    profileTheme?: string;
    totalPomodoros?: number;
    createdAt?: Timestamp | FirebaseTimestampLike;
    lastActive?: Timestamp | FirebaseTimestampLike | null;
}

export interface SharedTask {
    id: string;
    title: string;
    description: string;
    assignedTo?: string;
    status: "todo" | "in-progress" | "in-review" | "done";
    priority: "high" | "medium" | "low";
    createdBy: string;
    createdAt: Timestamp | FirebaseTimestampLike;
    updatedAt?: Timestamp | FirebaseTimestampLike;
}

export interface ObjectiveTemplateDraft {
    title: string;
    priority: "high" | "medium" | "low";
    description?: string;
}

export type GoalType = "daily" | "weekly" | "monthly" | "custom";

export interface GroupMemberDetail {
    uid: string;
    displayName?: string;
    photoURL?: string;
    isFocusing?: boolean;
    liveSessionStartedAt?: Timestamp | FirebaseTimestampLike | null;
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
        joinedAt: Timestamp | FirebaseTimestampLike;
        lastActive?: Timestamp | FirebaseTimestampLike;
    }>;
    memberDetails?: GroupMemberDetail[];
    maxMembers?: number;
    privacy: GroupPrivacy;
    accessCode?: string;
    inviteToken?: string;
    pendingInvites?: string[];
    totalMinutes?: number;
    memberCount?: number;
    createdAt: Timestamp | FirebaseTimestampLike;
    lastResetAt?: Timestamp | FirebaseTimestampLike;
    settings?: {
        goalHours: number;
        goalType?: GoalType;
        customDays?: number;
        autoRenew?: boolean;
        maxMembers: number;
    };
}

export interface LiveSession {
    id: string;
    userId: string;
    groupId: string;
    status: "focusing" | "paused" | "stopped";
    startedAt: Timestamp | FirebaseTimestampLike;
    lastHeartbeat: Timestamp | FirebaseTimestampLike;
    displayName?: string;
    photoURL?: string;
    userName?: string;
    userPhoto?: string;
}

export function generateInviteToken() {
    // Use crypto for a cryptographically secure token (8 uppercase alphanumeric chars)
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase();
    }
    // Fallback for environments without crypto (shouldn't happen in modern runtimes)
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

export const PRIVACY_META: Record<GroupPrivacy, { label: string; icon: LucideIcon; color: string }> = {
    "public":         { label: "Public",          icon: Globe,  color: "text-emerald-400" },
    "private-code":   { label: "Code",            icon: Key,    color: "text-zinc-300" },
    "private-invite": { label: "Invite Only",     icon: Mail,   color: "text-violet-400" },
};

export const LIVE_SESSION_STALE_MS = 3 * 60 * 1000;

export function toMillis(ts: FirebaseTimestampLike | Date | number | null | undefined): number | null {
    if (!ts) return null;
    if (typeof ts === "number") return ts;
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === "object") {
        if (typeof ts.toMillis === "function") return ts.toMillis();
        if (typeof ts.seconds === "number") return ts.seconds * 1000;
        return Date.now();
    }
    return null;
}

export function getEarliestActiveStart(memberDetails: GroupMemberDetail[] | undefined): FirebaseTimestampLike | Timestamp | null {
    if (!memberDetails?.length) return null;
    const activeStarts = memberDetails
        .filter((m) => m.isFocusing && m.liveSessionStartedAt)
        .map((m) => ({ raw: m.liveSessionStartedAt!, ms: toMillis(m.liveSessionStartedAt) }))
        .filter((item): item is { raw: FirebaseTimestampLike | Timestamp; ms: number } => typeof item.ms === "number")
        .sort((a, b) => a.ms - b.ms);
    return activeStarts.length > 0 ? activeStarts[0].raw : null;
}

export function resolveLiveSessionsForGroup(groupId: string, sessions: LiveSession[]): LiveSession[] {
    const now = Date.now();
    const filtered = sessions.filter((s) => {
        if (s.groupId !== groupId) return false;
        const heartbeatMs = toMillis(s.lastHeartbeat) ?? toMillis(s.startedAt);
        if (!heartbeatMs) return s.status === "focusing";
        return now - heartbeatMs <= LIVE_SESSION_STALE_MS;
    });

    const byUser = new Map<string, LiveSession>();
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

export function normalizeLiveSessions(sessions: LiveSession[]): LiveSession[] {
    const active = sessions.filter((s) => s?.status === "focusing");
    const byUser = new Map<string, LiveSession>();
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

export function getManagementGroupKey(group: FocusGroup | null | undefined): string {
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

export function getGoalTypeLabel(goalType?: GoalType): string {
    switch (goalType) {
        case "daily": return "Daily";
        case "weekly": return "Weekly";
        case "monthly": return "Monthly";
        case "custom": return "Custom";
        default: return "Weekly";
    }
}

export function getGoalPeriodBounds(goalType?: GoalType, customDays?: number, referenceDate?: Date): { start: Date; end: Date } {
    const now = referenceDate || new Date();
    switch (goalType) {
        case "daily": {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            return { start, end };
        }
        case "weekly": {
            const dayOfWeek = now.getDay();
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(end.getDate() + 7);
            return { start, end };
        }
        case "monthly": {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            return { start, end };
        }
        case "custom": {
            const days = customDays || 7;
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(end.getDate() + days);
            return { start, end };
        }
        default: {
            const dayOfWeek = now.getDay();
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(end.getDate() + 7);
            return { start, end };
        }
    }
}

export function computeNextPeriodStart(goalType?: GoalType, customDays?: number): Date {
    const now = new Date();
    switch (goalType) {
        case "daily": {
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            return tomorrow;
        }
        case "weekly": {
            const dayOfWeek = now.getDay();
            const nextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 7);
            return nextWeek;
        }
        case "monthly": {
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            return nextMonth;
        }
        case "custom": {
            const days = customDays || 7;
            return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
        }
        default: {
            const dayOfWeek = now.getDay();
            const nextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 7);
            return nextWeek;
        }
    }
}

export function isPeriodExpired(goalType?: GoalType, customDays?: number, referenceDate?: Date): boolean {
    if (!goalType || goalType === "daily" || goalType === "weekly" || goalType === "monthly") {
        const { end } = getGoalPeriodBounds(goalType, undefined, referenceDate);
        return new Date() >= end;
    }
    if (goalType === "custom" && customDays) {
        const { end } = getGoalPeriodBounds(goalType, customDays, referenceDate);
        return new Date() >= end;
    }
    return false;
}
