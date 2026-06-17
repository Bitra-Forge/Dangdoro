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
}

export function useTour({ pageName, steps, onComplete, onDismiss }: UseTourOptions) {
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
            allowClose: true,
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