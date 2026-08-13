import { NextResponse } from "next/server";
import { sincronizarMeta } from "@/lib/meta/sync";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ahora = new Date();
  const ayer = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() - 1));
  const fecha = ayer.toISOString().slice(0, 10);

  try {
    const resultado = await sincronizarMeta(fecha, fecha);
    return NextResponse.json({ ok: true, fecha, ...resultado });
  } catch (error) {
    console.error("Error en sync diario de Meta:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
