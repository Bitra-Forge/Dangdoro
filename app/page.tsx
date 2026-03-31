import { AuthCard } from "@/components/AuthCard";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-950 font-sans p-4 md:p-8 relative overflow-hidden">
      {/* Background radial glow for a premium feel */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />

      <main className="relative z-10 flex flex-col items-center gap-12 w-full max-w-lg">
        <header className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              <div className="w-4 h-4 bg-black rounded-sm" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white uppercase italic">Dangdoro</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase italic leading-none">
            Focus. Compete. Win.
          </h1>
          <p className="text-zinc-500 text-sm font-medium uppercase tracking-[0.2em]">
            Real-time Pomodoro Leaderboard
          </p>
        </header>

        {/* Auth status card - preserved as requested */}
        <AuthCard />

        <div className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-2xl text-center">
          <p className="text-zinc-400 text-sm">
            The core timer is currently being integrated by the team. <br />
            Your account is ready to track focus sessions!
          </p>
        </div>
      </main>
    </div>
  );
}

