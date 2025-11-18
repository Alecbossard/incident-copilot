"use client";

import { useState } from "react";
import Link from "next/link";

type SuggestResponse = {
    summary: string;
    suggestedTitle: string;
    impactSummary: string;
    actionItems: string[];
    severityProposed: "SEV1" | "SEV2" | "SEV3" | "SEV4" | "SEV5";
    statusProposed: "OPEN" | "ACKNOWLEDGED" | "MITIGATING" | "RESOLVED" | "CLOSED";
    tags: string[];
    confidence: number;
};

type SimilarItem = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    severity: string;
    createdAt: string;
    score: number;
};
type SimilarResponse = { items: SimilarItem[] };

export default function NewIncidentPage() {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");

    const [severity, setSeverity] = useState<"SEV1" | "SEV2" | "SEV3" | "SEV4" | "SEV5">("SEV3");
    const [status, setStatus] = useState<
        "OPEN" | "ACKNOWLEDGED" | "MITIGATING" | "RESOLVED" | "CLOSED"
    >("OPEN");

    const [suggestRes, setSuggestRes] = useState<SuggestResponse | null>(null);
    const [similarRes, setSimilarRes] = useState<SimilarResponse | null>(null);

    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [okMsg, setOkMsg] = useState<string | null>(null);

    const canAskAI =
        title.trim().length > 0 || description.trim().length > 0;

    async function onSuggest() {
        setError(null);
        setOkMsg(null);
        setSuggestRes(null);
        try {
            const res = await fetch("/api/incidents/suggest", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ title, description }),
            });
            if (!res.ok) throw new Error(`Suggest failed (${res.status})`);
            const data: SuggestResponse = await res.json();
            setSuggestRes(data);

            // trust the AI suggestion for severity
            setSeverity(data.severityProposed);
        } catch (e: any) {
            setError(e?.message ?? "Suggest failed");
        }
    }

    async function onFindSimilar() {
        setError(null);
        setOkMsg(null);
        setSimilarRes(null);
        try {
            const q = `${title} ${description}`.trim();
            const url = `/api/incidents/similar?q=${encodeURIComponent(q)}&k=5`;
            const res = await fetch(url, { method: "GET" });
            if (!res.ok) throw new Error(`Similar failed (${res.status})`);
            const data: SimilarResponse = await res.json();
            setSimilarRes(data);
        } catch (e: any) {
            setError(e?.message ?? "Similar failed");
        }
    }

    async function onCreate() {
        setError(null);
        setOkMsg(null);
        setCreating(true);
        try {
            const res = await fetch("/api/incidents", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ title, description, severity, status }),
            });
            const text = await res.text();
            if (!res.ok) throw new Error(text || `Create failed (${res.status})`);

            setOkMsg("Incident created successfully.");
            setSuggestRes(null);
            setSimilarRes(null);
            setTitle("");
            setDescription("");
            setSeverity("SEV3");
            setStatus("OPEN");
        } catch (e: any) {
            setError(e?.message ?? "Create failed");
        } finally {
            setCreating(false);
        }
    }

    return (
        <main style={{ maxWidth: 900, margin: "32px auto", padding: "0 16px" }}>
            <div style={{ marginBottom: 16 }}>
                <Link href="/incidents">← Back to incidents</Link>
            </div>

            <h1 style={{ margin: "8px 0 4px", fontSize: 24, fontWeight: 700 }}>
                New Incident
            </h1>
            <p
                style={{
                    margin: "0 0 16px",
                    fontSize: 13,
                    color: "#6b7280",
                }}
            >
                Create a new incident. You can ask the AI to suggest a title, impact
                summary and action items based on your description.
            </p>

            {error ? (
                <div
                    style={{
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#991b1b",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 12,
                    }}
                >
                    {error}
                </div>
            ) : null}
            {okMsg ? (
                <div
                    style={{
                        background: "#ecfdf5",
                        border: "1px solid #a7f3d0",
                        color: "#065f46",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 12,
                    }}
                >
                    {okMsg}
                </div>
            ) : null}

            <div style={{ display: "grid", gap: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                    <span>Title</span>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="API 5xx surge in EU-West"
                        style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            padding: "8px 10px",
                        }}
                    />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                    <span>Description</span>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={5}
                        placeholder="e.g., after deploy at 16:20 UTC, surge of 5xx…"
                        style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            padding: "8px 10px",
                        }}
                    />
                </label>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <label>
                        <span
                            style={{
                                display: "block",
                                fontSize: 12,
                                color: "#6b7280",
                            }}
                        >
                            Severity
                        </span>
                        <select
                            value={severity}
                            onChange={(e) => setSeverity(e.target.value as any)}
                            style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: 8,
                                padding: "8px 10px",
                            }}
                        >
                            <option value="SEV1">SEV1</option>
                            <option value="SEV2">SEV2</option>
                            <option value="SEV3">SEV3</option>
                            <option value="SEV4">SEV4</option>
                            <option value="SEV5">SEV5</option>
                        </select>
                    </label>

                    <label>
                        <span
                            style={{
                                display: "block",
                                fontSize: 12,
                                color: "#6b7280",
                            }}
                        >
                            Status
                        </span>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as any)}
                            style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: 8,
                                padding: "8px 10px",
                            }}
                        >
                            <option value="OPEN">OPEN</option>
                            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                            <option value="MITIGATING">MITIGATING</option>
                            <option value="RESOLVED">RESOLVED</option>
                            <option value="CLOSED">CLOSED</option>
                        </select>
                    </label>
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 8,
                        alignItems: "center",
                    }}
                >
                    <button
                        onClick={onSuggest}
                        type="button"
                        disabled={!canAskAI}
                        style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            padding: "8px 12px",
                            opacity: canAskAI ? 1 : 0.5,
                            cursor: canAskAI ? "pointer" : "not-allowed",
                        }}
                    >
                        Suggest
                    </button>
                    <button
                        onClick={onFindSimilar}
                        type="button"
                        disabled={!canAskAI}
                        style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            padding: "8px 12px",
                            opacity: canAskAI ? 1 : 0.5,
                            cursor: canAskAI ? "pointer" : "not-allowed",
                        }}
                    >
                        Find similar
                    </button>
                    <button
                        onClick={onCreate}
                        disabled={creating}
                        type="button"
                        style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            padding: "8px 12px",
                        }}
                    >
                        {creating ? "Creating…" : "Create"}
                    </button>
                </div>
                {!canAskAI && (
                    <p
                        style={{
                            margin: "4px 0 0",
                            fontSize: 11,
                            color: "#9ca3af",
                        }}
                    >
                        Add a title or description to enable AI helpers.
                    </p>
                )}
            </div>

            {suggestRes ? (
                <section
                    style={{
                        marginTop: 20,
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 16,
                    }}
                >
                    <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
                        Suggestion
                    </h2>

                    {suggestRes.suggestedTitle ? (
                        <div
                            style={{
                                marginBottom: 10,
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                                flexWrap: "wrap",
                            }}
                        >
                            <span style={{ fontSize: 14, fontWeight: 600 }}>
                                Suggested title:
                            </span>
                            <span style={{ fontSize: 14 }}>
                                {suggestRes.suggestedTitle}
                            </span>
                            <button
                                type="button"
                                onClick={() => setTitle(suggestRes.suggestedTitle)}
                                style={{
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 999,
                                    padding: "4px 10px",
                                    fontSize: 12,
                                }}
                            >
                                Use suggested title
                            </button>
                        </div>
                    ) : null}

                    {suggestRes.impactSummary ? (
                        <div style={{ marginBottom: 10 }}>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    marginBottom: 4,
                                }}
                            >
                                Impact
                            </div>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                }}
                            >
                                {suggestRes.impactSummary}
                            </p>
                        </div>
                    ) : null}

                    {suggestRes.actionItems?.length ? (
                        <div style={{ marginBottom: 10 }}>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    marginBottom: 4,
                                }}
                            >
                                Action items
                            </div>
                            <ul
                                style={{
                                    margin: 0,
                                    paddingLeft: 18,
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                }}
                            >
                                {suggestRes.actionItems.map((it, idx) => (
                                    <li key={idx}>{it}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    <div style={{ marginTop: 12 }}>
                        <div
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                marginBottom: 4,
                            }}
                        >
                            Summary (raw)
                        </div>
                        <pre
                            style={{
                                whiteSpace: "pre-wrap",
                                lineHeight: 1.5,
                                margin: 0,
                            }}
                        >
                            {suggestRes.summary}
                        </pre>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            gap: 12,
                            marginTop: 12,
                            flexWrap: "wrap",
                        }}
                    >
                        <span
                            style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: 999,
                                padding: "4px 10px",
                                fontSize: 12,
                            }}
                        >
                            severity: <b>{suggestRes.severityProposed}</b>
                        </span>
                        <span
                            style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: 999,
                                padding: "4px 10px",
                                fontSize: 12,
                            }}
                        >
                            status: <b>{suggestRes.statusProposed}</b>
                        </span>
                        <span
                            style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: 999,
                                padding: "4px 10px",
                                fontSize: 12,
                            }}
                        >
                            confidence: <b>{suggestRes.confidence}</b>
                        </span>
                    </div>

                    {suggestRes.tags?.length ? (
                        <div
                            style={{
                                marginTop: 12,
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                            }}
                        >
                            {suggestRes.tags.map((t) => (
                                <span
                                    key={t}
                                    style={{
                                        background: "#f3f4f6",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: 999,
                                        padding: "4px 10px",
                                        fontSize: 12,
                                    }}
                                >
                                    {t}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </section>
            ) : null}

            {similarRes ? (
                <section
                    style={{
                        marginTop: 20,
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 16,
                    }}
                >
                    <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
                        Similar incidents
                    </h2>
                    {similarRes.items.length === 0 ? (
                        <div style={{ color: "#6b7280" }}>No similar incidents.</div>
                    ) : (
                        <ul
                            style={{
                                margin: 0,
                                padding: 0,
                                listStyle: "none",
                            }}
                        >
                            {similarRes.items.map((it) => (
                                <li
                                    key={it.id}
                                    style={{
                                        padding: "10px 0",
                                        borderBottom: "1px solid #f3f4f6",
                                    }}
                                >
                                    <div style={{ fontWeight: 600 }}>
                                        <Link href={`/incidents/${it.id}`}>{it.title}</Link>
                                    </div>
                                    {it.description ? (
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: "#6b7280",
                                            }}
                                        >
                                            {it.description.slice(0, 160)}
                                            {it.description.length > 160 ? "…" : ""}
                                        </div>
                                    ) : null}
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: 8,
                                            marginTop: 6,
                                            fontSize: 12,
                                            color: "#6b7280",
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <span>severity: {it.severity}</span>
                                        <span>status: {it.status}</span>
                                        <span>score: {it.score.toFixed(3)}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            ) : null}
        </main>
    );
}
