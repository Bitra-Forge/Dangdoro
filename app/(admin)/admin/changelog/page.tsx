"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChangelogManager } from "@/components/admin/ChangelogManager";
import { ChangelogSkeleton } from "@/components/admin/LoadingSkeleton";
import { ChangelogItem } from "@/components/changelog/changelog-types";

export default function AdminChangelogPage() {
  const [entries, setEntries] = useState<ChangelogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getToken = async () => {
    const { getAuth } = await import("firebase/auth");
    const auth = getAuth();
    return new Promise<string>((resolve) => {
      const checkUser = () => {
        const u = auth.currentUser;
        if (u) {
          u.getIdToken().then(resolve);
        } else {
          setTimeout(checkUser, 100);
        }
      };
      checkUser();
    });
  };

  const loadEntries = async () => {
    try {
      const t = await getToken();
      setToken(t);
      const res = await fetch("/api/admin/changelog", {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      if (data.entries) {
        setEntries(data.entries);
      }
    } catch (err) {
      console.error("Failed to load changelog entries:", err);
      toast.error("Failed to load changelog list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (data: Partial<ChangelogItem>): Promise<boolean> => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/changelog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("Changelog entry published successfully");
        loadEntries();
        return true;
      } else {
        const errData = await res.json();
        toast.error(errData.error || "Failed to publish changelog");
        return false;
      }
    } catch {
      toast.error("Failed to publish changelog");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id: string, data: Partial<ChangelogItem>): Promise<boolean> => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/changelog/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("Changelog entry updated successfully");
        loadEntries();
        return true;
      } else {
        const errData = await res.json();
        toast.error(errData.error || "Failed to update changelog");
        return false;
      }
    } catch {
      toast.error("Failed to update changelog");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSilentUpdate = async (id: string, data: Partial<ChangelogItem>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/changelog/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/changelog/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Changelog entry deleted successfully");
        setEntries((prev) => prev.filter((e) => e.id !== id));
      } else {
        toast.error("Failed to delete changelog");
      }
    } catch {
      toast.error("Failed to delete changelog");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {loading ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="h-6 w-32 rounded bg-white/5 animate-pulse" />
            <div className="h-4 w-48 rounded bg-white/5 animate-pulse" />
          </div>
          <ChangelogSkeleton />
        </div>
      ) : (
        <ChangelogManager
          entries={entries}
          onSubmit={handleSubmit}
          onUpdate={handleUpdate}
          onSilentUpdate={handleSilentUpdate}
          onDelete={handleDelete}
          submitting={submitting}
          deletingId={deletingId}
        />
      )}
    </div>
  );
}
