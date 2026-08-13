import { crearClienteSupabaseAdmin } from "../supabase/admin";
import { listarVentasPorRango } from "./client";
import { precargarTasas, convertirAUsd } from "../fx/rates";

export async function sincronizarVentas(startDate: number, endDate: number) {
  const ventas = await listarVentasPorRango(startDate, endDate);
  if (ventas.length === 0) {
    return { insertadas: 0, total: 0 };
  }

  await precargarTasas();

  const supabase = crearClienteSupabaseAdmin();
  const filas = ventas.map((v) => ({
    transaction_id: v.transactionId,
    product_id: v.productId,
    offer_code: v.offerCode,
    product_name: v.productName,
    status: v.status,
    fecha_venta: v.fechaVenta,
    price_value: v.priceValue,
    price_currency: v.priceCurrency,
    price_usd: v.priceValue !== null && v.priceCurrency ? convertirAUsd(v.priceValue, v.priceCurrency) : null,
    is_subscription: v.isSubscription,
    tracking: v.tracking,
    payload: v.payload,
  }));

  const { error } = await supabase
    .from("hotmart_ventas")
    .upsert(filas, { onConflict: "transaction_id" });

  if (error) {
    throw new Error(`Error guardando ventas en Supabase: ${error.message}`);
  }

  return { insertadas: filas.length, total: ventas.length };
}
