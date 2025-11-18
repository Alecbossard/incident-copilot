import { NextResponse } from "next/server";

const API_BASE_INTERNAL =
    process.env.API_BASE_INTERNAL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://localhost:3001";

export async function GET() {
    try {
        const res = await fetch(`${API_BASE_INTERNAL}/health`, {
            cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        return NextResponse.json(
            {
                ok: res.ok,
                status: res.status,
                upstream: json,
            },
            { status: res.ok ? 200 : 500 },
        );
    } catch (e: any) {
        return NextResponse.json(
            {
                ok: false,
                error: e?.message ?? "Health check failed",
            },
            { status: 500 },
        );
    }
}
