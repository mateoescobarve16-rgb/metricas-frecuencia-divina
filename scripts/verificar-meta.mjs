import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function get(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/v21.0${path}`);
  url.searchParams.set("access_token", process.env.META_SYSTEM_USER_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  return { status: res.status, body: await res.json() };
}

// 1. Verificar que la lista de cuentas compartidas coincide con lo que tenemos registrado
const clientAccounts = await get(`/${process.env.META_BUSINESS_ID}/client_ad_accounts`, { fields: "id,name,account_status" });
const idsEnVivo = new Set(clientAccounts.body.data.map(a => a.id));
console.log("=== Cuentas compartidas con la BM ahora mismo ===");
for (const a of clientAccounts.body.data) console.log(` ${a.id} ${a.name} status=${a.account_status}`);

const { data: cuentasEnBD } = await supabase.from("meta_ads_diario").select("ad_account_id, ad_account_nombre").limit(1000);
const idsEnBD = new Set(cuentasEnBD.map(c => c.ad_account_id));
const nuevasNoRegistradas = [...idsEnVivo].filter(id => !idsEnBD.has(id));
console.log("\nCuentas compartidas AHORA que nunca hemos sincronizado:", nuevasNoRegistradas.length ? nuevasNoRegistradas : "ninguna");

// 2. Comparar spend/impressions/clics EN VIVO vs guardado, ultimos 14 dias, por cuenta
const desde = "2026-08-02";
const hasta = "2026-08-15";
let totalDiscrepancias = 0;
let totalComparaciones = 0;

for (const cuenta of clientAccounts.body.data) {
  const insights = await get(`/${cuenta.id}/insights`, {
    fields: "spend,impressions,inline_link_clicks",
    time_range: JSON.stringify({ since: desde, until: hasta }),
    time_increment: "1",
  });
  if (insights.status !== 200) {
    console.log(`ERROR consultando ${cuenta.name}:`, JSON.stringify(insights.body));
    continue;
  }

  const { data: guardado } = await supabase
    .from("meta_ads_diario")
    .select("fecha, spend, impressions, clicks")
    .eq("ad_account_id", cuenta.id)
    .gte("fecha", desde)
    .lte("fecha", hasta);

  const guardadoPorFecha = new Map(guardado.map(g => [g.fecha, g]));

  for (const d of insights.body.data ?? []) {
    totalComparaciones++;
    const g = guardadoPorFecha.get(d.date_start);
    const spendVivo = Number(d.spend ?? 0);
    const spendGuardado = g ? Number(g.spend) : 0;
    const diff = Math.abs(spendVivo - spendGuardado);
    const diffPct = spendVivo > 0 ? diff / spendVivo : 0;

    if (diff > 5 && diffPct > 0.03) {
      totalDiscrepancias++;
      console.log(`DISCREPANCIA ${cuenta.name} ${d.date_start}: vivo=$${spendVivo} guardado=$${spendGuardado} (clics vivo=${d.inline_link_clicks ?? 0} guardado=${g?.clicks ?? 0})`);
    }
  }
}

console.log(`\nTotal comparaciones: ${totalComparaciones}, discrepancias (>$5 y >3%): ${totalDiscrepancias}`);
