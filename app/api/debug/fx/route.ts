import { NextResponse } from "next/server";
import { precargarTasas, convertirAUsd } from "@/lib/fx/rates";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await precargarTasas();
  const resultado = convertirAUsd(777.2, "MXN");

  return NextResponse.json({ resultado });
}
