"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    ComposedChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";



interface ProfileChartProps {
    timeRange: "days" | "weeks" | "months";
    weekData: any[];
    monthData: any[];
    yearData: any[];
    currentTheme: { accent: string; glow: string };
    isTouchDevice: boolean;
}

export function ProfileChart({
    timeRange,
    weekData,
    monthData,
    yearData,
    currentTheme,
    isTouchDevice,
}: ProfileChartProps) {
    const data = timeRange === "days" ? weekData : timeRange === "weeks" ? monthData : yearData;

    return (
        <motion.div
            key={`mask_${timeRange}`}
            initial={{ clipPath: 'inset(0 100% 0 0)' }}
            animate={{ clipPath: 'inset(0 0% 0 0)' }}
            transition={{ duration: 2.5, ease: "easeInOut" }}
            className="w-full h-full min-w-0 outline-none focus:outline-none"
        >
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={50} className="outline-none focus:outline-none" style={{ outline: 'none' }}>
                <ComposedChart
                    data={data}
                    key={`${timeRange}_composed`}
                    margin={{ top: 20, right: 10, left: -20, bottom: 25 }}
                    className="outline-none focus:outline-none"
                    style={{ outline: 'none' }}
                >
                    <defs>
                        <linearGradient id="colorFlow_analytics" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={currentTheme.accent} stopOpacity={0.5} />
                            <stop offset="40%" stopColor={currentTheme.accent} stopOpacity={0.15} />
                            <stop offset="90%" stopColor={currentTheme.accent} stopOpacity={0.02} />
                            <stop offset="100%" stopColor={currentTheme.accent} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="strokeFlow_analytics" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={currentTheme.accent} stopOpacity={0.4} style={{ transition: 'stop-color 1000ms ease-in-out' }} />
                            <stop offset="50%" stopColor={currentTheme.accent} stopOpacity={1} style={{ transition: 'stop-color 1000ms ease-in-out' }} />
                            <stop offset="100%" stopColor={currentTheme.accent} stopOpacity={0.4} style={{ transition: 'stop-color 1000ms ease-in-out' }} />
                        </linearGradient>
                        <filter id="glow_analytics" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
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
                        tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9, fontWeight: 700, letterSpacing: '0.05em' }}
                        dy={15}
                        padding={{ left: 30, right: 30 }}
                    />

                    <YAxis hide domain={[0, 'auto']} />

                    <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 12 }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const label = payload[0].payload.tooltipLabel || payload[0].payload.date;
                                return (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="relative min-w-[120px] p-[1px] rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                                    >
                                        {/* Animated Border Gradient */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/5" />

                                        <div className="relative bg-zinc-900/90 backdrop-blur-3xl rounded-[11px] p-3.5">
                                            {/* Left Accent Bar */}
                                            <div
                                                className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
                                                style={{ background: currentTheme.accent, boxShadow: `0 0 8px ${currentTheme.accent}` }}
                                            />

                                            <div className="flex items-center gap-3">
                                                <p className="text-[10px] font-bold text-white/90 whitespace-nowrap">
                                                    {label}
                                                </p>

                                                <div className="w-[1px] h-3 bg-white/10" />

                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-xl font-black text-white tabular-nums leading-none">
                                                        {payload[0].value}
                                                    </span>
                                                    <span className="text-[9px] font-black text-zinc-400 uppercase">min</span>
                                                </div>
                                            </div>

                                            {/* Background Glow */}
                                            <div
                                                className="absolute -right-3 -bottom-3 w-12 h-12 blur-2xl opacity-10 pointer-events-none rounded-full"
                                                style={{ background: currentTheme.accent }}
                                            />
                                        </div>
                                    </motion.div>
                                );
                            }
                            return null;
                        }}
                    />

                    {/* Operational Trend Area */}
                    <Area
                        type="monotone"
                        dataKey="minutes"
                        stroke={currentTheme.accent}
                        strokeWidth={2}
                        fill="url(#colorFlow_analytics)"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        isAnimationActive={!isTouchDevice}
                        animationDuration={1000}
                        animationEasing="ease-in-out"
                        activeDot={{
                            r: 8,
                            fill: "#fff",
                            stroke: currentTheme.accent,
                            strokeWidth: 4,
                            style: {
                                filter: `drop-shadow(0 0 12px ${currentTheme.accent})`
                            }
                        }}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </motion.div>
    );
}
