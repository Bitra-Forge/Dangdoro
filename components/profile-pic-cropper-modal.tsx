"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Cropper, { type Area as CropArea } from "react-easy-crop";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tooltip } from "@/components/ui/tooltip";

interface ProfilePicCropperModalProps {
    image: string;
    currentTheme: { name: string; colors: string[]; accent: string; glow: string; text?: string };
    onClose: () => void;
    onConfirm: (base64Image: string) => Promise<void>;
}

export default function ProfilePicCropperModal({ image, currentTheme, onClose, onConfirm }: ProfilePicCropperModalProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const onCropComplete = (_: CropArea, pixels: CropArea) => setCroppedAreaPixels(pixels);

    const handleConfirm = async () => {
        if (!croppedAreaPixels) return;
        setIsSaving(true);
        try {
            const base64Image = await getCroppedImgBase64(image, croppedAreaPixels);
            if (!base64Image) throw new Error();
            await onConfirm(base64Image);
        } catch {
            toast.error("Failed to crop image.");
        } finally {
            setIsSaving(false);
        }
    };

    const getCroppedImgBase64 = async (imageSrc: string, pixelCrop: CropArea): Promise<string | null> => {
        const img = new Image();
        img.src = imageSrc;
        await new Promise((res, resRej) => {
            img.onload = res;
            img.onerror = resRej;
        });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        // High quality scale
        canvas.width = 512;
        canvas.height = 512;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(
            img,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            512,
            512
        );
        return canvas.toDataURL("image/jpeg", 0.92);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-zinc-950/90 backdrop-blur-xl flex items-center justify-center p-4"
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                className="w-full max-w-xl bg-zinc-900 border border-white/10 rounded-[3rem] overflow-hidden relative shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col"
            >
                <div className="relative w-full aspect-square bg-zinc-950">
                    <Cropper
                        image={image}
                        crop={crop}
                        zoom={zoom}
                        minZoom={1}
                        maxZoom={3}
                        aspect={1}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                        cropShape="rect"
                        showGrid={false}
                    />
                </div>
                <div className="flex items-center gap-4 px-8 py-4 bg-zinc-900/90 border-t border-white/5">
                    <Tooltip content="Zoom Out" accentColor={currentTheme.accent}>
                        <button
                            type="button"
                            onClick={() => setZoom(Math.max(1, zoom - 0.2))}
                            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                    </Tooltip>
                    <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.05}
                        aria-label="Zoom"
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white transition-all"
                        style={{ accentColor: currentTheme.accent }}
                    />
                    <Tooltip content="Zoom In" accentColor={currentTheme.accent}>
                        <button
                            type="button"
                            onClick={() => setZoom(Math.min(3, zoom + 0.2))}
                            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                    </Tooltip>
                </div>
                <div className="p-8 bg-zinc-950/80 backdrop-blur-xl flex items-center justify-between border-t border-white/5">
                    <Button variant="ghost" disabled={isSaving} onClick={onClose} className="text-zinc-500 hover:text-white uppercase ubuntu-bold font-black text-xs tracking-[0.2em] active:translate-y-0">Cancel</Button>
                    <motion.div
                        whileHover={isSaving ? undefined : {
                            boxShadow: `0 0 35px ${currentTheme.accent}66`
                        }}
                        whileTap={isSaving ? undefined : { scale: 0.98 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="rounded-2xl"
                    >
                        <Button
                            onClick={handleConfirm}
                            disabled={isSaving}
                            className="ubuntu-bold font-black uppercase text-xs tracking-[0.3em] px-10 h-12 rounded-2xl shadow-xl transition-all cursor-pointer active:translate-y-0"
                            style={{
                                backgroundColor: currentTheme.accent,
                                color: currentTheme.text || "#FFFFFF",
                                boxShadow: `0 0 30px ${currentTheme.accent}44`
                            }}
                        >
                            {isSaving ? "Saving..." : "Confirm"}
                        </Button>
                    </motion.div>
                </div>
            </motion.div>
        </motion.div>
    );
}
