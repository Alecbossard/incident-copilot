import Link from "next/link";

const API_BASE_INTERNAL =
    process.env.API_BASE_INTERNAL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://localhost:3001";

type Summary = {
    id: string;
    summary: string;
    severityProposed: string;
    statusProposed: string;
    tags: string[];
    confidence: number;
};

async function fetchSummary(id: string): Promise<Summary | null> {
    try {
        const res = await fetch(
            `${API_BASE_INTERNAL}/incidents/${encodeURIComponent(id)}/summary`,
            { cache: "no-store" },
        );
        if (!res.ok) return null;
        return (await res.json()) as Summary;
    } catch {
        return null;
    }
}

export default async function IncidentSummaryPage({
                                                      params,
                                                  }: {
    params: { id: string };
}) {
    const summary = await fetchSummary(params.id);

    return (
        <main style={{ maxWidth: 900, margin: "32px auto", padding: "0 16px" }}>
            <div style={{ marginBottom: 16 }}>
                <Link href="/incidents">← Back to incidents</Link>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
                Incident summary
            </h1>

            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>
                Incident ID: <span>{params.id}</span>
            </div>

            <section
                style={{
                    border: "1px solid #1f2937",
                    borderRadius: 12,
                    padding: 16,
                    background: "#020617",
                    color: "#e5e7eb",
                }}
            >
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                    Summary
                </h2>

                {!summary && (
                    <div
                        style={{
                            marginTop: 8,
                            padding: 12,
                            borderRadius: 8,
                            background: "#fef2f2",
                            color: "#991b1b",
                        }}
                    >
                        fetch failed
                    </div>
                )}

                {summary && (
                    <>
                        <p style={{ marginTop: 0, marginBottom: 12 }}>{summary.summary}</p>
                        <div
                            style={{
                                fontSize: 12,
                                color: "#9ca3af",
                                marginBottom: 8,
                            }}
                        >
                            Raw JSON:
                        </div>
                        <pre
                            style={{
                                margin: 0,
                                padding: 12,
                                borderRadius: 8,
                                background: "#020617",
                                color: "#e5e7eb",
                                fontSize: 12,
                                overflowX: "auto",
                            }}
                        >
              {JSON.stringify(summary, null, 2)}
            </pre>
                    </>
                )}
            </section>
        </main>
    );
}
