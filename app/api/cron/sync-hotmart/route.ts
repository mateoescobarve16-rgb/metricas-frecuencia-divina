import { NextResponse } from "next/server";
import { sincronizarVentas } from "@/lib/hotmart/sync";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ahora = new Date();
  const inicioHoyUTC = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate());
  const inicioAyerUTC = inicioHoyUTC - 24 * 60 * 60 * 1000;

  try {
    const resultado = await sincronizarVentas(inicioAyerUTC, inicioHoyUTC);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    console.error("Error en sync diario de Hotmart:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
