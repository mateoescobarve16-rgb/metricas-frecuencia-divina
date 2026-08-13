const clientId = process.env.HOTMART_CLIENT_ID;
const clientSecret = process.env.HOTMART_CLIENT_SECRET;
const basicToken = process.env.HOTMART_BASIC_TOKEN;

const tokenUrl = new URL("https://api-sec-vlc.hotmart.com/security/oauth/token");
tokenUrl.searchParams.set("grant_type", "client_credentials");
tokenUrl.searchParams.set("client_id", clientId);
tokenUrl.searchParams.set("client_secret", clientSecret);

const tokenRes = await fetch(tokenUrl, {
  method: "POST",
  headers: { Authorization: basicToken },
});
const { access_token } = await tokenRes.json();

const now = Date.now();
const veintiunDiasMs = 21 * 24 * 60 * 60 * 1000;

const porProductoOferta = new Map();
let pageToken = null;
let paginas = 0;
const MAX_PAGINAS = 10;

do {
  const salesUrl = new URL("https://developers.hotmart.com/payments/api/v1/sales/history");
  salesUrl.searchParams.set("start_date", String(now - veintiunDiasMs));
  salesUrl.searchParams.set("end_date", String(now));
  salesUrl.searchParams.set("max_results", "500");
  if (pageToken) salesUrl.searchParams.set("page_token", pageToken);

  const res = await fetch(salesUrl, { headers: { Authorization: `Bearer ${access_token}` } });
  const body = await res.json();

  if (paginas === 0) {
    console.log("Total resultados (21 dias, todos los productos):", body.page_info?.total_results);
  }

  for (const item of body.items ?? []) {
    const nombre = item.product?.name ?? "SIN_NOMBRE";
    const id = item.product?.id ?? "SIN_ID";
    const code = item.purchase?.offer?.code ?? "SIN_CODIGO";
    if (/circulo|círculo/i.test(nombre)) {
      console.log("MATCH:", JSON.stringify({ nombre, id, code, precio: item.purchase?.price }));
    }
    const key = `${nombre} (id ${id}) | oferta ${code}`;
    porProductoOferta.set(key, (porProductoOferta.get(key) ?? 0) + 1);
  }

  pageToken = body.page_info?.next_page_token ?? null;
  paginas++;
} while (pageToken && paginas < MAX_PAGINAS);

console.log(`\nPaginas leidas: ${paginas}, productos/ofertas distintos totales: ${porProductoOferta.size}`);
