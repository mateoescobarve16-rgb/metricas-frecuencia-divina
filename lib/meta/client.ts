const GRAPH_VERSION = "v21.0";

async function get(path: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}${path}`);
  url.searchParams.set("access_token", process.env.META_SYSTEM_USER_TOKEN!);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Error consultando Meta (${path}): ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export type CuentaPublicitaria = {
  id: string;
  nombre: string;
  bmOrigenId: string | null;
  bmOrigenNombre: string | null;
};

// Cuentas compartidas (como cliente) con la BM matriz. Esto es automático: cuando se
// agrega o quita una cuenta de otra BM por temas de bloqueos, esta lista se ajusta sola,
// sin necesidad de reasignar nada manualmente.
//
// Importante: se traen TODAS las cuentas devueltas por client_ad_accounts, sin filtrar
// por account_status. Una cuenta puede gastar dinero real un dia y quedar deshabilitada
// (bloqueada) al dia siguiente, antes de que corra el cron -- si filtraramos por "activa",
// perderiamos ese gasto real para siempre. Pedir insights de una cuenta sin actividad no
// cuesta nada (Meta responde vacio), asi que no hay downside en incluirlas todas.
export async function listarCuentasCompartidas(): Promise<CuentaPublicitaria[]> {
  const businessId = process.env.META_BUSINESS_ID!;
  const cuentas: CuentaPublicitaria[] = [];
  let after: string | undefined;

  do {
    const params: Record<string, string> = { fields: "id,name,business" };
    if (after) params.after = after;

    const body = await get(`/${businessId}/client_ad_accounts`, params);
    for (const c of body.data ?? []) {
      cuentas.push({
        id: c.id,
        nombre: c.name,
        bmOrigenId: c.business?.id ?? null,
        bmOrigenNombre: c.business?.name ?? null,
      });
    }

    after = body.paging?.next ? body.paging.cursors?.after : undefined;
  } while (after);

  return cuentas;
}

export type InsightDiario = {
  fecha: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpc: number;
  ctr: number;
  cpm: number;
  landingPageViews: number;
  pagosIniciados: number;
};

function extraerAccion(actions: any[] | undefined, tipo: string): number {
  const accion = actions?.find((a) => a.action_type === tipo);
  return accion ? Number(accion.value) : 0;
}

export async function obtenerInsightsDiarios(adAccountId: string, since: string, until: string): Promise<InsightDiario[]> {
  const body = await get(`/${adAccountId}/insights`, {
    // "clicks" incluye TODO (reacciones, comentarios, etc.) -- usamos inline_link_clicks,
    // que es lo mismo que Ads Manager muestra como "Clics en el enlace" por defecto.
    fields: "spend,impressions,inline_link_clicks,actions",
    time_range: JSON.stringify({ since, until }),
    time_increment: "1",
  });

  return (body.data ?? []).map((d: any) => {
    const spend = Number(d.spend ?? 0);
    const impressions = Number(d.impressions ?? 0);
    const clicks = Number(d.inline_link_clicks ?? 0);
    return {
      fecha: d.date_start,
      spend,
      impressions,
      clicks,
      cpc: clicks > 0 ? spend / clicks : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      landingPageViews: extraerAccion(d.actions, "landing_page_view"),
      pagosIniciados: extraerAccion(d.actions, "initiate_checkout"),
    };
  });
}
