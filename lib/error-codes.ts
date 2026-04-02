/**
 * Maps Firebase Auth error codes to user-friendly "Forge" themed messages.
 */
export const mapAuthError = (error: any): string => {
    const code = error?.code || "";
    const message = error?.message || "";

    switch (code) {
        case "auth/email-already-in-use":
            return "This email is already linked to another legend. Try signing in instead.";
        case "auth/invalid-email":
            return "The email format is invalid. Ensure your scroll is written correctly.";
        case "auth/weak-password":
            return "Your password is too weak. A true hero needs at least 6 characters.";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "Invalid credentials. The forge does not recognize these secrets.";
        case "auth/operation-not-allowed":
            return "This authentication method is currently locked by the Grandmasters.";
        case "auth/popup-closed-by-user":
            return "The connection window was closed before completion.";
        case "auth/network-request-failed":
            return "Network instability detected. The forge remains out of reach.";
        case "auth/too-many-requests":
            return "Too many attempts. The forge is cooling down, please wait.";
        case "auth/credential-already-in-use":
            return "This account is already linked to another identity.";
        case "auth/requires-recent-login":
            return "This high-security action requires a fresh sign-in.";
        default:
            // Fallback for unknown errors - try to clean up the Firebase prefix if possible
            if (message.includes("Firebase:")) {
                return message.replace("Firebase:", "").replace(/\(auth\/.*\)\.?/, "").trim() || "An unexpected error occurred in the forge.";
            }
            return message || "An unexpected error occurred in the forge.";
    }
};
