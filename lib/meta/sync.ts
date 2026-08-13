import { crearClienteSupabaseAdmin } from "../supabase/admin";
import { listarCuentasActivas, obtenerInsightsDiarios } from "./client";

export async function sincronizarMeta(since: string, until: string) {
  const cuentas = await listarCuentasActivas();
  const supabase = crearClienteSupabaseAdmin();
  let filasTotal = 0;

  for (const cuenta of cuentas) {
    const insights = await obtenerInsightsDiarios(cuenta.id, since, until);
    if (insights.length === 0) continue;

    const filas = insights.map((i) => ({
      ad_account_id: cuenta.id,
      ad_account_nombre: cuenta.nombre,
      bm_origen_id: cuenta.bmOrigenId,
      bm_origen_nombre: cuenta.bmOrigenNombre,
      fecha: i.fecha,
      spend: i.spend,
      impressions: i.impressions,
      clicks: i.clicks,
      cpc: i.cpc,
      ctr: i.ctr,
      cpm: i.cpm,
    }));

    const { error } = await supabase
      .from("meta_ads_diario")
      .upsert(filas, { onConflict: "ad_account_id,fecha" });

    if (error) {
      throw new Error(`Error guardando insights de ${cuenta.id}: ${error.message}`);
    }
    filasTotal += filas.length;
  }

  return { cuentas: cuentas.length, filas: filasTotal };
}
