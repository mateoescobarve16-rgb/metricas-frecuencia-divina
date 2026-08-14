import { NextResponse } from "next/server";
import { sincronizarMeta } from "@/lib/meta/sync";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  // Por defecto sincroniza una ventana de los ultimos 4 dias (no solo "ayer"): si una
  // corrida falla un dia, la siguiente lo reintenta sola, sin quedar un hueco permanente.
  // ?dias=N permite pedir una ventana mas grande para respaldos historicos puntuales.
  const dias = Number(url.searchParams.get("dias") ?? "4");

  const ahora = new Date();
  const ayer = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() - 1));
  const desde = new Date(ayer.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);
  const since = desde.toISOString().slice(0, 10);
  const until = ayer.toISOString().slice(0, 10);

  try {
    const resultado = await sincronizarMeta(since, until);
    return NextResponse.json({ ok: true, since, until, ...resultado });
  } catch (error) {
    console.error("Error en sync diario de Meta:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
