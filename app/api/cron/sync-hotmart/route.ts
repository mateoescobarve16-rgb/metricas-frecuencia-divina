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
    const hoyLocal = fechaLocalDesdeUTC(new Date().toISOString());

    // Por defecto sincroniza una ventana de los ultimos 4 dias (no solo "ayer"): si una
    // corrida falla un dia, la siguiente lo reintenta sola, sin quedar un hueco permanente.
    // Los domingos, la ventana se amplia a 45 dias: Hotmart puede cambiar el estado de una
    // venta semanas despues (reembolso tardio dentro del periodo de garantia), y la ventana
    // corta diaria nunca vuelve a revisar fechas viejas -- esto detecta y corrige esos casos
    // una vez por semana, sin necesidad de intervencion manual (asi encontramos y corregimos
    // el 28 de junio, que llevaba 7 semanas desactualizado).
    // ?dias=N permite pedir una ventana especifica para respaldos puntuales.
    const esDomingo = new Date(`${hoyLocal}T00:00:00Z`).getUTCDay() === 0;
    const dias = Number(url.searchParams.get("dias") ?? (esDomingo ? "45" : "4"));
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
