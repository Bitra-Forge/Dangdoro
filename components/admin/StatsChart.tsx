"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface HistoricalDay {
  date: string;
  registrations: number;
  sessions: number;
}

interface SafeChartWrapperProps {
  width?: number;
  height?: number;
  children: React.ReactElement<any>;
  [key: string]: any;
}

function SafeChartWrapper({ width, height, children, ...props }: SafeChartWrapperProps) {
  if (!width || width <= 0 || !height || height <= 0) {
    return null;
  }
  return React.cloneElement(children, { width, height, ...props });
}

interface StatsChartProps {
  data: HistoricalDay[];
}

export function StatsChart({ data }: StatsChartProps) {
  const primaryColor = "#E8821A"; // Orange/Gold theme
  const secondaryColor = "#38bdf8"; // Sky Blue theme

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="relative w-full h-[320px] bg-zinc-900/40 backdrop-blur-md border border-white/[0.05] rounded-2xl p-5"
    >
      <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
      
      {/* Header info */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-white">
            Activity & Registrations
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Last 7 days daily trends</p>
        </div>
        
        {/* Legends */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-sky-400" />
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Signups</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-orange-500" />
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Sessions</span>
          </div>
        </div>
      </div>

      <div className="w-full h-[220px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <SafeChartWrapper>
            <ComposedChart
            data={data}
            margin={{ top: 10, right: 5, left: -25, bottom: 0 }}
          >
            <defs>
              {/* Sessions Gradient */}
              <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primaryColor} stopOpacity={0.4} />
                <stop offset="90%" stopColor={primaryColor} stopOpacity={0.01} />
                <stop offset="100%" stopColor={primaryColor} stopOpacity={0} />
              </linearGradient>
              {/* Signups Gradient */}
              <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={secondaryColor} stopOpacity={0.3} />
                <stop offset="90%" stopColor={secondaryColor} stopOpacity={0.01} />
                <stop offset="100%" stopColor={secondaryColor} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="4 4"
              stroke="rgba(255,255,255,0.03)"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9, fontWeight: 700 }}
              dy={10}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9, fontWeight: 700 }}
              dx={-5}
            />

            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.02)", radius: 8 }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const dayData = payload[0].payload;
                  return (
                    <div className="relative p-[1px] rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-gradient-to-br from-white/10 to-transparent">
                      <div className="bg-zinc-950/90 backdrop-blur-3xl rounded-[11px] p-3 space-y-2 min-w-[140px]">
                        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                          {dayData.date}
                        </p>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                              Signups
                            </span>
                            <span className="text-xs font-black text-white tabular-nums">
                              {dayData.registrations}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                              Sessions
                            </span>
                            <span className="text-xs font-black text-white tabular-nums">
                              {dayData.sessions}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Focus Sessions Area */}
            <Area
              type="monotone"
              dataKey="sessions"
              stroke={primaryColor}
              strokeWidth={2}
              fill="url(#colorSessions)"
              strokeLinecap="round"
              strokeLinejoin="round"
              animationDuration={800}
              activeDot={{
                r: 5,
                fill: "#fff",
                stroke: primaryColor,
                strokeWidth: 2,
              }}
            />

            {/* Registrations Area */}
            <Area
              type="monotone"
              dataKey="registrations"
              stroke={secondaryColor}
              strokeWidth={2}
              fill="url(#colorSignups)"
              strokeLinecap="round"
              strokeLinejoin="round"
              animationDuration={800}
              activeDot={{
                r: 5,
                fill: "#fff",
                stroke: secondaryColor,
                strokeWidth: 2,
              }}
            />
          </ComposedChart>
          </SafeChartWrapper>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
