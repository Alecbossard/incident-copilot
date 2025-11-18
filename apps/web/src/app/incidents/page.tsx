import Link from "next/link";
import UpdateStatusButton from "./_components/UpdateStatusButton";

const API_BASE =
    process.env.API_BASE_INTERNAL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://api:3001";

const API_KEY = process.env.API_KEY || "";
const ENABLE_STATUS_UPDATE =
    (process.env.ENABLE_STATUS_UPDATE || "false").toLowerCase() === "true";

const STATUSES = ["OPEN", "ACKNOWLEDGED", "MITIGATING", "RESOLVED", "CLOSED"] as const;
const SEVERITIES = ["SEV1", "SEV2", "SEV3", "SEV4", "SEV5"] as const;
const SORT_KEYS = ["createdAt", "title", "status", "severity"] as const;

type Status = (typeof STATUSES)[number];
type Severity = (typeof SEVERITIES)[number];

type Incident = {
    id: string;
    title: string;
    description: string | null;
    status: Status;
    severity: Severity;
    createdAt: string;
};

type ListResponse = {
    items: Incident[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
};

// ---------- Helpers for searchParams ----------
function isURLSearchParams(v: any): v is URLSearchParams {
    return v && typeof v.get === "function" && typeof v.getAll === "function";
}
function getParam(sp: any, key: string): string | undefined {
    if (!sp) return undefined;
    if (isURLSearchParams(sp)) return sp.get(key) ?? undefined;
    const v = sp[key] as string | string[] | undefined;
    return Array.isArray(v) ? v[0] : v;
}
function getAll(sp: any, key: string): string[] {
    if (!sp) return [];
    if (isURLSearchParams(sp)) return sp.getAll(key) ?? [];
    const v = sp[key] as string | string[] | undefined;
    if (Array.isArray(v)) return v;
    if (typeof v === "string") return [v];
    return [];
}
function toCsv(vals: string[]): string | undefined {
    const arr = vals.map((s) => s.trim()).filter(Boolean);
    return arr.length ? arr.join(",") : undefined;
}

// ---------- UI helpers ----------
function severityBadge(sev: Severity) {
    let bg = "#dcfce7"; // green-ish
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

function statusBadge(st: Status) {
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

const pillButton: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 13,
    backgroundColor: "white",
    color: "#374151",
    textDecoration: "none",
    cursor: "pointer",
};

// ---------- Page ----------
export default async function IncidentsPage({
                                                searchParams,
                                            }: {
    searchParams:
        | Promise<Record<string, string | string[] | undefined>>
        | Record<string, string | string[] | undefined>
        | Promise<URLSearchParams>
        | URLSearchParams;
}) {
    const sp = (searchParams as any)?.then
        ? await (searchParams as Promise<any>)
        : (searchParams as any);

    const q = (getParam(sp, "q") ?? "").toString();
    const statusVals = getAll(sp, "status");
    const severityVals = getAll(sp, "severity");

    const sortRaw = getParam(sp, "sort") as any;
    const sort: "createdAt" | "title" | "status" | "severity" =
        SORT_KEYS.includes(sortRaw) ? sortRaw : "createdAt";
    const dir: "asc" | "desc" =
        getParam(sp, "dir") === "asc" ? "asc" : "desc";

    const page = Math.max(1, Number(getParam(sp, "page") ?? 1) || 1);
    // fixed pageSize to 10 (no select in the UI anymore)
    const pageSize = 10;

    const statusCsv = toCsv(statusVals);
    const severityCsv = toCsv(severityVals);

    const url = new URL(`${API_BASE}/incidents`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("sort", sort);
    url.searchParams.set("dir", dir);
    if (q.trim()) url.searchParams.set("q", q.trim());
    if (statusCsv) url.searchParams.set("status", statusCsv);
    if (severityCsv) url.searchParams.set("severity", severityCsv);

    const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: API_KEY ? { "x-api-key": API_KEY } : undefined,
    });
    if (!res.ok) throw new Error(`Failed to load incidents (${res.status})`);
    const data = (await res.json()) as ListResponse;

    const start = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
    const end = Math.min(data.page * data.pageSize, data.total);

    function buildHref(overrides: Record<string, string | undefined>) {
        const p = new URLSearchParams();
        if (q) p.set("q", q);
        statusVals.forEach((s) => p.append("status", s));
        severityVals.forEach((sv) => p.append("severity", sv));
        p.set("sort", overrides.sort ?? sort);
        p.set("dir", overrides.dir ?? dir);
        p.set("page", overrides.page ?? String(page));
        p.set("pageSize", String(pageSize));
        const qs = p.toString();
        return `/incidents${qs ? `?${qs}` : ""}`;
    }

    function toggleSort(key: "createdAt" | "title" | "status" | "severity") {
        if (sort === key)
            return buildHref({ sort: key, dir: dir === "asc" ? "desc" : "asc" });
        return buildHref({ sort: key, dir: "asc" });
    }

    const statusSelected = new Set(statusVals);
    const severitySelected = new Set(severityVals);

    const filtersActive =
        (q && q.trim().length > 0) ||
        statusVals.length > 0 ||
        severityVals.length > 0;

    return (
        <main
            style={{
                maxWidth: 1100,
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

            {/* Header */}
            <header
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 16,
                }}
            >
                <div>
                    <h1
                        style={{
                            margin: 0,
                            fontSize: 26,
                            fontWeight: 700,
                            letterSpacing: "-0.03em",
                        }}
                    >
                        Incidents
                    </h1>
                    <p
                        style={{
                            margin: "4px 0 0",
                            fontSize: 13,
                            color: "#6b7280",
                        }}
                    >
                        Track incidents with filters, search and pagination.
                    </p>
                </div>

                <Link
                    href="/incidents/new"
                    style={{
                        borderRadius: 999,
                        padding: "8px 14px",
                        fontSize: 13,
                        border: "1px solid #2563eb",
                        backgroundColor: "#2563eb",
                        color: "white",
                        textDecoration: "none",
                        fontWeight: 500,
                    }}
                >
                    + New incident
                </Link>
            </header>

            {/* Filters / search */}
            <form
                action="/incidents"
                method="get"
                style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 12,
                    backgroundColor: "#f9fafb",
                }}
            >
                <div style={{ display: "grid", gap: 12 }}>
                    {/* Search line + buttons */}
                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            alignItems: "center",
                        }}
                    >
                        <input
                            name="q"
                            defaultValue={q}
                            placeholder="Search title/description…"
                            style={{
                                flex: "1 1 320px",
                                border: "1px solid #e5e7eb",
                                borderRadius: 999,
                                padding: "8px 12px",
                                fontSize: 13,
                                backgroundColor: "white",
                                color: "#000000",
                            }}
                        />
                        <input type="hidden" name="sort" value={sort} />
                        <input type="hidden" name="dir" value={dir} />
                        <button type="submit" style={pillButton}>
                            Apply
                        </button>
                        <Link href="/incidents" style={pillButton}>
                            Reset
                        </Link>
                        {filtersActive && (
                            <span
                                style={{
                                    fontSize: 11,
                                    color: "#4b5563",
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    backgroundColor: "#e5e7eb",
                                }}
                            >
                                Filters active
                            </span>
                        )}
                    </div>

                    {/* Status / severity filters */}
                    <div
                        style={{
                            display: "flex",
                            gap: 24,
                            flexWrap: "wrap",
                            fontSize: 13,
                        }}
                    >
                        <fieldset style={{ border: "none", padding: 0 }}>
                            <legend
                                style={{
                                    fontSize: 11,
                                    color: "#6b7280",
                                    marginBottom: 4,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                }}
                            >
                                Status
                            </legend>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {STATUSES.map((s) => (
                                    <label
                                        key={s}
                                        style={{
                                            display: "flex",
                                            gap: 6,
                                            alignItems: "center",
                                            color: "#111827",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            name="status"
                                            value={s}
                                            defaultChecked={statusSelected.has(s)}
                                        />
                                        <span>{s}</span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <fieldset style={{ border: "none", padding: 0 }}>
                            <legend
                                style={{
                                    fontSize: 11,
                                    color: "#6b7280",
                                    marginBottom: 4,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                }}
                            >
                                Severity
                            </legend>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {SEVERITIES.map((sv) => (
                                    <label
                                        key={sv}
                                        style={{
                                            display: "flex",
                                            gap: 6,
                                            alignItems: "center",
                                            color: "#111827",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            name="severity"
                                            value={sv}
                                            defaultChecked={severitySelected.has(sv)}
                                        />
                                        <span>{sv}</span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                    </div>
                </div>
            </form>

            {/* Pagination summary */}
            <div
                style={{
                    fontSize: 13,
                    color: "#6b7280",
                    marginBottom: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <span>
                    {start}–{end} of {data.total} incidents
                </span>
                <span style={{ fontSize: 12 }}>
                    Page {data.page} / {Math.max(1, data.totalPages)}
                </span>
            </div>

            {/* Table */}
            <div
                style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: "white",
                }}
            >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ background: "#f9fafb" }}>
                    <tr>
                        <th
                            style={{
                                textAlign: "left",
                                padding: 12,
                                borderBottom: "1px solid #e5e7eb",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#6b7280",
                            }}
                        >
                            <Link
                                href={toggleSort("title")}
                                style={{ textDecoration: "none", color: "inherit" }}
                            >
                                Title {sort === "title" ? (dir === "asc" ? "▲" : "▼") : ""}
                            </Link>
                        </th>
                        <th
                            style={{
                                textAlign: "left",
                                padding: 12,
                                borderBottom: "1px solid #e5e7eb",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#6b7280",
                            }}
                        >
                            <Link
                                href={toggleSort("severity")}
                                style={{ textDecoration: "none", color: "inherit" }}
                            >
                                Severity{" "}
                                {sort === "severity" ? (dir === "asc" ? "▲" : "▼") : ""}
                            </Link>
                        </th>
                        <th
                            style={{
                                textAlign: "left",
                                padding: 12,
                                borderBottom: "1px solid #e5e7eb",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#6b7280",
                            }}
                        >
                            <Link
                                href={toggleSort("status")}
                                style={{ textDecoration: "none", color: "inherit" }}
                            >
                                Status {sort === "status" ? (dir === "asc" ? "▲" : "▼") : ""}
                            </Link>
                        </th>
                        <th
                            style={{
                                textAlign: "left",
                                padding: 12,
                                borderBottom: "1px solid #e5e7eb",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#6b7280",
                            }}
                        >
                            <Link
                                href={toggleSort("createdAt")}
                                style={{ textDecoration: "none", color: "inherit" }}
                            >
                                Created{" "}
                                {sort === "createdAt" ? (dir === "asc" ? "▲" : "▼") : ""}
                            </Link>
                        </th>
                        <th
                            style={{
                                width: 180,
                                textAlign: "left",
                                padding: 12,
                                borderBottom: "1px solid #e5e7eb",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#6b7280",
                            }}
                        >
                            Actions
                        </th>
                    </tr>
                    </thead>
                    <tbody>
                    {data.items.map((it) => (
                        <tr key={it.id} style={{ verticalAlign: "top" }}>
                            <td
                                style={{
                                    padding: 12,
                                    borderBottom: "1px solid #f3f4f6",
                                    fontSize: 14,
                                }}
                            >
                                <Link
                                    href={`/incidents/${it.id}`}
                                    style={{
                                        color: "#111827",
                                        fontWeight: 600,
                                        textDecoration: "none",
                                    }}
                                >
                                    {it.title}
                                </Link>
                                {it.description ? (
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "#6b7280",
                                            marginTop: 2,
                                        }}
                                    >
                                        {it.description.slice(0, 140)}
                                        {it.description.length > 140 ? "…" : ""}
                                    </div>
                                ) : null}
                            </td>
                            <td
                                style={{
                                    padding: 12,
                                    borderBottom: "1px solid #f3f4f6",
                                    fontSize: 13,
                                }}
                            >
                                    <span style={severityBadge(it.severity)}>
                                        {it.severity}
                                    </span>
                            </td>
                            <td
                                style={{
                                    padding: 12,
                                    borderBottom: "1px solid #f3f4f6",
                                    fontSize: 13,
                                }}
                            >
                                    <span style={statusBadge(it.status)}>
                                        {it.status}
                                    </span>
                            </td>
                            <td
                                style={{
                                    padding: 12,
                                    borderBottom: "1px solid #f3f4f6",
                                    fontSize: 13,
                                    color: "#4b5563",
                                }}
                            >
                                {new Date(it.createdAt).toLocaleString("en-GB", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                })}
                            </td>
                            <td
                                style={{
                                    padding: 12,
                                    borderBottom: "1px solid #f3f4f6",
                                    fontSize: 13,
                                }}
                            >
                                {ENABLE_STATUS_UPDATE ? (
                                    <UpdateStatusButton id={it.id} current={it.status} />
                                ) : (
                                    <span style={{ color: "#9ca3af", fontSize: 12 }}>
                                            read-only
                                        </span>
                                )}
                            </td>
                        </tr>
                    ))}
                    {data.items.length === 0 && (
                        <tr>
                            <td
                                colSpan={5}
                                style={{
                                    padding: 16,
                                    textAlign: "center",
                                    color: "#6b7280",
                                    fontSize: 13,
                                }}
                            >
                                No incidents yet. Create your first incident to get started.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* Pagination buttons */}
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                <Link
                    aria-disabled={data.page <= 1}
                    href={buildHref({ page: String(Math.max(1, data.page - 1)) })}
                    style={{
                        ...pillButton,
                        pointerEvents: data.page <= 1 ? "none" : "auto",
                        opacity: data.page <= 1 ? 0.5 : 1,
                    }}
                >
                    ← Prev
                </Link>
                <Link
                    aria-disabled={data.page >= data.totalPages}
                    href={buildHref({
                        page: String(Math.min(data.totalPages, data.page + 1)),
                    })}
                    style={{
                        ...pillButton,
                        pointerEvents: data.page >= data.totalPages ? "none" : "auto",
                        opacity: data.page >= data.totalPages ? 0.5 : 1,
                    }}
                >
                    Next →
                </Link>
            </div>
        </main>
    );
}
