import { NextResponse } from "next/server";
import { sincronizarVentas } from "@/lib/hotmart/sync";
import { inicioDiaLocalComoUTC, fechaLocalDesdeUTC } from "@/lib/tiempo/zonaHorariaHotmart";

export const dynamic = "force-dynamic";

const UN_DIA_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const desdeParam = url.searchParams.get("desde"); // YYYY-MM-DD (dia local, UTC-5), para respaldos puntuales
  const hastaParam = url.searchParams.get("hasta"); // YYYY-MM-DD (dia local, UTC-5)

  let inicioVentanaUTC: number;
  let inicioHoyUTC: number;

  if (desdeParam && hastaParam) {
    inicioVentanaUTC = inicioDiaLocalComoUTC(desdeParam);
    inicioHoyUTC = inicioDiaLocalComoUTC(hastaParam) + UN_DIA_MS;
  } else {
    // Por defecto sincroniza una ventana de los ultimos 4 dias (no solo "ayer"): si una
    // corrida falla un dia, la siguiente lo reintenta sola, sin quedar un hueco permanente.
    // ?dias=N permite pedir una ventana mas grande (respaldo desde "hoy" hacia atras).
    const dias = Number(url.searchParams.get("dias") ?? "4");
    const hoyLocal = fechaLocalDesdeUTC(new Date().toISOString());
    inicioHoyUTC = inicioDiaLocalComoUTC(hoyLocal); // exclusivo: llega hasta el final de "ayer" local
    inicioVentanaUTC = inicioHoyUTC - dias * UN_DIA_MS;
  }

  try {
    const resultado = await sincronizarVentas(inicioVentanaUTC, inicioHoyUTC);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    console.error("Error en sync diario de Hotmart:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
