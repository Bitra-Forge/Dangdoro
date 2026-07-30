import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { adminDb } from "@/lib/firebase-admin";
import {
  ChangelogItem,
  ChangelogType,
  UpcomingStatus,
} from "@/components/changelog/changelog-types";
import { PatchNotesClient } from "./_client";

/* ── Default Timeline Data ────────────────────────────────────── */

const defaultTimelineEntries: ChangelogItem[] = [
  {
    id: "demo-1",
    type: "feature",
    title: "Focus Zone Ambient Soundscapes & Visuals",
    description:
      "Immerse yourself in customized procedural lo-fi beats, rain audio, and dynamic glassmorphic lighting tailored to boost deep work efficiency.",
    date: "2026-06-25T10:00:00.000Z",
    media: {
      url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
      type: "image",
    },
  },
  {
    id: "demo-2",
    type: "fix",
    title: "Multi-tab Session Sync & Timer Accuracy",
    description:
      "Resolved edge-case drift issues when running multiple browser tabs simultaneously. Timer state now syncs instantly across windows via custom broadcast channels.",
    date: "2026-06-20T14:30:00.000Z",
  },
  {
    id: "demo-3",
    type: "feature",
    title: "Study Group Leaderboards & Real-time Milestones",
    description:
      "Track cumulative focus hours with team members, view live status badges, and celebrate weekly productivity achievements on global leaderboards.",
    date: "2026-06-15T09:15:00.000Z",
    media: {
      url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
      type: "image",
    },
  },
  {
    id: "demo-4",
    type: "fix",
    title: "Mobile Dock Touch Targets & Safe Area Padding",
    description:
      "Improved navigation dock responsiveness on modern iOS and Android OLED displays with refined haptic feedback and dynamic viewport units.",
    date: "2026-06-10T11:45:00.000Z",
  },
  {
    id: "demo-5",
    type: "upcoming",
    title: "Spotify & Apple Music Widget Integration",
    description:
      "Direct control over your favorite playlists inside the DangDoro sidebar without breaking your focus flow.",
    status: "in-progress",
    date: null,
  },
  {
    id: "demo-6",
    type: "upcoming",
    title: "AI Productivity Insights & Session Analytics",
    description:
      "Personalized breakdown of peak concentration hours, task completion velocity, and cognitive fatigue warnings.",
    status: "planned",
    date: null,
  },
];

/* ── Markdown Parser Fallback ─────────────────────────────────── */

