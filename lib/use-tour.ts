"use client";

import { useEffect, useRef, useState } from "react";
import { driver as createDriver, type Driver, type Side, type Alignment } from "driver.js";
import "driver.js/dist/driver.css";

export interface TourStep {
    element?: string | Element;
    popover: {
        title: string;
        description: string;
        side?: Side;
        align?: Alignment;
    };
}

export interface UseTourOptions {
    pageName: string;
    steps: TourStep[];
    onComplete?: () => void;
    onDismiss?: () => void;
    isGuest?: boolean;
}

export function useTour({ pageName, steps, onComplete, onDismiss, isGuest = false }: UseTourOptions) {
    const driverRef = useRef<Driver | null>(null);
    const [hasSeenTour, setHasSeenTour] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);

    const storageKey = `seen-${pageName}-tour`;

    // Keep callbacks in refs to avoid recreating the driver on callback changes
    const onCompleteRef = useRef(onComplete);
    const onDismissRef = useRef(onDismiss);

    useEffect(() => {
        onCompleteRef.current = onComplete;
        onDismissRef.current = onDismiss;
    }, [onComplete, onDismiss]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const seen = localStorage.getItem(storageKey);
            setHasSeenTour(seen === "true");
            setIsHydrated(true);
        }
    }, [storageKey]);

    const stepsString = JSON.stringify(steps);
    const isUnmountingRef = useRef(false);

    useEffect(() => {
        if (!isHydrated || hasSeenTour || steps.length === 0) return;

        isUnmountingRef.current = false;

        const driverObj: Driver = createDriver({
            allowClose: false,
            disableActiveInteraction: true,
            nextBtnText: "Next",
            prevBtnText: "Previous",
            doneBtnText: "Done",
            showProgress: true,
            overlayColor: "#0d0c0a",
            overlayOpacity: 0.45,
            stageRadius: 12,
            steps: steps.map((step) => ({
                element: step.element,
                popover: {
                    title: step.popover.title,
                    description: step.popover.description,
                    side: step.popover.side,
                    align: step.popover.align,
                    onPopoverRender: (popover) => {
                        console.log("[Tour] Rendering popover step...");
                        
                        // Hide previous button on the first step
                        if (driverObj.isFirstStep()) {
                            popover.previousButton.style.display = "none";
                        }

                        const activeIndex = driverObj.getActiveIndex();
                        const isLast = driverObj.isLastStep();

                        // Hide skip button on the last step if guest
                        if (isGuest && isLast) {
                            const existingSkip = popover.wrapper.querySelector(".tour-skip-btn") as HTMLElement;
                            if (existingSkip) {
                                existingSkip.style.display = "none";
                            }
                            return;
                        }

                        // Check if Skip button already exists to avoid duplicates
                        if (popover.wrapper.querySelector(".tour-skip-btn")) {
                            console.log("[Tour] Skip button already exists, skipping creation");
                            return;
                        }

                        // Create skip button
                        const skipBtn = document.createElement("button");
                        skipBtn.type = "button";
                        skipBtn.className = "tour-skip-btn";
                        skipBtn.innerText = "Skip";
                        skipBtn.style.marginRight = "auto";
                        skipBtn.onclick = () => {
                            const currentIndex = driverObj.getActiveIndex();
                            const totalSteps = steps.length;
                            if (isGuest && currentIndex !== undefined && currentIndex < totalSteps - 1) {
                                console.log("[Tour] Guest clicked Skip, forwarding to last step...");
                                driverObj.moveTo(totalSteps - 1);
                            } else {
                                console.log("[Tour] Skip button clicked, destroying tour...");
                                localStorage.setItem(storageKey, "true");
                                setHasSeenTour(true);
                                onDismissRef.current?.();
                                driverObj.destroy();
                            }
                        };

                        // Add to footer navigation buttons container before previous button
                        try {
                            popover.footerButtons.insertBefore(skipBtn, popover.previousButton);
                            console.log("[Tour] Successfully inserted Skip button before Previous button");
                        } catch (err) {
                            console.error("[Tour] Failed to insert Skip button before Previous button, appending directly to footerButtons:", err);
                            try {
                                popover.footerButtons.appendChild(skipBtn);
                            } catch (appendErr) {
                                console.error("[Tour] Failed to append Skip button directly:", appendErr);
                            }
                        }
                    },
                },
            })),
            onDestroyStarted: () => {
                if (isUnmountingRef.current) return;

                const isLast = driverObj.isLastStep();
                localStorage.setItem(storageKey, "true");
                setHasSeenTour(true);

                if (isLast) {
                    onCompleteRef.current?.();
                } else {
                    onDismissRef.current?.();
                }
            },
        });

        driverRef.current = driverObj;
        driverObj.drive();

        return () => {
            isUnmountingRef.current = true;
            driverObj.destroy();
        };
    }, [isHydrated, hasSeenTour, stepsString, storageKey]);

    const startTour = () => {
        if (driverRef.current) {
            driverRef.current.drive();
        }
    };

    const resetTour = () => {
        if (typeof window !== "undefined") {
            localStorage.removeItem(storageKey);
            setHasSeenTour(false);
        }
    };

    return {
        hasSeenTour,
        isHydrated,
        startTour,
        resetTour,
    };
}