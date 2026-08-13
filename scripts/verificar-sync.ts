import { crearClienteSupabaseAdmin } from "../lib/supabase/admin.ts";
import { clasificarVenta } from "../lib/hotmart/mapeoProductos.ts";

const supabase = crearClienteSupabaseAdmin();

const { data, error, count } = await supabase
  .from("hotmart_ventas")
  .select("product_id, offer_code, status, price_value, price_currency, fecha_venta", { count: "exact" });

if (error) throw error;

console.log("Total filas en hotmart_ventas:", count);

const porCategoria = new Map<string, { count: number; statuses: Set<string> }>();
for (const fila of data ?? []) {
  const categoria = clasificarVenta(fila.product_id, fila.offer_code);
  if (!porCategoria.has(categoria)) porCategoria.set(categoria, { count: 0, statuses: new Set() });
  const entry = porCategoria.get(categoria)!;
  entry.count++;
  entry.statuses.add(fila.status);
}

console.log("\nDesglose por categoria del embudo:");
for (const [categoria, val] of [...porCategoria.entries()].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`  ${categoria}: ${val.count} ventas, statuses: ${[...val.statuses].join(", ")}`);
}
