"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function AdminTickerPage() {
  const [users, setUsers] = useState("");
  const [hours, setHours] = useState("");
  const [sessions, setSessions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadValues = async () => {
    try {
      const res = await fetch("/api/admin/ticker");
      const data = await res.json();
      setUsers(String(data.users ?? 231));
      setHours(String(data.hours ?? 934));
      setSessions(String(data.sessions ?? 1746));
    } catch {
      setUsers("231");
      setHours("934");
      setSessions("1746");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadValues();
  }, []);

  const handleSave = async () => {
    const u = parseInt(users, 10);
    const h = parseInt(hours, 10);
    const s = parseInt(sessions, 10);

    if (isNaN(u) || isNaN(h) || isNaN(s) || u < 0 || h < 0 || s < 0) {
      toast.error("All values must be valid non-negative integers");
      return;
    }

    setSaving(true);
    try {
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const token = await new Promise<string>((resolve) => {
        const check = () => {
          const u = auth.currentUser;
          if (u) {
            u.getIdToken().then(resolve);
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });

      const res = await fetch("/api/admin/ticker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ users: u, hours: h, sessions: s }),
      });

      if (res.ok) {
        toast.success("Ticker values updated successfully");
        setDirty(false);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update ticker");
      }
    } catch {
      toast.error("Failed to update ticker");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-6 w-40 rounded bg-white/5 animate-pulse" />
          <div className="h-4 w-56 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="p-2 rounded-lg border border-white/[0.08] hover:border-white/20 text-zinc-400 hover:text-white transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white font-pixelify tracking-wide">
            Live Ticker
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Edit the static display values shown in the "Live Ticker" section on the welcome page.
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-6 md:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field
            label="Focus Users"
            value={users}
            onChange={(v) => { setUsers(v); setDirty(true); }}
            placeholder="231"
          />
          <Field
            label="Focus Hours"
            value={hours}
            onChange={(v) => { setHours(v); setDirty(true); }}
            placeholder="934"
          />
          <Field
            label="Sessions Done"
            value={sessions}
            onChange={(v) => { setSessions(v); setDirty(true); }}
            placeholder="1746"
          />
        </div>

        <div className="pt-2 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Changes appear immediately on the welcome page (ISR cache is purged on save).
          </p>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#02343F] border border-[#F0EDCC]/40 text-[#F0EDCC] font-pixelify text-xs font-bold uppercase tracking-wider hover:bg-[#034857] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-[#F0EDCC]/30 border-t-[#F0EDCC] rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-pixelify font-bold uppercase tracking-wider text-zinc-300">
        {label}
      </label>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white font-mono text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#F0EDCC]/40 focus:border-[#F0EDCC]/60 transition-all placeholder:text-zinc-600"
      />
    </div>
  );
}
