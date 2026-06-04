"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    side?: "top" | "bottom" | "left" | "right";
    className?: string;
    accentColor?: string;
}

export function Tooltip({
    content,
    children,
    side = "top",
    className,
    accentColor,
}: TooltipProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLElement>(null);
    const coordsRef = useRef<{ top: number; left: number } | null>(null);

    const updateCoords = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        
        let top = 0;
        let left = 0;

        if (side === "top") {
            top = rect.top;
            left = rect.left + rect.width / 2;
        } else if (side === "bottom") {
            top = rect.bottom;
            left = rect.left + rect.width / 2;
        } else if (side === "left") {
            top = rect.top + rect.height / 2;
            left = rect.left;
        } else if (side === "right") {
            top = rect.top + rect.height / 2;
            left = rect.right;
        }

        if (
            coordsRef.current &&
            coordsRef.current.top === top &&
            coordsRef.current.left === left
        ) {
            return;
        }
        coordsRef.current = { top, left };
        setCoords({ top, left });
    };

    const handleMouseEnter = () => {
        updateCoords();
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        setIsOpen(false);
    };

    useEffect(() => {
        if (!isOpen) return;

        let animationFrameId: number;
        const tick = () => {
            updateCoords();
            animationFrameId = requestAnimationFrame(tick);
        };
        tick();

        window.addEventListener("scroll", updateCoords, { passive: true });
        window.addEventListener("resize", updateCoords, { passive: true });
        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener("scroll", updateCoords);
            window.removeEventListener("resize", updateCoords);
        };
    }, [isOpen, side]);

    const transformStyles = {
        top: "translate(-50%, -100%) translateY(-2px)",
        bottom: "translate(-50%, 0) translateY(2px)",
        left: "translate(-100%, -50%) translateX(-2px)",
        right: "translate(0, -50%) translateX(2px)",
    };

    const arrowStyles = {
        top: "bottom-[-4px] left-1/2 -translate-x-1/2 rotate-45 border-r border-b",
        bottom: "top-[-4px] left-1/2 -translate-x-1/2 rotate-45 border-l border-t",
        left: "right-[-4px] top-1/2 -translate-y-1/2 rotate-45 border-r border-t",
        right: "left-[-4px] top-1/2 -translate-y-1/2 rotate-45 border-l border-b",
    };

    const child = React.Children.only(children) as React.ReactElement<any>;
    
    const setRefs = (node: HTMLElement | null) => {
        (triggerRef as any).current = node;
        const { ref } = child as any;
        if (typeof ref === "function") {
            ref(node);
        } else if (ref && typeof ref === "object") {
            ref.current = node;
        }
    };

    const clonedChild = React.cloneElement(child, {
        ref: setRefs,
        onMouseEnter: (e: any) => {
            child.props.onMouseEnter?.(e);
            handleMouseEnter();
        },
        onMouseLeave: (e: any) => {
            child.props.onMouseLeave?.(e);
            handleMouseLeave();
        },
        onFocus: (e: any) => {
            child.props.onFocus?.(e);
            handleMouseEnter();
        },
        onBlur: (e: any) => {
            child.props.onBlur?.(e);
            handleMouseLeave();
        },
    });

    return (
        <>
            {clonedChild}

            {typeof document !== "undefined" &&
                createPortal(
                    <AnimatePresence>
                        {isOpen && coords && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.12, ease: "easeOut" }}
                                className="fixed z-[9999] pointer-events-none"
                                style={{
                                    top: coords.top,
                                    left: coords.left,
                                }}
                            >
                                <div
                                    style={{
                                        transform: transformStyles[side],
                                    }}
                                >
                                    <div
                                        className={cn(
                                            "bg-zinc-950/95 border text-white rounded-lg shadow-xl backdrop-blur-md px-2.5 py-1.5 text-[10px] font-semibold tracking-wide whitespace-nowrap relative z-10 transition-colors duration-300",
                                            className
                                        )}
                                        style={{ borderColor: accentColor ? `${accentColor}33` : "rgba(255,255,255,0.12)" }}
                                    >
                                        {content}
                                        <div
                                            className={cn(
                                                "w-1.5 h-1.5 bg-zinc-950 absolute z-0 transition-colors duration-300",
                                                arrowStyles[side]
                                            )}
                                            style={{ borderColor: accentColor ? `${accentColor}33` : "rgba(255,255,255,0.12)" }}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}
        </>
    );
}
