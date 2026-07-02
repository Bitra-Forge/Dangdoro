"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ChatMessage } from "@/lib/groups";
import { sendMessage, subscribeToMessages, replyToMessage, editMessage, softDeleteMessage, toggleReaction, togglePin, subscribeToPinnedMessages, setTyping, clearTyping, subscribeToTypingPresence } from "@/lib/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useChatNotificationStore } from "@/lib/stores/chat-notification-store";
import { Send, Reply, PencilLine, Trash2, X, Pin, ChevronDown, ChevronUp, BookmarkPlus } from "lucide-react";
import { cn, extractFirstUrl } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { addMaterial } from "@/lib/materials";
import { toast } from "sonner";

interface GroupChatProps {
    groupId: string;
    isHost?: boolean;
    groupMembers?: any[];
}

export function GroupChat({ groupId, isHost, groupMembers = [] }: GroupChatProps) {
    const { user } = useAuth();
    const router = useRouter();
    const memberPhotoMap = useMemo(() => {
        const map: Record<string, string> = {};
        groupMembers.forEach(m => {
            if (m.uid && m.photoURL) {
                map[m.uid] = m.photoURL;
            }
        });
        return map;
    }, [groupMembers]);
    const memberNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        groupMembers.forEach(m => {
            if (m.uid && m.displayName) {
                map[m.uid] = m.displayName;
            }
        });
        return map;
    }, [groupMembers]);
    const getUserName = (uid: string) => {
        if (uid === user?.uid) return "You";
        return memberNameMap[uid] || "Unknown User";
    };
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [replyToMsg, setReplyToMsg] = useState<{ messageId: string; senderName: string; preview: string } | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);
    const [pinStripOpen, setPinStripOpen] = useState(false);
    const [typingUsers, setTypingUsers] = useState<{ userId: string; displayName: string }[]>([]);
    const [materialFormMsgId, setMaterialFormMsgId] = useState<string | null>(null);
    const [materialUrl, setMaterialUrl] = useState("");
    const [materialTitle, setMaterialTitle] = useState("");
    const [materialTags, setMaterialTags] = useState("");
    const [showTips, setShowTips] = useState(() => {
        if (typeof window === "undefined") return true;
        return !localStorage.getItem("dangdoro_markdown_tips_dismissed");
    });
    const bottomRef = useRef<HTMLDivElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);
    const lastTypingRef = useRef(0);
    const silenceTimer = useRef<any>(null);
    const { setDraft, clearDraft } = useChatNotificationStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const isFirstLoadRef = useRef(true);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const unsub = subscribeToMessages(groupId, (newMessages) => {
            setMessages(prev => {
                const tempMsgs = prev.filter(m => 
                    m.id.startsWith("temp_") && 
                    !newMessages.some(nm => nm.content === m.content && nm.senderId === m.senderId)
                );
                return [...tempMsgs, ...newMessages];
            });
        });
        return unsub;
    }, [groupId]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const threshold = 100;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;

        if (isNearBottom || isFirstLoadRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            if (messages.length > 0) {
                isFirstLoadRef.current = false;
            }
        }
    }, [messages]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [input]);

    useEffect(() => {
        const currentDraft = useChatNotificationStore.getState().drafts[groupId] || "";
        setInput(currentDraft);
    }, [groupId]);

    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus();
        }
    }, [editingId]);

    useEffect(() => {
        if (!user) return;
        const handleVisibility = () => {
            if (document.hidden) {
                clearTyping(groupId, user.uid);
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibility);
            clearTyping(groupId, user.uid);
            if (silenceTimer.current) {
                clearTimeout(silenceTimer.current);
            }
        };
    }, [groupId, user]);

    useEffect(() => {
        const unsub = subscribeToPinnedMessages(groupId, setPinnedMessages);
        return unsub;
    }, [groupId]);

    useEffect(() => {
        if (!user) return;
        const uid = user.uid;
        const unsub = subscribeToTypingPresence(groupId, (typers) => {
            setTypingUsers(typers.filter(t => t.userId !== uid));
        });
        return unsub;
    }, [groupId, user]);

    const findMessage = (messageId: string) => messages.find(m => m.id === messageId);

    const handleSend = async () => {
        const textToSend = input.trim();
        if (!textToSend || !user || sending) return;

        if (silenceTimer.current) {
            clearTimeout(silenceTimer.current);
            silenceTimer.current = null;
        }

        const tempMessage: ChatMessage = {
            id: "temp_" + Date.now(),
            senderId: user.uid,
            senderName: user.displayName || "Anonymous",
            senderPhoto: user.photoURL || "",
            content: textToSend,
            type: "text",
            replyTo: replyToMsg ? {
                messageId: replyToMsg.messageId,
                senderName: replyToMsg.senderName,
                preview: replyToMsg.preview
            } : null,
            reactions: {},
            edited: false,
            editedAt: null,
            deletedAt: null,
            pinned: false,
            pinnedBy: null,
            createdAt: { toDate: () => new Date() } as any
        };

        setMessages(prev => [tempMessage, ...prev]);
        setInput("");
        setReplyToMsg(null);
        clearTyping(groupId, user.uid);
        clearDraft(groupId);

        setSending(true);
        try {
            if (replyToMsg) {
                const original = findMessage(replyToMsg.messageId);
                if (original && !original.deletedAt) {
                    await replyToMessage(groupId, original, textToSend, user.uid, user.displayName || "Anonymous", user.photoURL || "");
                } else {
                    await sendMessage(groupId, user.uid, user.displayName || "Anonymous", user.photoURL || "", textToSend, replyToMsg);
                }
            } else {
                await sendMessage(groupId, user.uid, user.displayName || "Anonymous", user.photoURL || "", textToSend, null);
            }
        } catch (err) {
            console.error("Failed to send message:", err);
            setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && e.shiftKey) {
            return; // allow default textarea behavior (new line)
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleEditKeyDown = (e: React.KeyboardEvent, messageId: string) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            saveEdit(messageId);
        } else if (e.key === "Escape") {
            cancelEdit();
        }
    };

    const startEdit = (msg: ChatMessage) => {
        setEditingId(msg.id);
        setEditContent(msg.content);
    };

    const saveEdit = async (messageId: string) => {
        if (!editContent.trim()) return;
        try {
            await editMessage(groupId, messageId, editContent.trim());
            setEditingId(null);
            setEditContent("");
        } catch (err) {
            console.error("Failed to edit message:", err);
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditContent("");
    };

    const handleDelete = async (messageId: string) => {
        try {
            await softDeleteMessage(groupId, messageId);
        } catch (err) {
            console.error("Failed to delete message:", err);
        }
    };

    const startReply = (msg: ChatMessage) => {
        setReplyToMsg({
            messageId: msg.id,
            senderName: msg.senderName,
            preview: msg.content.slice(0, 100),
        });
    };

    const clearReply = () => setReplyToMsg(null);

    const handleToggleReaction = async (messageId: string, emoji: string) => {
        if (!user) return;
        try {
            await toggleReaction(groupId, messageId, emoji, user.uid);
        } catch (err) {
            console.error("Failed to toggle reaction:", err);
        }
    };

    const handleTogglePin = async (msg: ChatMessage) => {
        if (!user) return;
        try {
            await togglePin(groupId, msg.id, user.uid, !!msg.pinned);
        } catch (err) {
            console.error("Failed to toggle pin:", err);
        }
    };

    const handleSaveMaterial = async (msg: ChatMessage) => {
        if (!user) return;
        const url = extractFirstUrl(msg.content);
        if (!url) return;
        
        const finalTitle = materialFormMsgId === msg.id ? materialTitle.trim() : "";
        if (!finalTitle || finalTitle === "Loading title...") {
            toast.error("Title is required");
            return;
        }

        const result = await addMaterial(groupId, {
            addedBy: user.uid,
            addedByName: user.displayName || "Anonymous",
            url: materialFormMsgId === msg.id ? materialUrl || url : url,
            title: finalTitle,
            tags: materialFormMsgId === msg.id ? materialTags.split(",").map(t => t.trim()).filter(Boolean) : [],
        });
        if (result.success) {
            toast.success("Saved to Materials");
            setMaterialFormMsgId(null);
            setMaterialUrl("");
            setMaterialTitle("");
            setMaterialTags("");
        } else {
            toast.error(result.error || "Failed to save material");
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setInput(val);
        setDraft(groupId, val);
        if (!user) return;
        const now = Date.now();
        if (now - lastTypingRef.current > 3000) {
            lastTypingRef.current = now;
            setTyping(groupId, user.uid, true, user.displayName || "Someone");
        }

        if (silenceTimer.current) {
            clearTimeout(silenceTimer.current);
        }
        silenceTimer.current = setTimeout(() => {
            clearTyping(groupId, user.uid);
        }, 5000);
    };

    const displayMessages = [...messages].reverse();

    return (
        <div className="flex flex-col border border-border bg-card rounded-xl overflow-hidden">
            <div ref={containerRef} className="h-[calc(100vh-360px)] min-h-[300px] overflow-y-auto space-y-3 p-4 chat-scroll">
                {pinnedMessages.length > 0 && (
                    <div className="mb-3 bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
                        <button
                            onClick={() => setPinStripOpen(!pinStripOpen)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <span>📌 Pinned Messages ({pinnedMessages.length})</span>
                            {pinStripOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        {pinStripOpen && (
                            <div className="px-3 pb-2 space-y-2 max-h-[200px] overflow-y-auto">
                                {[...pinnedMessages].reverse().map(pm => (
                                    <div key={pm.id} className="flex items-start gap-2 text-xs text-zinc-400">
                                        <Avatar
                                            onClick={() => router.push(`/profile?user=${pm.senderId}`)}
                                            className="w-5 h-5 rounded-full shrink-0 border border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
                                        >
                                            <AvatarImage src={memberPhotoMap[pm.senderId] || pm.senderPhoto} />
                                            <AvatarFallback className="text-[7px] bg-zinc-800">{pm.senderName?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <span
                                                onClick={() => router.push(`/profile?user=${pm.senderId}`)}
                                                className="text-zinc-300 font-medium cursor-pointer hover:text-white hover:underline transition-colors"
                                            >
                                                {pm.senderName}
                                            </span>: {pm.content.slice(0, 80)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {displayMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-zinc-600 text-sm font-medium">No messages yet. Start the conversation!</p>
                    </div>
                ) : (
                    displayMessages.map((msg) => {
                        const isOwn = user?.uid === msg.senderId;
                        const canDelete = isOwn || isHost;
                        const isDeleted = !!msg.deletedAt;
                        const originalMsg = msg.replyTo ? findMessage(msg.replyTo.messageId) : null;
                        const originalUnavailable = msg.replyTo && (!originalMsg || !!originalMsg.deletedAt);

                        return (
                            <div key={msg.id} className="flex items-start gap-3 group relative py-1.5 px-3 -mx-3 rounded-xl hover:bg-white/[0.02] transition-colors">
                                <Avatar
                                    onClick={() => router.push(`/profile?user=${msg.senderId}`)}
                                    className="w-8 h-8 rounded-full shrink-0 border border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
                                >
                                    <AvatarImage src={memberPhotoMap[msg.senderId] || msg.senderPhoto} />
                                    <AvatarFallback className="text-xs bg-zinc-800">{msg.senderName?.[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span
                                            onClick={() => router.push(`/profile?user=${msg.senderId}`)}
                                            className="text-xs font-bold text-white cursor-pointer hover:underline"
                                        >
                                            {msg.senderName}
                                        </span>
                                        <span className="text-[10px] text-zinc-600">
                                            {msg.createdAt?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {msg.edited && <span className="text-[10px] text-zinc-600">(edited)</span>}
                                        {msg.pinned && <Pin className="w-3 h-3 text-zinc-500" />}
                                    </div>

                                    {msg.replyTo && (
                                        <div className="flex items-center gap-1.5 mt-1.5 pl-2 border-l-2 border-zinc-700">
                                            <Reply className="w-3 h-3 text-zinc-600 shrink-0" />
                                            <div className="text-[11px] text-zinc-500 truncate">
                                                {originalUnavailable ? (
                                                    <span className="italic">Original message no longer available</span>
                                                ) : (
                                                    <>
                                                        <span className="text-zinc-400 font-medium">{msg.replyTo.senderName}</span>: {msg.replyTo.preview}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {isDeleted ? (
                                        <p className="text-sm text-zinc-600 italic mt-0.5">This message was deleted</p>
                                    ) : editingId === msg.id ? (
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <input
                                                ref={editInputRef}
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                onKeyDown={(e) => handleEditKeyDown(e, msg.id)}
                                                className="flex-1 bg-zinc-900 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white outline-none"
                                            />
                                            <button onClick={() => saveEdit(msg.id)} className="p-1.5 text-xs font-bold text-white bg-white/10 rounded-lg hover:bg-white/20 transition-colors cursor-pointer">Save</button>
                                            <button onClick={cancelEdit} className="p-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="mt-0.5">
                                            <MarkdownRenderer content={msg.content} />
                                            {/* Active reaction badges immediately below the text */}
                                            {Object.keys(msg.reactions || {}).length > 0 && (
                                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                    {Object.entries(msg.reactions || {}).map(([emoji, userIds]) => (
                                                        <button
                                                            key={emoji}
                                                            onClick={() => handleToggleReaction(msg.id, emoji)}
                                                            className={cn(
                                                                "group/reaction relative flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors cursor-pointer",
                                                                userIds.includes(user?.uid || "")
                                                                    ? "bg-white/10 text-white border-white/20"
                                                                    : "bg-white/5 text-zinc-400 border-transparent hover:border-white/10"
                                                            )}
                                                        >
                                                            <span>{emoji}</span>
                                                            <span className="font-bold">{userIds.length}</span>

                                                            {/* Tooltip on hover */}
                                                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/reaction:block bg-zinc-950/90 border border-white/15 px-2 py-1 rounded-md text-[9px] font-bold text-zinc-200 whitespace-nowrap shadow-xl z-20 backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-150">
                                                                {userIds.map(uid => getUserName(uid)).join(", ")}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {materialFormMsgId === msg.id && !isDeleted && (
                                        <div
                                            ref={(el) => {
                                                if (el && !el.dataset.scrolled) {
                                                    el.dataset.scrolled = "true";
                                                    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                                    const input = el.querySelector("input[placeholder='Title *']") as HTMLInputElement;
                                                    if (input) {
                                                        setTimeout(() => input.focus(), 150);
                                                    }
                                                }
                                            }}
                                            className="mt-2 p-3 bg-zinc-900/80 border border-white/10 rounded-xl space-y-2"
                                        >
                                            <input value={materialUrl} onChange={(e) => setMaterialUrl(e.target.value)} className="w-full bg-zinc-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-white/20" placeholder="URL *" />
                                            <input value={materialTitle} onChange={(e) => setMaterialTitle(e.target.value)} className="w-full bg-zinc-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-white/20" placeholder="Title *" />
                                            <input value={materialTags} onChange={(e) => setMaterialTags(e.target.value)} className="w-full bg-zinc-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-white/20" placeholder="Tags (comma separated, optional)" />
                                            <div className="flex gap-2">
                                                <button onClick={() => handleSaveMaterial(msg)} disabled={!materialTitle.trim() || materialTitle === "Loading title..." || !materialUrl.trim()} className="flex-1 py-2 bg-white text-black font-bold rounded-lg text-[10px] uppercase tracking-wider hover:bg-zinc-100 transition-colors cursor-pointer disabled:opacity-50">Save</button>
                                                <button onClick={() => setMaterialFormMsgId(null)} className="px-4 py-2 bg-white/5 text-zinc-400 font-bold rounded-lg text-[10px] uppercase tracking-wider hover:text-white transition-colors cursor-pointer">Cancel</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Combined Hover Toolbar (Actions + Emoji Reactions) */}
                                {!isDeleted && editingId !== msg.id && (
                                    <div className="absolute right-3 -top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-zinc-900 border border-white/10 rounded-lg p-0.5 shadow-lg z-10">
                                        {/* Quick Reactions */}
                                        <div className="flex items-center gap-0.5 pr-1.5 mr-1.5 border-r border-white/10">
                                            {["👍", "❤️", "😂", "🎯", "🔥"].map(emoji => (
                                                <button
                                                    key={emoji}
                                                    onClick={() => handleToggleReaction(msg.id, emoji)}
                                                    className="p-1 hover:bg-white/10 rounded text-sm leading-none transition-colors cursor-pointer"
                                                    title={emoji}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                        {/* Actions */}
                                        <button onClick={() => startReply(msg)} className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer" title="Reply">
                                            <Reply className="w-3.5 h-3.5" />
                                        </button>
                                        {isOwn && (
                                            <button onClick={() => startEdit(msg)} className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer" title="Edit">
                                                <PencilLine className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button onClick={() => handleDelete(msg.id)} className="p-1 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer" title="Delete">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button onClick={() => handleTogglePin(msg)} className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer" title={msg.pinned ? "Unpin" : "Pin"}>
                                            <Pin className={cn("w-3.5 h-3.5", msg.pinned && "fill-white")} />
                                        </button>
                                        {extractFirstUrl(msg.content) && (
                                            <button onClick={async () => {
                                                const url = extractFirstUrl(msg.content) || "";
                                                const alreadyOpen = materialFormMsgId === msg.id;
                                                setMaterialFormMsgId(alreadyOpen ? null : msg.id);
                                                setMaterialUrl(url);
                                                setMaterialTags("");
                                                if (!alreadyOpen) {
                                                    setMaterialTitle("Loading title...");
                                                    try {
                                                        const res = await fetch(`/api/og-preview?url=${encodeURIComponent(url)}`);
                                                        const data = await res.json();
                                                        if (data.title) {
                                                            setMaterialTitle(data.title);
                                                        } else {
                                                            setMaterialTitle("");
                                                        }
                                                    } catch (err) {
                                                        setMaterialTitle("");
                                                    }
                                                } else {
                                                    setMaterialTitle("");
                                                }
                                            }} className="p-1 text-zinc-400 hover:text-cyan-400 transition-colors cursor-pointer" title="Save to Materials">
                                                <BookmarkPlus className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            <div className="p-4 border-t border-white/5 space-y-2">
                {showTips && (
                    <div className="px-3 py-2 bg-zinc-900/80 rounded-xl border border-white/10 text-[11px] text-zinc-500">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Formatting tips</span>
                            <button
                                onClick={() => {
                                    setShowTips(false);
                                    localStorage.setItem("dangdoro_markdown_tips_dismissed", "1");
                                }}
                                className="p-0.5 text-zinc-600 hover:text-white transition-colors cursor-pointer"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                            <span><span className="text-zinc-300 font-mono">**bold**</span></span>
                            <span><span className="text-zinc-300 font-mono">*italic*</span></span>
                            <span><span className="text-zinc-300 font-mono">`code`</span></span>
                            <span><span className="text-zinc-300 font-mono">[link](url)</span></span>
                            <span><span className="text-zinc-300 font-mono">- list</span></span>
                            <span><span className="text-zinc-300 font-mono">&gt; quote</span></span>
                        </div>
                    </div>
                )}
                {typingUsers.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" style={{ animationDelay: "150ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" style={{ animationDelay: "300ms" }} />
                        </span>
                        {typingUsers.length === 1
                            ? `${typingUsers[0].displayName} is typing...`
                            : `${typingUsers.length} people are typing...`
                        }
                    </div>
                )}
                {replyToMsg && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/80 rounded-xl border border-white/10">
                        <Reply className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <span className="text-[11px] text-zinc-400 font-medium">Replying to {replyToMsg.senderName}</span>
                            <p className="text-[11px] text-zinc-600 truncate">{replyToMsg.preview}</p>
                        </div>
                        <button onClick={clearReply} className="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onBlur={() => {
                            if (user) {
                                clearTyping(groupId, user.uid);
                                if (silenceTimer.current) {
                                    clearTimeout(silenceTimer.current);
                                    silenceTimer.current = null;
                                }
                            }
                        }}
                        placeholder="Type a message..."
                        className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-all resize-none max-h-32 overflow-y-auto chat-scroll"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || sending}
                        className={cn(
                            "p-3 rounded-xl transition-all",
                            input.trim() && !sending
                                ? "bg-white text-black hover:bg-zinc-100 cursor-pointer"
                                : "bg-white/5 text-zinc-600 cursor-not-allowed"
                        )}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
