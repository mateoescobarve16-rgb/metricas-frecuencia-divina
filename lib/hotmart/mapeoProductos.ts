export type CategoriaFunnel =
  | "front_end"
  | "upsell_01"
  | "downsell_01"
  | "upsell_02"
  | "downsell_02"
  | "upsell_03"
  | "downsell_03"
  | "miembros"
  | "sin_clasificar";

type Regla = { productId: number; offerCode?: string; categoria: CategoriaFunnel; nota: string };

// La clasificación siempre es por product_id + offer.code (identificadores fijos de Hotmart),
// nunca por precio: el precio varía según el país/moneda del comprador.
const REGLAS: Regla[] = [
  { productId: 6061456, categoria: "front_end", nota: "Frecuencia Divina" },
  { productId: 6219155, categoria: "upsell_01", nota: "Desafio Manifestacion Acelerada (sin punto)" },
  { productId: 7317663, categoria: "downsell_01", nota: "Desafio Manifestacion Acelerada. (con punto)" },
  { productId: 7807482, offerCode: "jf4jhj09", categoria: "upsell_02", nota: "Acompañamiento Personalizado, ~$27" },
  { productId: 7807482, offerCode: "19v4ob0d", categoria: "downsell_02", nota: "Acompañamiento Personalizado, ~$19" },
  { productId: 7807482, offerCode: "anetkv56", categoria: "miembros", nota: "Acompañamiento Personalizado, ~$37, venta desde área de miembros" },
  { productId: 8240786, offerCode: "fipxqw6x", categoria: "upsell_03", nota: "Círculo Interno, precio alto" },
  { productId: 8240786, offerCode: "tcut984t", categoria: "downsell_03", nota: "Círculo Interno, con descuento" },
];

export function clasificarVenta(productId: number, offerCode: string): CategoriaFunnel {
  const exacta = REGLAS.find((r) => r.productId === productId && r.offerCode === offerCode);
  if (exacta) return exacta.categoria;

  const porProducto = REGLAS.find((r) => r.productId === productId && !r.offerCode);
  if (porProducto) return porProducto.categoria;

  return "sin_clasificar";
}

export const ETIQUETAS_CATEGORIA: Record<CategoriaFunnel, string> = {
  front_end: "Front-end",
  upsell_01: "Upsell 01",
  downsell_01: "Downsell 01",
  upsell_02: "Upsell 02",
  downsell_02: "Downsell 02",
  upsell_03: "Upsell 03",
  downsell_03: "Downsell 03",
  miembros: "Área de miembros",
  sin_clasificar: "Sin clasificar",
};
