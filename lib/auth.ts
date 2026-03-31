import { auth } from "./firebase";
import {
    signInAnonymously,
    signInWithPopup,
    GoogleAuthProvider,
    linkWithPopup,
    signOut,
    User,
    AuthError
} from "firebase/auth";

// Automatically signs in anonymously if no user exists.
// AuthProvider will call this.
export const signInGuest = async () => {
    try {
        const userCredential = await signInAnonymously(auth);
        return userCredential.user;
    } catch (error) {
        console.error("Error signing in anonymously", error);
        throw error;
    }
};

// Standard Google Sign-In
export const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const userCredential = await signInWithPopup(auth, provider);
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
        return result.user;
    } catch (error) {
        const authError = error as AuthError;
        // Handle specific linking errors (e.g. credential already in use)
        console.error("Error linking with Google", authError);
        throw authError;
    }
};

export const logOut = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error signing out", error);
        throw error;
    }
};
