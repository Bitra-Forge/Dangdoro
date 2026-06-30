import {
    collection, addDoc, doc, updateDoc, getDoc, setDoc, query, orderBy, onSnapshot,
    where, getDocs, deleteDoc, limit, serverTimestamp,
    arrayUnion, arrayRemove
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChatMessage } from "@/lib/groups";

export async function sendMessage(
    groupId: string,
    senderId: string,
    senderName: string,
    senderPhoto: string,
    content: string,
    replyTo: { messageId: string; senderName: string; preview: string } | null = null
) {
    const messagesRef = collection(db, `focusGroups/${groupId}/messages`);

    await addDoc(messagesRef, {
        senderId,
        senderName,
        senderPhoto,
        content,
        type: "text",
        replyTo,
        reactions: {},
        edited: false,
        editedAt: null,
        deletedAt: null,
        pinned: false,
        pinnedBy: null,
        createdAt: serverTimestamp(),
    });

    const countSnap = await getDocs(messagesRef);
    if (countSnap.size > 30) {
        const oldestQuery = query(
            messagesRef,
            where("pinned", "==", false),
            orderBy("createdAt", "asc"),
            limit(1)
        );
        const oldestSnap = await getDocs(oldestQuery);
        oldestSnap.forEach(doc => deleteDoc(doc.ref));
    }
}

export function subscribeToMessages(
    groupId: string,
    callback: (messages: ChatMessage[]) => void
): () => void {
    const messagesRef = collection(db, `focusGroups/${groupId}/messages`);
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(30));

    const unsub = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as ChatMessage));
        callback(messages);
    });

    return unsub;
}

export async function replyToMessage(
    groupId: string,
    message: ChatMessage,
    content: string,
    senderId: string,
    senderName: string,
    senderPhoto: string
) {
    const messagesRef = collection(db, `focusGroups/${groupId}/messages`);

    await addDoc(messagesRef, {
        senderId,
        senderName,
        senderPhoto,
        content,
        type: "text",
        replyTo: {
            messageId: message.id,
            senderName: message.senderName,
            preview: message.content.slice(0, 100),
        },
        reactions: {},
        edited: false,
        editedAt: null,
        deletedAt: null,
        pinned: false,
        pinnedBy: null,
        createdAt: serverTimestamp(),
    });

    const countSnap = await getDocs(messagesRef);
    if (countSnap.size > 30) {
        const oldestQuery = query(
            messagesRef,
            where("pinned", "==", false),
            orderBy("createdAt", "asc"),
            limit(1)
        );
        const oldestSnap = await getDocs(oldestQuery);
        oldestSnap.forEach(doc => deleteDoc(doc.ref));
    }
}

export async function editMessage(
    groupId: string,
    messageId: string,
    newContent: string
) {
    const msgRef = doc(db, `focusGroups/${groupId}/messages`, messageId);
    await updateDoc(msgRef, {
        content: newContent,
        edited: true,
        editedAt: serverTimestamp(),
    });
}

export async function softDeleteMessage(
    groupId: string,
    messageId: string
) {
    const msgRef = doc(db, `focusGroups/${groupId}/messages`, messageId);
    await updateDoc(msgRef, {
        content: "",
        deletedAt: serverTimestamp(),
    });
}

export async function toggleReaction(
    groupId: string,
    messageId: string,
    emoji: string,
    userId: string
) {
    const msgRef = doc(db, `focusGroups/${groupId}/messages`, messageId);
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const current: string[] = data.reactions?.[emoji] || [];
    if (current.includes(userId)) {
        await updateDoc(msgRef, {
            [`reactions.${emoji}`]: arrayRemove(userId),
        });
    } else {
        await updateDoc(msgRef, {
            [`reactions.${emoji}`]: arrayUnion(userId),
        });
    }
}

export async function togglePin(
    groupId: string,
    messageId: string,
    userId: string,
    currentlyPinned: boolean
) {
    const msgRef = doc(db, `focusGroups/${groupId}/messages`, messageId);
    if (currentlyPinned) {
        await updateDoc(msgRef, {
            pinned: false,
            pinnedBy: null,
        });
    } else {
        await updateDoc(msgRef, {
            pinned: true,
            pinnedBy: userId,
        });
    }
}

export function subscribeToPinnedMessages(
    groupId: string,
    callback: (messages: ChatMessage[]) => void
): () => void {
    const messagesRef = collection(db, `focusGroups/${groupId}/messages`);
    const q = query(
        messagesRef,
        where("pinned", "==", true),
        orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as ChatMessage));
        callback(messages);
    });

    return unsub;
}

export async function setTyping(
    groupId: string,
    userId: string,
    isTyping: boolean,
    displayName?: string
) {
    const presenceRef = doc(db, `focusGroups/${groupId}/presence`, userId);
    await setDoc(presenceRef, {
        typing: isTyping,
        typingAt: serverTimestamp(),
        displayName: displayName || null,
    }, { merge: true });
}

export async function clearTyping(
    groupId: string,
    userId: string
) {
    const presenceRef = doc(db, `focusGroups/${groupId}/presence`, userId);
    await setDoc(presenceRef, {
        typing: false,
        typingAt: serverTimestamp(),
    }, { merge: true });
}

export function subscribeToTypingPresence(
    groupId: string,
    callback: (typers: { userId: string; displayName: string }[]) => void
): () => void {
    const presenceRef = collection(db, `focusGroups/${groupId}/presence`);
    const unsub = onSnapshot(presenceRef, (snapshot) => {
        const now = Date.now();
        const typers: { userId: string; displayName: string }[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.typing) return;
            const typingAt = data.typingAt;
            let ts: number | null = null;
            if (typingAt?.toMillis) ts = typingAt.toMillis();
            else if (typingAt?.seconds) ts = typingAt.seconds * 1000;
            if (ts && now - ts < 5000) {
                typers.push({ userId: doc.id, displayName: data.displayName || "Someone" });
            }
        });
        callback(typers);
    });
    return unsub;
}
