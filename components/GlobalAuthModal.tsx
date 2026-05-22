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
            <DialogContent showCloseButton={false} className="bg-transparent border-none text-white max-w-md p-0 shadow-none">
                <DialogTitle className="sr-only">Sign in</DialogTitle>
                <DialogDescription className="sr-only">Access your account.</DialogDescription>
                <AuthCard isModal onSuccess={closeAuthVault} />
            </DialogContent>
        </Dialog>
    );
}
