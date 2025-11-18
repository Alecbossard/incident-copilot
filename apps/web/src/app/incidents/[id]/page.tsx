import Link from "next/link";
import { IncidentChat } from "./IncidentChat";

const API_BASE =
    process.env.API_BASE_INTERNAL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://api:3001";

const API_KEY = process.env.API_KEY || "";

type SummaryResponse = {
    id: string;
    summary: string;
    severityProposed: string;
    statusProposed: string;
    tags: string[];
    confidence: number;
};

type Incident = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    severity: string;
    createdAt: string;
};

async function fetchSummary(
    id: string
): Promise<{ data: SummaryResponse | null; error: string | null }> {
    try {
        const res = await fetch(`${API_BASE}/incidents/${id}/summary`, {
            cache: "no-store",
            headers: API_KEY ? { "x-api-key": API_KEY } : undefined,
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            return {
                data: null,
                error: text || `Summary fetch failed (${res.status})`,
            };
        }

        const json = (await res.json()) as SummaryResponse;
        return { data: json, error: null };
    } catch (e: any) {
        return { data: null, error: e?.message ?? "fetch failed" };
    }
}

async function fetchIncident(
    id: string
): Promise<{ data: Incident | null; error: string | null }> {
    try {
        const res = await fetch(`${API_BASE}/incidents/${id}`, {
            cache: "no-store",
            headers: API_KEY ? { "x-api-key": API_KEY } : undefined,
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            return {
                data: null,
                error: text || `Incident fetch failed (${res.status})`,
            };
        }

        const json = (await res.json()) as Incident;
        return { data: json, error: null };
    } catch (e: any) {
        return { data: null, error: e?.message ?? "fetch failed" };
    }
}

function severityBadge(sev: string) {
    let bg = "#dcfce7";
    let border = "#22c55e";
    let text = "#166534";

    if (sev === "SEV1") {
        bg = "#fee2e2";
        border = "#ef4444";
        text = "#991b1b";
    } else if (sev === "SEV2") {
        bg = "#fffbeb";
        border = "#f97316";
        text = "#92400e";
    } else if (sev === "SEV4" || sev === "SEV5") {
        bg = "#e0f2fe";
        border = "#3b82f6";
        text = "#1d4ed8";
    }

    return {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        border: `1px solid ${border}`,
        backgroundColor: bg,
        color: text,
        minWidth: 52,
        textAlign: "center",
    } as const;
}

function statusBadge(st: string) {
    let bg = "#e5e7eb";
    let border = "#6b7280";
    let text = "#111827";

    if (st === "OPEN") {
        bg = "#fee2e2";
        border = "#ef4444";
        text = "#b91c1c";
    } else if (st === "ACKNOWLEDGED") {
        bg = "#fef3c7";
        border = "#f59e0b";
        text = "#92400e";
    } else if (st === "MITIGATING") {
        bg = "#dbeafe";
        border = "#3b82f6";
        text = "#1d4ed8";
    } else if (st === "RESOLVED") {
        bg = "#dcfce7";
        border = "#22c55e";
        text = "#166534";
    } else if (st === "CLOSED") {
        bg = "#e5e7eb";
        border = "#6b7280";
        text = "#374151";
    }

    return {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        border: `1px solid ${border}`,
        backgroundColor: bg,
        color: text,
        minWidth: 80,
        textAlign: "center",
    } as const;
}

export default async function IncidentSummaryPage({
                                                      params,
                                                  }: {
    params: { id: string };
}) {
    const { id } = params;

    const [summaryResult, incidentResult] = await Promise.all([
        fetchSummary(id),
        fetchIncident(id),
    ]);

    const summary = summaryResult.data;
    const summaryError = summaryResult.error;
    const incident = incidentResult.data;
    const incidentError = incidentResult.error;

    const createdText = incident
        ? new Date(incident.createdAt).toLocaleString("en-GB", {
            dateStyle: "short",
            timeStyle: "short",
        })
        : null;

    return (
        <main
            style={{
                maxWidth: 960,
                margin: "32px auto",
                padding: "0 16px",
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
                    margin: "8px 0 4px",
                    fontSize: 24,
                    fontWeight: 700,
                }}
            >
                {incident?.title || `Incident ${id}`}
            </h1>

            <div
                style={{
                    fontSize: 13,
                    color: "#6b7280",
                    marginBottom: 12,
                }}
            >
                Incident ID: {id}
            </div>

            {/* Incident details card */}
            {incident ? (
                <section
                    style={{
                        marginBottom: 16,
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        backgroundColor: "#f9fafb",
                        padding: 16,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            alignItems: "center",
                            marginBottom: 8,
                            fontSize: 12,
                        }}
                    >
                        <span style={severityBadge(incident.severity)}>
                            {incident.severity}
                        </span>
                        <span style={statusBadge(incident.status)}>
                            {incident.status}
                        </span>
                        {createdText && (
                            <span style={{ color: "#4b5563" }}>
                                Created: {createdText}
                            </span>
                        )}
                    </div>

                    {incident.description ? (
                        <p
                            style={{
                                margin: 0,
                                fontSize: 14,
                                color: "#111827",
                                lineHeight: 1.5,
                            }}
                        >
                            {incident.description}
                        </p>
                    ) : (
                        <p
                            style={{
                                margin: 0,
                                fontSize: 13,
                                color: "#6b7280",
                            }}
                        >
                            No description provided for this incident.
                        </p>
                    )}
                </section>
            ) : incidentError ? (
                <div
                    style={{
                        marginBottom: 16,
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#991b1b",
                        borderRadius: 8,
                        padding: 12,
                    }}
                >
                    {incidentError}
                </div>
            ) : null}

            <div
                style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                }}
            >
                {/* AI summary card */}
                <section
                    style={{
                        flex: "1 1 0",
                        minWidth: 260,
                    }}
                >
                    {summaryError ? (
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
                            {summaryError}
                        </div>
                    ) : null}

                    {summary ? (
                        <div
                            style={{
                                border: "1px solid #1f2933",
                                borderRadius: 12,
                                padding: 16,
                                background: "#020617",
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
                                AI summary
                            </h2>

                            {/* human-readable summary */}
                            <p
                                style={{
                                    color: "#e5e7eb",
                                    marginBottom: 12,
                                    fontSize: 14,
                                }}
                            >
                                {summary.summary}
                            </p>

                            {/* small info chips */}
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 8,
                                    marginBottom: 12,
                                    fontSize: 12,
                                }}
                            >
                                <span
                                    style={{
                                        borderRadius: 999,
                                        padding: "4px 10px",
                                        border: "1px solid #4b5563",
                                        color: "#e5e7eb",
                                    }}
                                >
                                    severity (suggested):{" "}
                                    <b>{summary.severityProposed}</b>
                                </span>
                                <span
                                    style={{
                                        borderRadius: 999,
                                        padding: "4px 10px",
                                        border: "1px solid #4b5563",
                                        color: "#e5e7eb",
                                    }}
                                >
                                    status (suggested):{" "}
                                    <b>{summary.statusProposed}</b>
                                </span>
                                <span
                                    style={{
                                        borderRadius: 999,
                                        padding: "4px 10px",
                                        border: "1px solid #4b5563",
                                        color: "#e5e7eb",
                                    }}
                                >
                                    confidence: <b>{summary.confidence}</b>
                                </span>
                                {Array.isArray(summary.tags) &&
                                    summary.tags.length > 0 && (
                                        <span
                                            style={{
                                                borderRadius: 999,
                                                padding: "4px 10px",
                                                border: "1px solid #4b5563",
                                                color: "#e5e7eb",
                                            }}
                                        >
                                            tags: {summary.tags.join(", ")}
                                        </span>
                                    )}
                            </div>

                            {/* raw JSON underneath */}
                            <div
                                style={{
                                    marginTop: 8,
                                    padding: 12,
                                    borderRadius: 8,
                                    background: "#020617",
                                    border: "1px solid #111827",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "#9ca3af",
                                        marginBottom: 4,
                                    }}
                                >
                                    Raw JSON:
                                </div>
                                <pre
                                    style={{
                                        margin: 0,
                                        fontSize: 12,
                                        color: "#e5e7eb",
                                        overflowX: "auto",
                                    }}
                                >
                                    {JSON.stringify(summary, null, 2)}
                                </pre>
                            </div>
                        </div>
                    ) : !summaryError ? (
                        <div style={{ color: "#6b7280", fontSize: 13 }}>
                            No AI summary available yet. Try asking something in the
                            chat on the right.
                        </div>
                    ) : null}
                </section>

                {/* AI chat card */}
                <div
                    style={{
                        flex: "1 1 0",
                        minWidth: 260,
                    }}
                >
                    <IncidentChat incidentId={id} />
                </div>
            </div>
        </main>
    );
}
