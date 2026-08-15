import { crearClienteSupabaseAdmin } from "../supabase/admin";
import { clasificarVenta, type CategoriaFunnel } from "../hotmart/mapeoProductos";

const ESTADOS_EXCLUIDOS = new Set([
  "REFUNDED",
  "CHARGEBACK",
  "CANCELLED",
  "CANCELED",
  "EXPIRED",
  "DISPUTE",
  "PROTESTED",
  "BLOCKED",
  "PRE_ORDER",
  "PRINTED_BILLET",
  "WAITING_PAYMENT",
  "STARTED",
]);

export const CATEGORIAS: CategoriaFunnel[] = [
  "front_end",
  "upsell_01",
  "downsell_01",
  "upsell_02",
  "downsell_02",
  "upsell_03",
  "downsell_03",
  "miembros",
  "sin_clasificar",
];

export type ResumenDia = {
  fecha: string;
  inversion: number;
  impresiones: number;
  clics: number;
  cpc: number | null;
  ctr: number | null;
  cpm: number | null;
  landingPageViews: number;
  costoPorVisita: number | null;
  pagosIniciados: number;
  costoPorPagoIniciado: number | null;
  porCategoria: Record<CategoriaFunnel, { conteo: number; facturacion: number }>;
  facturacionTotal: number;
  ticketMedio: number | null;
  roas: number | null;
};

function categoriaVacia(): Record<CategoriaFunnel, { conteo: number; facturacion: number }> {
  const obj = {} as Record<CategoriaFunnel, { conteo: number; facturacion: number }>;
  for (const c of CATEGORIAS) obj[c] = { conteo: 0, facturacion: 0 };
  return obj;
}

// Supabase/PostgREST limita cada respuesta a un maximo de filas (tipicamente 1000),
// sin importar cuantas pida uno -- hay que paginar explicitamente o se pierden datos
// en silencio (esto causaba que fechas recientes desaparecieran del panel una vez que
// hotmart_ventas paso de 1000 filas).
async function obtenerTodasLasFilas<T>(
  construirQuery: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const TAMANO_PAGINA = 1000;
  const resultado: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await construirQuery(offset, offset + TAMANO_PAGINA - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    resultado.push(...data);
    if (data.length < TAMANO_PAGINA) break;
    offset += TAMANO_PAGINA;
  }

  return resultado;
}

export async function obtenerResumenDiario(desde: string, hasta: string): Promise<ResumenDia[]> {
  const supabase = crearClienteSupabaseAdmin();

  const [ventas, metaFilas] = await Promise.all([
    obtenerTodasLasFilas((desdeI, hastaI) =>
      supabase
        .from("hotmart_ventas")
        .select("product_id, offer_code, status, price_usd, fecha_venta")
        .gte("fecha_venta", `${desde}T00:00:00Z`)
        .lt("fecha_venta", `${hasta}T23:59:59.999Z`)
        .range(desdeI, hastaI)
    ),
    obtenerTodasLasFilas((desdeI, hastaI) =>
      supabase
        .from("meta_ads_diario")
        .select("fecha, spend, impressions, clicks, landing_page_views, pagos_iniciados")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .range(desdeI, hastaI)
    ),
  ]);

  const porFecha = new Map<string, ResumenDia>();

  function obtenerDia(fecha: string): ResumenDia {
    let dia = porFecha.get(fecha);
    if (!dia) {
      dia = {
        fecha,
        inversion: 0,
        impresiones: 0,
        clics: 0,
        cpc: null,
        ctr: null,
        cpm: null,
        landingPageViews: 0,
        costoPorVisita: null,
        pagosIniciados: 0,
        costoPorPagoIniciado: null,
        porCategoria: categoriaVacia(),
        facturacionTotal: 0,
        ticketMedio: null,
        roas: null,
      };
      porFecha.set(fecha, dia);
    }
    return dia;
  }

  for (const fila of metaFilas ?? []) {
    const dia = obtenerDia(fila.fecha);
    dia.inversion += Number(fila.spend ?? 0);
    dia.impresiones += Number(fila.impressions ?? 0);
    dia.clics += Number(fila.clicks ?? 0);
    dia.landingPageViews += Number(fila.landing_page_views ?? 0);
    dia.pagosIniciados += Number(fila.pagos_iniciados ?? 0);
  }

  for (const venta of ventas ?? []) {
    if (ESTADOS_EXCLUIDOS.has(venta.status)) continue;

    const fecha = venta.fecha_venta.slice(0, 10);
    const dia = obtenerDia(fecha);
    const categoria = clasificarVenta(venta.product_id, venta.offer_code);
    dia.porCategoria[categoria].conteo += 1;
    if (venta.price_usd !== null) {
      dia.porCategoria[categoria].facturacion += venta.price_usd;
      dia.facturacionTotal += venta.price_usd;
    }
  }

  const dias = [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));

  for (const dia of dias) {
    dia.cpc = dia.clics > 0 ? dia.inversion / dia.clics : null;
    dia.ctr = dia.impresiones > 0 ? (dia.clics / dia.impresiones) * 100 : null;
    dia.cpm = dia.impresiones > 0 ? (dia.inversion / dia.impresiones) * 1000 : null;
    dia.costoPorVisita = dia.landingPageViews > 0 ? dia.inversion / dia.landingPageViews : null;
    dia.costoPorPagoIniciado = dia.pagosIniciados > 0 ? dia.inversion / dia.pagosIniciados : null;

    const totalConversiones = CATEGORIAS.reduce((acc, c) => acc + dia.porCategoria[c].conteo, 0);
    dia.ticketMedio = totalConversiones > 0 ? dia.facturacionTotal / totalConversiones : null;
    dia.roas = dia.inversion > 0 ? dia.facturacionTotal / dia.inversion : null;
  }

  return dias;
}
