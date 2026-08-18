import { crearClienteSupabaseAdmin } from "../supabase/admin";
import { listarVentasPorRango, obtenerResumenVentas, buscarTransaccion, type VentaHotmart } from "./client";
import { obtenerTasas, convertirAUsd } from "../fx/rates";
import { fechaLocalDesdeUTC } from "../tiempo/zonaHorariaHotmart";

export async function sincronizarVentas(startDate: number, endDate: number) {
  const ventas = await listarVentasPorRango(startDate, endDate);

  const supabase = crearClienteSupabaseAdmin();

  // Transacciones que ya teniamos guardadas en este rango pero que Hotmart ya no devuelve
  // en la consulta por rango de fechas -- le pasa a transacciones que cambian de estado
  // despues de sincronizadas (ej. un contracargo/protesta): Hotmart deja de listarlas por
  // rango una vez cambian de estado, aunque siguen existiendo y se pueden consultar por su
  // codigo. Sin este paso, el estado viejo (ej. APPROVED) queda guardado para siempre y la
  // verificacion contra Hotmart nunca se autocorrige, ni con el resync semanal de 45 dias.
  const idsDevueltos = new Set(ventas.map((v) => v.transactionId));
  const { data: existentes, error: errorExistentes } = await supabase
    .from("hotmart_ventas")
    .select("transaction_id")
    .gte("fecha_venta", new Date(startDate).toISOString())
    .lt("fecha_venta", new Date(endDate).toISOString());
  if (errorExistentes) throw new Error(`Error consultando ventas existentes: ${errorExistentes.message}`);

  const idsFaltantes = (existentes ?? []).map((f) => f.transaction_id).filter((id) => !idsDevueltos.has(id));
  const refrescos = await Promise.all(idsFaltantes.map((id) => buscarTransaccion(id)));

  const ventasRefrescadas: VentaHotmart[] = [];
  const idsSinRastro: string[] = [];
  refrescos.forEach((venta, i) => {
    if (venta) ventasRefrescadas.push(venta);
    else idsSinRastro.push(idsFaltantes[i]);
  });

  if (idsSinRastro.length > 0) {
    const { error } = await supabase.from("hotmart_ventas").update({ status: "SIN_RASTRO_EN_HOTMART" }).in("transaction_id", idsSinRastro);
    if (error) throw new Error(`Error marcando transacciones sin rastro: ${error.message}`);
  }

  const todasLasVentas = [...ventas, ...ventasRefrescadas];

  if (todasLasVentas.length > 0) {
    const tasas = await obtenerTasas();

    const filas = todasLasVentas.map((v) => ({
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

  return {
    insertadas: ventas.length,
    refrescadas: ventasRefrescadas.length,
    sinRastro: idsSinRastro.length,
    total: todasLasVentas.length,
    diasResumen: diasSincronizados,
  };
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
