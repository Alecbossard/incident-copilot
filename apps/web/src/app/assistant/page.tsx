"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

export default function GlobalAssistantPage() {
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function onAsk(e: FormEvent) {
        e.preventDefault();
        if (!question.trim()) return;

        setLoading(true);
        setError(null);
        setAnswer(null);

        try {
            const res = await fetch("/api/assistant/query", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ question }),
            });

            const data = await res.json().catch(() => null as any);

            if (!res.ok) {
                throw new Error(
                    data?.reply || data?.error || `Assistant error (${res.status})`,
                );
            }

            setAnswer(data?.reply || "Assistant returned an empty reply.");
        } catch (err: any) {
            setError(err?.message ?? "Request failed.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main
            style={{
                maxWidth: 960,
                margin: "32px auto",
                padding: "0 16px 32px",
                fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            }}
        >
            {/* Global nav */}
            <nav
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                }}
            >
                <Link
                    href="/incidents"
                    style={{
                        fontSize: 16,
                        fontWeight: 700,
                        letterSpacing: "-0.03em",
                        textDecoration: "none",
                        color: "#111827",
                    }}
                >
                    Incident Co-Pilot
                </Link>
                <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
                    <Link
                        href="/incidents"
                        style={{
                            textDecoration: "none",
                            color: "#111827",
                        }}
                    >
                        Incidents
                    </Link>
                    <Link
                        href="/assistant"
                        style={{
                            textDecoration: "none",
                            color: "#2563eb",
                            fontWeight: 500,
                        }}
                    >
                        Global assistant
                    </Link>
                </div>
            </nav>

            <div style={{ marginBottom: 16 }}>
                <Link href="/incidents">← Back to incidents</Link>
            </div>

            <h1
                style={{
                    margin: "0 0 4px",
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                }}
            >
                Global assistant
            </h1>

            <p style={{ margin: "4px 0", fontSize: 13, color: "#6b7280" }}>
                Ask questions about your incident history, or anything else.
                Examples:
                <br />
                <span style={{ display: "block" }}>
                    • Which SEV1 incidents happened this week?
                </span>
                <span style={{ display: "block" }}>
                    • Summarize the incidents related to Redis.
                </span>
                <span style={{ display: "block" }}>
                    • Suggest improvements to our incident process.
                </span>
            </p>

            <form onSubmit={onAsk} style={{ marginTop: 16 }}>
                <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows={4}
                    placeholder="Ask anything…"
                    style={{
                        width: "100%",
                        borderRadius: 12,
                        border: "1px solid #1f2933",
                        padding: "10px 12px",
                        fontSize: 14,
                        backgroundColor: "#020617",
                        color: "#e5e7eb",
                        resize: "vertical",
                    }}
                />
                <div
                    style={{
                        marginTop: 8,
                        display: "flex",
                        justifyContent: "flex-end",
                    }}
                >
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            borderRadius: 999,
                            padding: "8px 18px",
                            fontSize: 13,
                            border: "1px solid #1d4ed8",
                            backgroundColor: "#1d4ed8",
                            color: "white",
                            fontWeight: 500,
                            cursor: loading ? "default" : "pointer",
                            opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? "Asking…" : "Ask"}
                    </button>
                </div>
            </form>

            <section
                style={{
                    marginTop: 20,
                    borderRadius: 12,
                    border: "1px solid #020617",
                    backgroundColor: "#020617",
                    padding: 16,
                }}
            >
                <h2
                    style={{
                        margin: "0 0 8px",
                        fontSize: 16,
                        fontWeight: 600,
                        color: "#e5e7eb",
                    }}
                >
                    Answer
                </h2>

                {error ? (
                    <div
                        style={{
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            color: "#991b1b",
                            borderRadius: 8,
                            padding: 10,
                            fontSize: 13,
                        }}
                    >
                        {error}
                    </div>
                ) : answer ? (
                    <p
                        style={{
                            whiteSpace: "pre-wrap",
                            margin: 0,
                            fontSize: 14,
                            lineHeight: 1.5,
                            color: "#e5e7eb",
                        }}
                    >
                        {answer}
                    </p>
                ) : (
                    <p
                        style={{
                            margin: 0,
                            fontSize: 13,
                            color: "#6b7280",
                        }}
                    >
                        No answer yet. Ask a question above to get insights from the
                        assistant.
                    </p>
                )}
            </section>
        </main>
    );
}
