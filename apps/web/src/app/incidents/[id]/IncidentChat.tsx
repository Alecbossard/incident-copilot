"use client";

import { useState, KeyboardEvent } from "react";

type Message = {
    role: "user" | "assistant";
    content: string;
};

type IncidentChatProps = {
    incidentId: string;
};

export function IncidentChat({ incidentId }: IncidentChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSend() {
        if (!input.trim() || loading) return;

        const newMessages: Message[] = [
            ...messages,
            { role: "user", content: input.trim() },
        ];

        setMessages(newMessages);
        setInput("");
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/incidents/${incidentId}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: newMessages }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error((data as any)?.error || `Request failed (${res.status})`);
            }

            const reply: string =
                (data as any)?.reply ?? "(AI service did not return a reply field).";

            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: reply },
            ]);
        } catch (e: any) {
            setError(e?.message || "Error while calling the AI service.");
        } finally {
            setLoading(false);
        }
    }

    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    return (
        <section
            style={{
                border: "1px solid #1f2933",
                borderRadius: 12,
                padding: 16,
                background: "#020617",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                maxHeight: 480,
            }}
        >
            <h2
                style={{
                    margin: "0 0 8px",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#e5e7eb",
                }}
            >
                AI assistant for this incident
            </h2>

            <div
                style={{
                    flex: 1,
                    borderRadius: 8,
                    border: "1px solid #111827",
                    padding: 8,
                    marginBottom: 8,
                    background: "#020617",
                    overflowY: "auto",
                }}
            >
                {messages.length === 0 && (
                    <p
                        style={{
                            fontSize: 12,
                            color: "#6b7280",
                            margin: 0,
                        }}
                    >
                        Ask a question about this incident (context, impact, actions…).
                    </p>
                )}

                {messages.map((m, i) => (
                    <div
                        key={i}
                        style={{
                            display: "flex",
                            justifyContent:
                                m.role === "user" ? "flex-end" : "flex-start",
                            marginBottom: 4,
                        }}
                    >
                        <div
                            style={{
                                borderRadius: 12,
                                padding: "6px 10px",
                                maxWidth: "80%",
                                fontSize: 12,
                                background:
                                    m.role === "user" ? "#1d4ed8" : "#374151",
                                color: "#f9fafb",
                                whiteSpace: "pre-wrap",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    opacity: 0.75,
                                    marginBottom: 2,
                                }}
                            >
                                {m.role === "user" ? "You" : "AI"}
                            </div>
                            <div>{m.content}</div>
                        </div>
                    </div>
                ))}
            </div>

            {error && (
                <div
                    style={{
                        fontSize: 12,
                        color: "#fca5a5",
                        marginBottom: 4,
                    }}
                >
                    {error}
                </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
                <input
                    style={{
                        flex: 1,
                        borderRadius: 8,
                        border: "1px solid #374151",
                        padding: "6px 10px",
                        fontSize: 13,
                        background: "#020617",
                        color: "#e5e7eb",
                    }}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask something about this incident…"
                />
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={loading}
                    style={{
                        borderRadius: 8,
                        border: "none",
                        padding: "6px 12px",
                        fontSize: 13,
                        fontWeight: 500,
                        background: "#2563eb",
                        color: "#f9fafb",
                        opacity: loading ? 0.6 : 1,
                        cursor: loading ? "default" : "pointer",
                    }}
                >
                    {loading ? "Sending…" : "Send"}
                </button>
            </div>
        </section>
    );
}
