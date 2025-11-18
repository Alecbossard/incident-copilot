import { NextRequest, NextResponse } from "next/server";

const API_BASE =
    process.env.API_BASE_INTERNAL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://localhost:3001";

const API_KEY = process.env.API_KEY || "";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const res = await fetch(`${API_BASE}/incidents`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                ...(API_KEY ? { "x-api-key": API_KEY } : {}),
            },
            body: JSON.stringify(body),
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
            { error: e?.message ?? "Proxy /api/incidents failed" },
            { status: 500 },
        );
    }
}
