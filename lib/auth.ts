import { auth } from "./firebase";
import {
    signInAnonymously,
    signInWithPopup,
    GoogleAuthProvider,
    linkWithPopup,
    signOut,
    User,
    AuthError,
    signInWithCredential,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    linkWithCredential,
    EmailAuthProvider,
    updateProfile
} from "firebase/auth";
import { syncUserProfile } from "./db";

// Automatically signs in anonymously if no user exists.
// AuthProvider or components can call this.
export const signInGuest = async () => {
    // If we're already signed in anonymously, just return the user
    if (auth.currentUser && auth.currentUser.isAnonymous) {
        return auth.currentUser;
    }

    try {
        console.log("signInGuest: Initiating fresh anonymous sign-in...");
        const userCredential = await signInAnonymously(auth);
        console.log("signInGuest: Successfully started fresh session:", userCredential.user.uid);
        return userCredential.user;
    } catch (error: any) {
        if (error.code === 'auth/operation-not-allowed') {
            console.error("❌ CRITICAL: Anonymous authentication is NOT enabled in your Firebase Console.");
        } else {
            console.error("❌ Error during guest sign-in:", error);
            // If the current session is invalid/deleted, force a sign-out so we can try again next time
            await signOut(auth).catch(() => { });
        }
        throw error;
    }
};

// Standard Google Sign-In
export const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const userCredential = await signInWithPopup(auth, provider);
        await syncUserProfile(userCredential.user);
        return userCredential.user;
    } catch (error) {
        console.error("Error signing in with Google", error);
        throw error;
    }
};

// Upgrade Anonymous Account to a Permanent Google Account
export const linkAnonymousToGoogle = async (user: User) => {
    if (!user.isAnonymous) {
        throw new Error("User is already permanently authenticated.");
    }
    const provider = new GoogleAuthProvider();
    try {
        const result = await linkWithPopup(user, provider);
        await syncUserProfile(result.user);
        return result.user;
    } catch (error) {
        const authError = error as AuthError;
        if (authError.code === "auth/credential-already-in-use") {
            const credential = GoogleAuthProvider.credentialFromError(authError);
            if (credential) {
                const result = await signInWithCredential(auth, credential);
                await syncUserProfile(result.user);
                return result.user;
            }
        }
        console.error("Error linking with Google", authError);
        throw authError;
    }
};

export const logOut = async () => {
    try {
        if (typeof window !== "undefined") {
            localStorage.setItem("manual-sign-out", "true");
        }
        await signOut(auth);
    } catch (error) {
        console.error("Error signing out", error);
        throw error;
    }
};

// Email/Password Authentication
export const signUpWithEmail = async (email: string, pass: string, displayName: string) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        // Set initial profile name
        await updateProfile(userCredential.user, { displayName });
        await syncUserProfile(userCredential.user);
        return userCredential.user;
    } catch (error: any) {
        if (error.code === "auth/operation-not-allowed") {
            console.error("❌ CRITICAL: Email/Password authentication is NOT enabled in your Firebase Console.");
        }
        console.error("Error signing up with email", error);
        throw error;
    }
};

export const signInWithEmail = async (email: string, pass: string) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        await syncUserProfile(userCredential.user);
        return userCredential.user;
    } catch (error: any) {
        if (error.code === "auth/operation-not-allowed") {
            console.error("❌ CRITICAL: Email/Password authentication is NOT enabled in your Firebase Console.");
        }
        console.error("Error signing in with email", error);
        throw error;
    }
};

export const linkAnonymousToEmail = async (user: User, email: string, pass: string, displayName?: string) => {
    if (!user.isAnonymous) {
        throw new Error("User is already permanently authenticated.");
    }
    const credential = EmailAuthProvider.credential(email, pass);
    try {
        const result = await linkWithCredential(user, credential);
        // Only update name if it was explicitly provided (Sign Up flow)
        if (displayName) {
            await updateProfile(result.user, { displayName });
        }
        await syncUserProfile(result.user);
        return result.user;
    } catch (error: any) {
        if (error.code === "auth/operation-not-allowed") {
            console.error("❌ CRITICAL: Email/Password authentication is NOT enabled in your Firebase Console.");
        }
        // Let the caller handle "email-already-in-use" to show a specific warning
        console.error("Error linking with email:", error.code, error.message);
        throw error;
    }
};


