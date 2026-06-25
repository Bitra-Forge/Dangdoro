import React from "react";

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {[...Array(4)].map((_, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 h-[106px] flex flex-col justify-between"
        >
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-white/10" />
            <div className="w-24 h-3 rounded bg-white/10" />
          </div>
          <div className="w-16 h-7 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/20 overflow-hidden animate-pulse">
      <div className="border-b border-white/5 px-4 py-3 flex gap-4 bg-zinc-900/40">
        <div className="w-1/4 h-3 rounded bg-white/10" />
        <div className="w-1/4 h-3 rounded bg-white/10 hidden sm:table-cell" />
        <div className="w-1/6 h-3 rounded bg-white/10 hidden md:table-cell" />
        <div className="w-1/6 h-3 rounded bg-white/10 hidden md:table-cell" />
        <div className="w-1/6 h-3 rounded bg-white/10" />
      </div>
      <div className="divide-y divide-white/5">
        {[...Array(5)].map((_, idx) => (
          <div key={idx} className="px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 w-1/4 shrink-0">
              <div className="w-7 h-7 rounded-full bg-white/10 shrink-0" />
              <div className="w-20 h-3.5 rounded bg-white/10" />
            </div>
            <div className="w-1/4 h-3 rounded bg-white/10 hidden sm:table-cell" />
            <div className="w-1/6 h-3 rounded bg-white/10 hidden md:table-cell" />
            <div className="w-1/6 h-3 rounded bg-white/10 hidden md:table-cell" />
            <div className="w-1/6 h-3.5 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChangelogSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[...Array(3)].map((_, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 space-y-3"
        >
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <div className="w-24 h-4 rounded bg-white/10" />
              <div className="w-16 h-2.5 rounded bg-white/10" />
            </div>
            <div className="w-8 h-8 rounded bg-white/10" />
          </div>
          <div className="space-y-2">
            <div className="w-full h-3 rounded bg-white/10" />
            <div className="w-5/6 h-3 rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
