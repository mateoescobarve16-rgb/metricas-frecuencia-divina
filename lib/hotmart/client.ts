export type VentaHotmart = {
  transactionId: string;
  productId: number;
  offerCode: string;
  productName: string;
  status: string;
  fechaVenta: string;
  priceValue: number | null;
  priceCurrency: string | null;
  isSubscription: boolean;
  recurrencyNumber: number;
  tracking: unknown;
  payload: unknown;
};

async function obtenerAccessToken(): Promise<string> {
  const tokenUrl = new URL("https://api-sec-vlc.hotmart.com/security/oauth/token");
  tokenUrl.searchParams.set("grant_type", "client_credentials");
  tokenUrl.searchParams.set("client_id", process.env.HOTMART_CLIENT_ID!);
  tokenUrl.searchParams.set("client_secret", process.env.HOTMART_CLIENT_SECRET!);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { Authorization: process.env.HOTMART_BASIC_TOKEN! },
  });

  if (!res.ok) {
    throw new Error(`No se pudo autenticar con Hotmart: ${res.status} ${await res.text()}`);
  }

  const { access_token } = (await res.json()) as { access_token: string };
  return access_token;
}

function mapearItem(item: any): VentaHotmart {
  return {
    transactionId: item.purchase.transaction,
    productId: item.product.id,
    offerCode: item.purchase.offer?.code ?? "",
    productName: item.product.name,
    status: item.purchase.status,
    fechaVenta: new Date(item.purchase.order_date).toISOString(),
    priceValue: item.purchase.price?.value ?? null,
    priceCurrency: item.purchase.price?.currency_code ?? null,
    isSubscription: Boolean(item.purchase.is_subscription),
    recurrencyNumber: Number(item.purchase.recurrency_number ?? 1),
    tracking: item.purchase.tracking ?? null,
    payload: item,
  };
}

export async function listarVentasPorRango(startDate: number, endDate: number): Promise<VentaHotmart[]> {
  const accessToken = await obtenerAccessToken();
  const ventas: VentaHotmart[] = [];
  let pageToken: string | null = null;

  do {
    const url = new URL("https://developers.hotmart.com/payments/api/v1/sales/history");
    url.searchParams.set("start_date", String(startDate));
    url.searchParams.set("end_date", String(endDate));
    url.searchParams.set("max_results", "500");
    if (pageToken) url.searchParams.set("page_token", pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      throw new Error(`Error consultando ventas de Hotmart: ${res.status} ${await res.text()}`);
    }

    const body = await res.json();
    for (const item of body.items ?? []) {
      ventas.push(mapearItem(item));
    }

    pageToken = body.page_info?.next_page_token ?? null;
  } while (pageToken);

  return ventas;
}

// El endpoint de "resumen" de Hotmart ya trae la facturacion convertida a USD usando la
// tasa de cambio INTERNA de Hotmart (la misma que muestra su propio panel/"Faturamento").
// Nuestra propia conversion via una API de tasas externa no coincide exacto con eso,
// sobre todo en monedas volatiles como ARS -- por eso usamos este numero como la fuente
// de verdad para la facturacion total, en vez de sumar nuestras conversiones.
export async function obtenerResumenVentas(startDate: number, endDate: number): Promise<{ totalValueUsd: number; totalItems: number }> {
  const accessToken = await obtenerAccessToken();

  const url = new URL("https://developers.hotmart.com/payments/api/v1/sales/summary");
  url.searchParams.set("start_date", String(startDate));
  url.searchParams.set("end_date", String(endDate));

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Error consultando resumen de ventas de Hotmart: ${res.status} ${await res.text()}`);
  }

  const body = await res.json();
  const item = body.items?.[0];
  return {
    totalValueUsd: item?.total_value?.value ?? 0,
    totalItems: item?.total_items ?? 0,
  };
}
