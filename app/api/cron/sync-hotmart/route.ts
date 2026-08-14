import { NextResponse } from "next/server";
import { sincronizarVentas } from "@/lib/hotmart/sync";

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
  const inicioHoyUTC = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate());
  const inicioVentanaUTC = inicioHoyUTC - dias * 24 * 60 * 60 * 1000;

  try {
    const resultado = await sincronizarVentas(inicioVentanaUTC, inicioHoyUTC);
    return NextResponse.json({ ok: true, dias, ...resultado });
  } catch (error) {
    console.error("Error en sync diario de Hotmart:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
