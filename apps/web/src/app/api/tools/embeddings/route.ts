import { NextRequest, NextResponse } from "next/server";

const API_BASE_INTERNAL =
    process.env.API_BASE_INTERNAL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://localhost:3001";

const API_KEY = process.env.API_KEY || "";

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json().catch(() => null)) as { id?: string } | null;
        const id = body?.id?.trim();

        if (!id) {
            return NextResponse.json(
                { ok: false, error: "Missing id in JSON body" },
                { status: 400 },
            );
        }

        const headers: HeadersInit = API_KEY ? { "x-api-key": API_KEY } : {};

        const res = await fetch(
            `${API_BASE_INTERNAL}/incidents/${encodeURIComponent(id)}/embedding`,
            {
                method: "POST",
                cache: "no-store",
                headers,
            },
        );

        const text = await res.text();
        let data: any = null;
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }

        return NextResponse.json(
            {
                ok: res.ok,
                status: res.status,
                body: data,
            },
            { status: res.ok ? 200 : 500 },
        );
    } catch (e: any) {
        return NextResponse.json(
            {
                ok: false,
                error: e?.message ?? "Rebuild for id failed",
            },
            { status: 500 },
        );
    }
}
