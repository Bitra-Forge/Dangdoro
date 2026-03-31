import { auth } from "./firebase";
import {
    signInAnonymously,
    signInWithPopup,
    GoogleAuthProvider,
    linkWithPopup,
    signOut,
    User,
    AuthError,
    signInWithCredential
} from "firebase/auth";
import { syncUserProfile } from "./db";

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
        await signOut(auth);
    } catch (error) {
        console.error("Error signing out", error);
        throw error;
    }
};
