import { NextResponse } from "next/server";
import { sincronizarMeta } from "@/lib/meta/sync";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const desdeParam = url.searchParams.get("desde"); // YYYY-MM-DD, para respaldos puntuales
  const hastaParam = url.searchParams.get("hasta"); // YYYY-MM-DD

  let since: string;
  let until: string;

  if (desdeParam && hastaParam) {
    since = desdeParam;
    until = hastaParam;
  } else {
    // Por defecto sincroniza una ventana de los ultimos 4 dias (no solo "ayer"): si una
    // corrida falla un dia, la siguiente lo reintenta sola, sin quedar un hueco permanente.
    // ?dias=N permite pedir una ventana mas grande (respaldo desde "ayer" hacia atras).
    const dias = Number(url.searchParams.get("dias") ?? "4");
    const ahora = new Date();
    const ayer = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() - 1));
    const desde = new Date(ayer.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);
    since = desde.toISOString().slice(0, 10);
    until = ayer.toISOString().slice(0, 10);
  }

  try {
    const resultado = await sincronizarMeta(since, until);
    return NextResponse.json({ ok: true, since, until, ...resultado });
  } catch (error) {
    console.error("Error en sync diario de Meta:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
