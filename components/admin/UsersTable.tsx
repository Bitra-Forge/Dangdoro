"use client";

import React from "react";
import { Search, Ban, CheckCircle2, User, Mail, Calendar, Hash, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface UserData {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  isAnonymous: boolean;
  totalPomodoros: number;
  totalMinutes: number;
  banned: boolean;
  createdAt: string | null;
  lastActive: string | null;
}

interface UsersTableProps {
  users: UserData[];
  search: string;
  setSearch: (s: string) => void;
  onToggleBan: (user: UserData) => void;
  banningUid: string | null;
}

export function UsersTable({
  users,
  search,
  setSearch,
  onToggleBan,
  banningUid,
}: UsersTableProps) {
  return (
    <div className="space-y-4">
      {/* Search Input Bar */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors duration-200" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search registered accounts by name or email..."
          className="w-full bg-zinc-900/40 border border-white/5 rounded-2xl pl-11 pr-10 py-3.5 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-white/15 focus:bg-zinc-900/60 transition-all duration-300"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Results summary */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
          Search Results: <span className="text-zinc-300 tabular-nums">{users.length}</span>
        </p>
      </div>

      {/* Users table */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.05] bg-zinc-900/20 backdrop-blur-md">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-white/[0.05] bg-zinc-900/40 select-none">
              <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-zinc-500" /> User
                </span>
              </th>
              <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 hidden sm:table-cell">
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3 text-zinc-500" /> Email
                </span>
              </th>
              <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center hidden md:table-cell">
                <span className="flex items-center justify-center gap-1">
                  <Hash className="w-3 h-3 text-zinc-500" /> Pomodoros
                </span>
              </th>
              <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center hidden md:table-cell">
                <span className="flex items-center justify-center gap-1">
                  <Calendar className="w-3 h-3 text-zinc-500" /> Joined
                </span>
              </th>
              <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">
                Status
              </th>
              <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {users.map((user, idx) => (
                <motion.tr
                  key={user.uid}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15, delay: Math.min(idx * 0.03, 0.3) }}
                  className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.01] transition-colors"
                >
                  {/* User Profile */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl bg-zinc-800 border border-white/5 flex items-center justify-center text-[10px] font-black text-zinc-400 shrink-0 overflow-hidden bg-cover bg-center"
                        style={
                          user.photoURL
                            ? { backgroundImage: `url(${user.photoURL})` }
                            : undefined
                        }
                      >
                        {!user.photoURL &&
                          (user.displayName?.[0] || "?").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate max-w-[150px]">
                          {user.displayName || "Anonymous User"}
                        </p>
                        <p className="text-[9px] text-zinc-500 sm:hidden truncate max-w-[150px] mt-0.5">
                          {user.email || (user.isAnonymous ? "Anonymous" : "")}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-5 py-3.5 text-zinc-400 hidden sm:table-cell truncate max-w-[200px]">
                    {user.email || (user.isAnonymous ? "(anonymous)" : "—")}
                  </td>

                  {/* Pomodoros */}
                  <td className="px-5 py-3.5 text-center text-zinc-300 font-bold tabular-nums hidden md:table-cell">
                    {user.totalPomodoros}
                    <span className="text-[10px] text-zinc-600 font-normal ml-1">
                      ({user.totalMinutes}m)
                    </span>
                  </td>

                  {/* Joined Date */}
                  <td className="px-5 py-3.5 text-center text-zinc-500 hidden md:table-cell tabular-nums">
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </td>

                  {/* Status Indicator */}
                  <td className="px-5 py-3.5 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border",
                        user.banned
                          ? "bg-red-500/5 text-red-400 border-red-500/10"
                          : "bg-emerald-500/5 text-emerald-400 border-emerald-500/10"
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0 animate-pulse",
                          user.banned ? "bg-red-400" : "bg-emerald-400"
                        )}
                        style={{ animationDuration: "2s" }}
                      />
                      {user.banned ? "Banned" : "Active"}
                    </span>
                  </td>

                  {/* Ban/Unban Button */}
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => onToggleBan(user)}
                      disabled={banningUid === user.uid}
                      className={cn(
                        "inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 select-none",
                        user.banned
                          ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:scale-[1.03]"
                          : "bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:scale-[1.03]"
                      )}
                    >
                      {user.banned ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Unban</span>
                        </>
                      ) : (
                        <>
                          <Ban className="w-3.5 h-3.5 shrink-0" />
                          <span>Ban</span>
                        </>
                      )}
                    </button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>

        {users.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 px-4"
          >
            <p className="text-zinc-500 font-bold">No accounts found</p>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1">
              {search ? "Adjust your search parameters" : "No users are registered yet"}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
