import { NextRequest, NextResponse } from "next/server";

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const apiBase =
        process.env.API_BASE_INTERNAL ||
        process.env.NEXT_PUBLIC_API_BASE ||
        "http://api:3001";
    const apiKey = process.env.API_KEY;

    if (!apiBase || !apiKey) {
        return NextResponse.json(
            { error: "API_BASE_INTERNAL or API_KEY not configured" },
            { status: 500 }
        );
    }

    const body = await req.json().catch(() => null);

    if (!body || !Array.isArray((body as any).messages)) {
        return NextResponse.json(
            { error: "Invalid body, expected { messages: [...] }" },
            { status: 400 }
        );
    }

    const res = await fetch(`${apiBase}/incidents/${params.id}/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    return NextResponse.json(data, { status: res.status });
}
