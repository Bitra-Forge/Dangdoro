import { TimerCard } from "@/components/timer-card";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
      {/* Background radial glow - restored original sky theme */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Skipping Login: Show the header/website directly */}


      <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
        <header className="flex flex-col items-center gap-4 text-center mb-12">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.4)]">
              <div className="w-4 h-4 bg-sky-500 rounded-sm" />
            </div>
            <span className="text-2xl font-black tracking-tight text-white uppercase italic">Dangdoro</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase italic leading-none drop-shadow-lg">
            Focus. Compete. Win.
          </h1>
          <p className="text-zinc-500 text-sm font-medium uppercase tracking-[0.2em]">
            Real-time Pomodoro Leaderboard
          </p>
        </header>

        <div className="w-full max-w-4xl flex items-center justify-center">
          <TimerCard />
        </div>
      </main>
    </div>
  );
}

