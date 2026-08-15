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
export async function listarCuentasActivas(): Promise<CuentaPublicitaria[]> {
  const businessId = process.env.META_BUSINESS_ID!;
  const cuentas: CuentaPublicitaria[] = [];
  let after: string | undefined;

  do {
    const params: Record<string, string> = { fields: "id,name,account_status,business" };
    if (after) params.after = after;

    const body = await get(`/${businessId}/client_ad_accounts`, params);
    for (const c of body.data ?? []) {
      if (c.account_status === 1) {
        cuentas.push({
          id: c.id,
          nombre: c.name,
          bmOrigenId: c.business?.id ?? null,
          bmOrigenNombre: c.business?.name ?? null,
        });
      }
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
    fields: "spend,impressions,clicks,cpc,ctr,cpm,actions",
    time_range: JSON.stringify({ since, until }),
    time_increment: "1",
  });

  return (body.data ?? []).map((d: any) => ({
    fecha: d.date_start,
    spend: Number(d.spend ?? 0),
    impressions: Number(d.impressions ?? 0),
    clicks: Number(d.clicks ?? 0),
    cpc: Number(d.cpc ?? 0),
    ctr: Number(d.ctr ?? 0),
    cpm: Number(d.cpm ?? 0),
    landingPageViews: extraerAccion(d.actions, "landing_page_view"),
    pagosIniciados: extraerAccion(d.actions, "initiate_checkout"),
  }));
}
