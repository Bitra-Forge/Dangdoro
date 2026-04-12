"use client";

import { useEffect, useRef } from "react";
import { BG_PALETTES } from "@/lib/background-config";

export function AnimatedDotGrid({ 
    showDots = true, 
    palette = "mixed" 
}: { 
    showDots?: boolean; 
    palette?: keyof typeof BG_PALETTES;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({ x: -1000, y: -1000 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const DOT_SPACING = 18;
        const DOT_RADIUS = 1;
        const HOVER_RADIUS = 100;

        const resize = () => { 
            canvas.width = window.innerWidth; 
            canvas.height = window.innerHeight; 
        };
        resize();
        window.addEventListener("resize", resize);
        
        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener("mousemove", handleMouseMove);

        const paletteConfig = BG_PALETTES[palette] || BG_PALETTES.mixed;
        const orbs = paletteConfig.orbs.map((o, i) => ({
            ...o,
            speed: 0.00014 + (i * 0.00003),
            phase: i * 1.8
        }));

        let raf: number;
        const draw = (t: number) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw background orbs
            for (const o of orbs) {
                const cx = o.x * canvas.width + Math.sin(t * o.speed + o.phase) * 70;
                const cy = o.y * canvas.height + Math.cos(t * o.speed + o.phase) * 50;
                const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, o.r);
                g.addColorStop(0, `rgba(${o.color},0.13)`);
                g.addColorStop(1, `rgba(${o.color},0)`);
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(cx, cy, o.r, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Draw dots with hover effect (only if enabled)
            if (showDots) {
                const mx = mouseRef.current.x;
                const my = mouseRef.current.y;
                const cols = Math.ceil(canvas.width / DOT_SPACING) + 1;
                const rows = Math.ceil(canvas.height / DOT_SPACING) + 1;
                const HOVER_RADIUS_SQ = HOVER_RADIUS * HOVER_RADIUS;
                
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        const x = col * DOT_SPACING;
                        const y = row * DOT_SPACING;
                        
                        // Calculate square distance from mouse (faster than sqrt)
                        const dx = x - mx;
                        const dy = y - my;
                        const distSq = dx * dx + dy * dy;
                        
                        // Calculate opacity based on distance (closer = brighter)
                        let opacity = 0.09;
                        if (distSq < HOVER_RADIUS_SQ) {
                            const dist = Math.sqrt(distSq);
                            const intensity = 1 - (dist / HOVER_RADIUS);
                            opacity = 0.09 + (intensity * intensity * 0.6);
                        }
                        
                        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                        // fillRect is much faster than arc() for small dots
                        ctx.fillRect(x - DOT_RADIUS, y - DOT_RADIUS, DOT_RADIUS * 2, DOT_RADIUS * 2);
                    }
                }
            }
            
            raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => { 
            cancelAnimationFrame(raf); 
            window.removeEventListener("resize", resize); 
            window.removeEventListener("mousemove", handleMouseMove);
        };
    }, [showDots, palette]);

    return (
        <>
            <div className="fixed inset-0 z-0 pointer-events-none" style={{ backgroundColor: "#09090b" }} />
            <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-[1]" />
        </>
    );
}
