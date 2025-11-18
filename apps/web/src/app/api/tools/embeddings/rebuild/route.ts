import { NextResponse } from "next/server";

const API_BASE_INTERNAL =
    process.env.API_BASE_INTERNAL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://localhost:3001";

const API_KEY = process.env.API_KEY || "";

export async function POST() {
    try {
        const headers: HeadersInit = API_KEY ? { "x-api-key": API_KEY } : {};

        const res = await fetch(
            `${API_BASE_INTERNAL}/incidents/embeddings/rebuild`,
            {
                method: "POST",
                cache: "no-store",
                headers,
            },
        );

        const text = await res.text();
        let body: any = null;
        try {
            body = JSON.parse(text);
        } catch {
            body = text;
        }

        return NextResponse.json(
            {
                ok: res.ok,
                status: res.status,
                body,
            },
            { status: res.ok ? 200 : 500 },
        );
    } catch (e: any) {
        return NextResponse.json(
            {
                ok: false,
                error: e?.message ?? "Rebuild failed",
            },
            { status: 500 },
        );
    }
}
