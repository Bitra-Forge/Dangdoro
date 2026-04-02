"use client";

import { useAuth } from "@/components/AuthProvider";
import { AuthCard } from "@/components/AuthCard";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

export function GlobalAuthModal() {
    const { isAuthModalOpen, closeAuthVault } = useAuth();

    return (
        <Dialog open={isAuthModalOpen} onOpenChange={closeAuthVault}>
            <DialogContent showCloseButton={false} className="bg-zinc-950 border-white/10 text-white max-w-md rounded-[2.5rem] p-8 shadow-2xl shadow-sky-500/5 overflow-hidden">
                <DialogTitle className="sr-only">Auth Vault Identity Access</DialogTitle>
                <DialogDescription className="sr-only">Connect to establish your permanent legacy slot.</DialogDescription>
                <AuthCard isModal onSuccess={closeAuthVault} />
            </DialogContent>
        </Dialog>
    );
}
