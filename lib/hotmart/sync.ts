import { crearClienteSupabaseAdmin } from "../supabase/admin";
import { listarVentasPorRango, obtenerResumenVentas } from "./client";
import { obtenerTasas, convertirAUsd } from "../fx/rates";
import { fechaLocalDesdeUTC } from "../tiempo/zonaHorariaHotmart";

export async function sincronizarVentas(startDate: number, endDate: number) {
  const ventas = await listarVentasPorRango(startDate, endDate);

  if (ventas.length > 0) {
    const tasas = await obtenerTasas();

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
      price_usd: v.priceValue !== null && v.priceCurrency ? convertirAUsd(v.priceValue, v.priceCurrency, tasas) : null,
      is_subscription: v.isSubscription,
      recurrency_number: v.recurrencyNumber,
      buyer_ucode: v.buyerUcode,
      tracking: v.tracking,
      payload: v.payload,
    }));

    const { error } = await supabase
      .from("hotmart_ventas")
      .upsert(filas, { onConflict: "transaction_id" });

    if (error) {
      throw new Error(`Error guardando ventas en Supabase: ${error.message}`);
    }
  }

  const diasSincronizados = await sincronizarResumenDiario(startDate, endDate);

  return { insertadas: ventas.length, total: ventas.length, diasResumen: diasSincronizados };
}

const UN_DIA_MS = 24 * 60 * 60 * 1000;

// Trae, dia por dia, la facturacion ya convertida a USD por el propio Hotmart (fuente
// de verdad -- coincide exacto con su panel, a diferencia de nuestra conversion propia
// via una API de tasas externa, que puede diferir bastante en monedas volatiles como ARS.
async function sincronizarResumenDiario(startDate: number, endDate: number): Promise<number> {
  const supabase = crearClienteSupabaseAdmin();
  const filas = [];

  for (let inicioDia = startDate; inicioDia < endDate; inicioDia += UN_DIA_MS) {
    const finDia = inicioDia + UN_DIA_MS;
    const resumen = await obtenerResumenVentas(inicioDia, finDia);
    const fecha = fechaLocalDesdeUTC(new Date(inicioDia).toISOString());
    filas.push({
      fecha,
      facturacion_usd: resumen.totalValueUsd,
      total_items: resumen.totalItems,
    });
  }

  if (filas.length === 0) return 0;

  const { error } = await supabase.from("hotmart_resumen_diario").upsert(filas, { onConflict: "fecha" });
  if (error) {
    throw new Error(`Error guardando resumen diario de Hotmart: ${error.message}`);
  }

  return filas.length;
}
