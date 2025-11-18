import { NextRequest, NextResponse } from "next/server";

const API_BASE =
    process.env.API_BASE_INTERNAL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://localhost:3001";

const API_KEY = process.env.API_KEY || "";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        const q = searchParams.get("q") ?? "";
        const k = searchParams.get("k") ?? "5";

        const upstreamUrl = new URL(`${API_BASE}/incidents/similar`);
        if (q.trim()) upstreamUrl.searchParams.set("q", q);
        upstreamUrl.searchParams.set("k", k);

        const res = await fetch(upstreamUrl.toString(), {
            method: "GET",
            headers: {
                ...(API_KEY ? { "x-api-key": API_KEY } : {}),
            },
        });

        const text = await res.text();

        return new NextResponse(text, {
            status: res.status,
            headers: {
                "content-type":
                    res.headers.get("content-type") ?? "application/json; charset=utf-8",
            },
        });
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message ?? "Proxy /api/incidents/similar failed" },
            { status: 500 },
        );
    }
}
