"use client";

import { useState } from "react";
import {
  ChangelogItem,
  TabFilter,
} from "@/components/changelog/changelog-types";
import { ChangelogTabs } from "@/components/changelog/ChangelogTabs";
import { ChangelogTimeline } from "@/components/changelog/ChangelogTimeline";

interface PatchNotesClientProps {
  entries: ChangelogItem[];
}

export function PatchNotesClient({ entries }: PatchNotesClientProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  return (
    <>
      <ChangelogTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        entries={entries}
        className="sticky top-[57px] z-40 -mx-4 bg-[#0b0b0a]/92 backdrop-blur-2xl sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none mb-12"
      />
      <ChangelogTimeline entries={entries} activeTab={activeTab} />
    </>
  );
}
