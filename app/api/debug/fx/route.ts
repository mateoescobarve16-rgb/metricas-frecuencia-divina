import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const text = await res.text();
    return NextResponse.json({ ok: true, status: res.status, body: text.slice(0, 500) });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: String(error),
      cause: error instanceof Error && error.cause ? String(error.cause) : null,
    });
  }
}
