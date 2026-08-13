import { NextRequest, NextResponse } from "next/server";
import { crearClienteSupabaseAdmin } from "@/lib/supabase/admin";

function extraerHottok(req: NextRequest, payload: Record<string, unknown>): string | null {
  const deHeader = req.headers.get("x-hotmart-hottok");
  if (deHeader) return deHeader;

  const deBody = payload["hottok"];
  if (typeof deBody === "string") return deBody;

  const data = payload["data"];
  if (data && typeof data === "object" && typeof (data as Record<string, unknown>)["hottok"] === "string") {
    return (data as Record<string, unknown>)["hottok"] as string;
  }

  return null;
}

function extraerTransactionId(payload: Record<string, unknown>): string | null {
  const data = payload["data"];
  if (!data || typeof data !== "object") return null;

  const purchase = (data as Record<string, unknown>)["purchase"];
  if (!purchase || typeof purchase !== "object") return null;

  const transaction = (purchase as Record<string, unknown>)["transaction"];
  return typeof transaction === "string" ? transaction : null;
}

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as Record<string, unknown>;

  const hottokEsperado = process.env.HOTMART_HOTTOK;
  const hottokRecibido = extraerHottok(req, payload);

  if (!hottokEsperado || hottokRecibido !== hottokEsperado) {
    console.error("Webhook Hotmart rechazado: hottok inválido o ausente");
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const evento = typeof payload["event"] === "string" ? (payload["event"] as string) : null;
  const transactionId = extraerTransactionId(payload);

  const supabase = crearClienteSupabaseAdmin();
  const { error } = await supabase.from("hotmart_eventos_raw").insert({
    evento,
    transaction_id: transactionId,
    payload,
  });

  if (error) {
    console.error("Error guardando evento de Hotmart:", error);
    return NextResponse.json({ error: "No se pudo guardar el evento" }, { status: 500 });
  }

  return NextResponse.json({ recibido: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
