import { crearClienteSupabaseAdmin } from "../supabase/admin";
import { clasificarVenta, type CategoriaFunnel } from "../hotmart/mapeoProductos";
import { inicioDiaLocalComoUTC, fechaLocalDesdeUTC } from "../tiempo/zonaHorariaHotmart";

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
  // Estado propio (no de Hotmart): marca transacciones que en algun momento dejaron de
  // aparecer en la API de Hotmart sin que sepamos la razon exacta (rarisimo, ~1 en 8000
  // revisadas). Se excluyen para que coincidan con el conteo oficial de Hotmart.
  "SIN_RASTRO_EN_HOTMART",
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
  porCategoria: Record<CategoriaFunnel, { conteo: number; conteoNuevo: number; facturacion: number; facturacionNueva: number }>;
  facturacionTotal: number;
  facturacionNuevaTotal: number;
  facturacionRenovacionesTotal: number;
  usuariosUnicos: number;
  arpu: number | null;
  roas: number | null;
  roasNuevo: number | null;
  verificacion: {
    estado: "ok" | "sin_datos" | "discrepancia";
    itemsPropios: number;
    itemsHotmart: number | null;
    factorCorreccion: number | null;
  };
};

function categoriaVacia(): Record<CategoriaFunnel, { conteo: number; conteoNuevo: number; facturacion: number; facturacionNueva: number }> {
  const obj = {} as Record<CategoriaFunnel, { conteo: number; conteoNuevo: number; facturacion: number; facturacionNueva: number }>;
  for (const c of CATEGORIAS) obj[c] = { conteo: 0, conteoNuevo: 0, facturacion: 0, facturacionNueva: 0 };
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

  const inicioUTC = new Date(inicioDiaLocalComoUTC(desde)).toISOString();
  const finUTC = new Date(inicioDiaLocalComoUTC(hasta) + 24 * 60 * 60 * 1000).toISOString();

  const [ventas, metaFilas, resumenHotmart] = await Promise.all([
    obtenerTodasLasFilas((desdeI, hastaI) =>
      supabase
        .from("hotmart_ventas")
        .select("product_id, offer_code, status, price_usd, fecha_venta, recurrency_number, buyer_ucode")
        .gte("fecha_venta", inicioUTC)
        .lt("fecha_venta", finUTC)
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
    obtenerTodasLasFilas((desdeI, hastaI) =>
      supabase
        .from("hotmart_resumen_diario")
        .select("fecha, facturacion_usd, total_items")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .range(desdeI, hastaI)
    ),
  ]);

  const resumenHotmartPorFecha = new Map(
    resumenHotmart.map((r) => [r.fecha, { facturacionUsd: Number(r.facturacion_usd), totalItems: Number(r.total_items) }])
  );

  const porFecha = new Map<string, ResumenDia>();
  const compradoresPorFecha = new Map<string, Set<string>>();

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
        facturacionNuevaTotal: 0,
        facturacionRenovacionesTotal: 0,
        usuariosUnicos: 0,
        arpu: null,
        roas: null,
        roasNuevo: null,
        verificacion: { estado: "sin_datos", itemsPropios: 0, itemsHotmart: null, factorCorreccion: null },
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

    const fecha = fechaLocalDesdeUTC(venta.fecha_venta);
    const dia = obtenerDia(fecha);
    const categoria = clasificarVenta(venta.product_id, venta.offer_code);
    const esRenovacion = (venta.recurrency_number ?? 1) > 1;

    if (venta.buyer_ucode) {
      if (!compradoresPorFecha.has(fecha)) compradoresPorFecha.set(fecha, new Set());
      compradoresPorFecha.get(fecha)!.add(venta.buyer_ucode);
    }

    dia.porCategoria[categoria].conteo += 1;
    if (!esRenovacion) {
      dia.porCategoria[categoria].conteoNuevo += 1;
    }
    if (venta.price_usd !== null) {
      dia.porCategoria[categoria].facturacion += venta.price_usd;
      dia.facturacionTotal += venta.price_usd;
      if (esRenovacion) {
        dia.facturacionRenovacionesTotal += venta.price_usd;
      } else {
        dia.porCategoria[categoria].facturacionNueva += venta.price_usd;
        dia.facturacionNuevaTotal += venta.price_usd;
      }
    }
  }

  const dias = [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));

  for (const dia of dias) {
    const itemsPropios = CATEGORIAS.reduce((acc, c) => acc + dia.porCategoria[c].conteo, 0);
    const resumenOficial = resumenHotmartPorFecha.get(dia.fecha);

    // Hotmart convierte cada venta a USD con su propia tasa interna (la que muestra su
    // panel/"Faturamento"). Nuestra conversion via una API de tasas externa es solo una
    // aproximacion -- puede diferir bastante en monedas volatiles como ARS. Reescalamos
    // nuestro total (y el desglose por categoria, proporcionalmente) para que coincida
    // exacto con el numero oficial de Hotmart, sin perder el desglose por etapa del funnel.
    let factorCorreccion: number | null = null;
    if (resumenOficial !== undefined && dia.facturacionTotal > 0) {
      factorCorreccion = resumenOficial.facturacionUsd / dia.facturacionTotal;
      for (const c of CATEGORIAS) {
        dia.porCategoria[c].facturacion *= factorCorreccion;
        dia.porCategoria[c].facturacionNueva *= factorCorreccion;
      }
      dia.facturacionNuevaTotal *= factorCorreccion;
      dia.facturacionRenovacionesTotal *= factorCorreccion;
      dia.facturacionTotal = resumenOficial.facturacionUsd;
    }

    // Verificacion automatica contra los numeros oficiales de Hotmart -- el mismo metodo
    // que usamos para encontrar y corregir los bugs de zona horaria/conversion de moneda,
    // pero corriendo solo en cada sincronizacion en vez de a mano.
    let estado: "ok" | "sin_datos" | "discrepancia" = "sin_datos";
    if (resumenOficial !== undefined) {
      const itemsCoinciden = itemsPropios === resumenOficial.totalItems;
      const factorRazonable = factorCorreccion === null || (factorCorreccion >= 0.7 && factorCorreccion <= 1.3);
      estado = itemsCoinciden && factorRazonable ? "ok" : "discrepancia";
    }
    dia.verificacion = {
      estado,
      itemsPropios,
      itemsHotmart: resumenOficial?.totalItems ?? null,
      factorCorreccion,
    };

    dia.cpc = dia.clics > 0 ? dia.inversion / dia.clics : null;
    dia.ctr = dia.impresiones > 0 ? (dia.clics / dia.impresiones) * 100 : null;
    dia.cpm = dia.impresiones > 0 ? (dia.inversion / dia.impresiones) * 1000 : null;
    dia.costoPorVisita = dia.landingPageViews > 0 ? dia.inversion / dia.landingPageViews : null;
    dia.costoPorPagoIniciado = dia.pagosIniciados > 0 ? dia.inversion / dia.pagosIniciados : null;

    dia.usuariosUnicos = compradoresPorFecha.get(dia.fecha)?.size ?? 0;
    dia.arpu = dia.usuariosUnicos > 0 ? dia.facturacionTotal / dia.usuariosUnicos : null;
    dia.roas = dia.inversion > 0 ? dia.facturacionTotal / dia.inversion : null;
    dia.roasNuevo = dia.inversion > 0 ? dia.facturacionNuevaTotal / dia.inversion : null;
  }

  return dias;
}
