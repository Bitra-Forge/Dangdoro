import { Settings, Bell, Clock, Palette } from "lucide-react";

export default function SettingsPage() {
    return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-zinc-500/10 rounded-full blur-[120px] pointer-events-none" />

            <main className="relative z-10 flex flex-col items-center pt-24 pb-32 px-4 w-full flex-1">
                <header className="flex flex-col items-center gap-4 text-center mb-12">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
                            <Settings className="w-4 h-4 text-zinc-400" />
                        </div>
                        <span className="text-2xl font-black tracking-tight text-white uppercase italic">Preferences</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase italic leading-none drop-shadow-lg">
                        Tailor Your Flow
                    </h1>
                    <p className="text-zinc-500 text-sm font-medium uppercase tracking-[0.2em]">
                        Configure the engine to match your style
                    </p>
                </header>

                <div className="w-full max-w-2xl space-y-6">
                    {[
                        { title: "Timer Durations", icon: Clock, options: ["Focus: 25m", "Short Break: 5m", "Long Break: 15m"] },
                        { title: "Notifications", icon: Bell, options: ["Sound Enabled", "Desktop Alerts"] },
                        { title: "Visual Theme", icon: Palette, options: ["Glassmorphism", "Dynamic Glow"] }
                    ].map((section, i) => (
                        <div key={i} className="bg-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-8 shadow-xl">
                            <div className="flex items-center gap-3 mb-6">
                                <section.icon className="w-6 h-6 text-zinc-400" />
                                <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">{section.title}</h2>
                            </div>
                            <div className="space-y-3">
                                {section.options.map((opt, j) => (
                                    <div key={j} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all cursor-pointer">
                                        <span className="font-bold text-zinc-300">{opt.split(":")[0]}</span>
                                        <span className="text-zinc-500 font-bold">{opt.includes(":") ? opt.split(":")[1] : "ON"}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