function parseMarkdownContentToItems(
  docId: string,
  docTitle: string,
  content: string,
  dateStr?: string | null
): ChangelogItem[] {
  const items: ChangelogItem[] = [];
  const lines = content.split("\n");
  let currentType: ChangelogType = "feature";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.match(/^#+\s*(features|new features|feature|added)/i)) {
      currentType = "feature";
      continue;
    } else if (line.match(/^#+\s*(fixes|improvements|fix|fixed|improved)/i)) {
      currentType = "fix";
      continue;
    } else if (line.match(/^#+\s*(upcoming|next|future)/i)) {
      currentType = "upcoming";
      continue;
    }

    if (
      line.startsWith("-") ||
      line.startsWith("*") ||
      line.match(/^\d+\.\s/)
    ) {
      let text = line.replace(/^([-*]|\d+\.)\s*/, "").trim();
      const match = text.match(/(.*)\s*<!--\s*(.*?)\s*-->/);
      let itemDate = dateStr;

      if (match) {
        text = match[1].trim();
        const extractedDate = match[2].trim();
        if (extractedDate && !extractedDate.startsWith("separator:")) {
          itemDate = extractedDate;
        }
      }

      if (text && !text.includes("──────────────────────────────")) {
        items.push({
          id: `${docId}-${items.length}`,
          type: currentType,
          title: text.length > 60 ? text.substring(0, 60) + "..." : text,
          description: text,
          date: itemDate,
        });
      }
    }
  }

  if (items.length === 0 && (docTitle || content)) {
    items.push({
      id: docId,
      type: "feature",
      title: docTitle || "System Update",
      description:
        content.replace(/#+\s*/g, "").trim() ||
        "Performance enhancements and general stability fixes.",
      date: dateStr,
    });
  }

  return items;
}

/* ── Server-side Data Fetching ────────────────────────────────── */

async function getChangelogEntries(): Promise<ChangelogItem[]> {
  console.log(`[patch-notes] Fetching from Firestore at ${new Date().toISOString()}`);
  try {
    const snap = await adminDb
      .collection("changelog")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const parsedList: ChangelogItem[] = [];

    for (const doc of snap.docs) {
      const data = doc.data();

      let dateIso: string | null = null;
      let createdAtIso: string | null = null;

      if (data.date?.toDate) {
        dateIso = data.date.toDate().toISOString();
      } else if (typeof data.date === "string") {
        dateIso = data.date;
      }

      if (data.createdAt?.toDate) {
        createdAtIso = data.createdAt.toDate().toISOString();
      } else if (typeof data.createdAt === "string") {
        createdAtIso = data.createdAt;
      }

      if (data.type && data.description) {
        parsedList.push({
          id: doc.id,
          type: data.type as ChangelogType,
          title: data.title ?? "",
          description: data.description,
          date: dateIso || createdAtIso,
          status: data.status as UpcomingStatus,
          media: data.media || (data.imageUrl ? { url: data.imageUrl, type: "image" } : null),
          order: typeof data.order === "number" ? data.order : undefined,
        });
      } else if (data.content) {
        const items = parseMarkdownContentToItems(
          doc.id,
          data.title ?? "",
          data.content,
          createdAtIso
        );
        parsedList.push(...items);
      }
    }

    return parsedList;
  } catch (err) {
    console.error("Failed to fetch changelog entries:", err);
    return [];
  }
}

/* ── Page Component ───────────────────────────────────────────── */

export default async function PatchNotesPage() {
  const fetchedEntries = await getChangelogEntries();
  const entries = fetchedEntries.length > 0 ? fetchedEntries : defaultTimelineEntries;

  return (
    <main className="relative min-h-screen bg-[#0b0b0a] text-zinc-100 selection:bg-[#C9B037]/20 selection:text-[#C9B037] font-sans overflow-x-hidden">
      {/* Background illumination */}
      <div
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute inset-x-0 top-0 h-[65vh] bg-[radial-gradient(ellipse_75%_55%_at_50%_-10%,rgba(201,176,55,0.065)_0%,transparent_78%)]" />
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.028]"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <filter id="pn-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.72"
              numOctaves="4"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#pn-grain)" />
        </svg>
      </div>

      {/* Gold prism rim */}
      <div
        className="fixed inset-x-0 top-0 h-[1px] z-[60] pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(201,176,55,0.55) 35%, rgba(229,199,72,0.7) 50%, rgba(201,176,55,0.55) 65%, transparent 100%)",
        }}
      />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-[#0b0b0a]/85 backdrop-blur-2xl">
        <div
          className="absolute inset-x-0 bottom-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.06) 80%, transparent 100%)",
          }}
        />
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-[14px] sm:px-6">
          <Link
            href="/"
            className="group flex items-center gap-3 font-pixelify text-base sm:text-lg font-bold text-zinc-400 hover:text-zinc-100 transition-colors duration-200"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] group-hover:border-white/[0.14] group-hover:bg-white/[0.06] transition-all duration-200">
              <ArrowLeft className="h-4.5 w-4.5 transition-transform duration-200 group-hover:-translate-x-px" />
            </span>
            <span>Back</span>
          </Link>

          <p className="font-pixelify text-xs sm:text-sm font-bold uppercase tracking-[0.2em] select-none flex items-center">
            {Array.from("Update Archive").map((char, index) => {
              if (char === " ") {
                return <span key={index} className="inline-block w-[0.35em]" />;
              }
              return (
                <span
                  key={index}
                  className="inline-block animate-letter-fade"
                  style={{
                    animationDelay: `${index * 0.12}s`,
                  }}
                >
                  {char}
                </span>
              );
            })}
          </p>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16">
        {/* Page Title */}
        <div className="mb-14 text-center">
          <h1 className="font-pixelify text-5xl sm:text-7xl font-bold tracking-normal text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.2)]">
            Patch Notes
          </h1>
          <p className="font-pixelify mt-4 text-base sm:text-lg text-zinc-300 max-w-xl mx-auto leading-relaxed tracking-wide">
            We hear your feedback | every feature, fix, and improvement starts with you.
          </p>
        </div>

        {/* Interactive client component */}
        <PatchNotesClient entries={entries} />

        {/* Footer */}
        <footer className="mt-24 pt-8 text-center relative z-10">
          <div
            className="w-full h-[1px] mb-8"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)",
            }}
          />
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C9B037]/35 select-none">
            DangDoro — Stay focused
          </p>
          <p className="mt-2 text-[11px] text-zinc-700">
            © {new Date().getFullYear()} DangDoro. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}

export const revalidate = 3600;
