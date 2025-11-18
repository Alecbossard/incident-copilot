"use client";

import { useState } from "react";

type JsonLike = any;

function fmt(x: JsonLike): string {
    try {
        return JSON.stringify(x, null, 2);
    } catch {
        return String(x);
    }
}

export default function ToolsPage() {
    const [healthResult, setHealthResult] = useState("");
    const [rebuildAllResult, setRebuildAllResult] = useState("");
    const [singleId, setSingleId] = useState("");
    const [singleIdResult, setSingleIdResult] = useState("");

    async function callHealth() {
        setHealthResult("Loading...");
        setRebuildAllResult("");
        setSingleIdResult("");

        try {
            const res = await fetch("/api/tools/health", { cache: "no-store" });
            const json = await res.json().catch(() => null);
            setHealthResult(fmt(json ?? { status: res.status }));
        } catch (e: any) {
            setHealthResult(e?.message ?? "health failed");
        }
    }

    async function callRebuildAll() {
        setRebuildAllResult("Running...");
        setSingleIdResult("");

        try {
            const res = await fetch("/api/tools/embeddings/rebuild", {
                method: "POST",
            });
            const json = await res.json().catch(() => null);
            setRebuildAllResult(fmt(json ?? { status: res.status }));
        } catch (e: any) {
            setRebuildAllResult(e?.message ?? "rebuild failed");
        }
    }

    async function callRebuildForId() {
        setSingleIdResult("Running...");

        try {
            const res = await fetch("/api/tools/embeddings", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ id: singleId.trim() }),
            });
            const json = await res.json().catch(() => null);
            setSingleIdResult(fmt(json ?? { status: res.status }));
        } catch (e: any) {
            setSingleIdResult(e?.message ?? "rebuild for id failed");
        }
    }

    return (
        <main style={{ maxWidth: 900, margin: "32px auto", padding: "0 16px" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Tools</h1>

            {/* HEALTH */}
            <section
                style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                }}
            >
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                    API health
                </h2>
                <p
                    style={{
                        marginTop: 0,
                        marginBottom: 8,
                        fontSize: 13,
                        color: "#6b7280",
                    }}
                >
                    Calls <code>/api/tools/health</code> → Nest <code>/health</code>.
                </p>
                <button
                    type="button"
                    onClick={callHealth}
                    style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontSize: 14,
                    }}
                >
                    Check health
                </button>

                {healthResult && (
                    <pre
                        style={{
                            marginTop: 12,
                            padding: 12,
                            borderRadius: 8,
                            background: "#020617",
                            color: "#e5e7eb",
                            fontSize: 12,
                            overflowX: "auto",
                        }}
                    >
            {healthResult}
          </pre>
                )}
            </section>

            {/* REBUILD ALL */}
            <section
                style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                }}
            >
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                    Rebuild all embeddings
                </h2>
                <p
                    style={{
                        marginTop: 0,
                        marginBottom: 8,
                        fontSize: 13,
                        color: "#6b7280",
                    }}
                >
                    Calls <code>/api/tools/embeddings/rebuild</code> → Nest{" "}
                    <code>POST /incidents/embeddings/rebuild</code>.
                </p>
                <button
                    type="button"
                    onClick={callRebuildAll}
                    style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontSize: 14,
                    }}
                >
                    Rebuild all
                </button>

                {rebuildAllResult && (
                    <pre
                        style={{
                            marginTop: 12,
                            padding: 12,
                            borderRadius: 8,
                            background: "#020617",
                            color: "#e5e7eb",
                            fontSize: 12,
                            overflowX: "auto",
                        }}
                    >
            {rebuildAllResult}
          </pre>
                )}
            </section>

            {/* REBUILD ONE ID */}
            <section
                style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 16,
                }}
            >
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                    Rebuild embedding for a single incident
                </h2>
                <p
                    style={{
                        marginTop: 0,
                        marginBottom: 8,
                        fontSize: 13,
                        color: "#6b7280",
                    }}
                >
                    Calls <code>/api/tools/embeddings</code> → Nest{" "}
                    <code>POST /incidents/:id/embedding</code>.
                </p>

                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input
                        value={singleId}
                        onChange={(e) => setSingleId(e.target.value)}
                        placeholder="incident id"
                        style={{
                            flex: 1,
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontSize: 14,
                        }}
                    />
                    <button
                        type="button"
                        onClick={callRebuildForId}
                        style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            padding: "6px 10px",
                            fontSize: 14,
                        }}
                    >
                        Rebuild for id
                    </button>
                </div>

                {singleIdResult && (
                    <pre
                        style={{
                            marginTop: 8,
                            padding: 12,
                            borderRadius: 8,
                            background: "#020617",
                            color: "#e5e7eb",
                            fontSize: 12,
                            overflowX: "auto",
                        }}
                    >
            {singleIdResult}
          </pre>
                )}
            </section>
        </main>
    );
}
