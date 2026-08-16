import { obtenerResumenDiario, CATEGORIAS } from "@/lib/resumen/diario";
import { ETIQUETAS_CATEGORIA } from "@/lib/hotmart/mapeoProductos";
import { inicioDiaLocalComoUTC, fechaLocalDesdeUTC } from "@/lib/tiempo/zonaHorariaHotmart";
import GraficoDiario from "@/components/GraficoDiario";

export const dynamic = "force-dynamic";

function formatoUsd(valor: number | null) {
  if (valor === null) return "—";
  return valor.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatoUsdPreciso(valor: number | null) {
  if (valor === null) return "—";
  return valor.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatoNumero(valor: number) {
  return valor.toLocaleString("en-US");
}

function formatoPct(valor: number | null) {
  if (valor === null) return "—";
  return `${valor.toFixed(2)}%`;
}

const CATEGORIAS_TABLA = CATEGORIAS.filter((c) => c !== "miembros" && c !== "sin_clasificar");

export default async function Home({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const params = await searchParams;
  const dias = Number(params.dias ?? "14");

  const hoyLocal = fechaLocalDesdeUTC(new Date().toISOString());
  const hastaMs = inicioDiaLocalComoUTC(hoyLocal) - 24 * 60 * 60 * 1000; // ayer local
  const desdeMs = hastaMs - (dias - 1) * 24 * 60 * 60 * 1000;
  const desde = fechaLocalDesdeUTC(new Date(desdeMs).toISOString());
  const hastaStr = fechaLocalDesdeUTC(new Date(hastaMs).toISOString());

  const resumen = await obtenerResumenDiario(desde, hastaStr);

  const totalInversion = resumen.reduce((acc, d) => acc + d.inversion, 0);
  const totalFacturacion = resumen.reduce((acc, d) => acc + d.facturacionTotal, 0);
  const totalFacturacionNueva = resumen.reduce((acc, d) => acc + d.facturacionNuevaTotal, 0);
  const roasTotal = totalInversion > 0 ? totalFacturacion / totalInversion : null;
  const roasNuevoTotal = totalInversion > 0 ? totalFacturacionNueva / totalInversion : null;
  const totalUsuariosUnicos = resumen.reduce((acc, d) => acc + d.usuariosUnicos, 0);
  const arpuTotal = totalUsuariosUnicos > 0 ? totalFacturacion / totalUsuariosUnicos : null;
  const totalFrontEnd = resumen.reduce((acc, d) => acc + d.porCategoria.front_end.conteo, 0);

  const cardStyle: React.CSSProperties = {
    background: "var(--surface-1)",
    borderRadius: "var(--radius)",
    padding: "1rem",
  };
  const labelStyle: React.CSSProperties = { fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 };
  const valueStyle: React.CSSProperties = { fontSize: 24, fontWeight: 500 };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Métricas Frecuencia Divina</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {[7, 14, 30, 90].map((n) => (
            <a
              key={n}
              href={`/?dias=${n}`}
              style={{
                fontSize: 13,
                padding: "4px 10px",
                borderRadius: "var(--radius)",
                border: `0.5px solid ${n === dias ? "var(--accent)" : "var(--border-strong)"}`,
                color: n === dias ? "var(--accent-text)" : "var(--text-secondary)",
                background: n === dias ? "var(--accent-bg)" : "transparent",
                textDecoration: "none",
              }}
            >
              {n}d
            </a>
          ))}
        </div>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0, marginBottom: 4 }}>
        {desde} a {hastaStr} (día vencido)
      </p>
      <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 0, marginBottom: 24, maxWidth: 640 }}>
        Los conteos por etapa incluyen renovaciones de suscripción (Acompañamiento) — igual que el reporte de
        Hotmart, cada cobro exitoso cuenta como una venta. Solo la facturación/ROAS &quot;nuevo&quot; excluye esas
        renovaciones, para juzgar si el gasto publicitario del día se pagó solo (una renovación no la generó el
        anuncio de hoy).
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Inversión total</div>
          <div style={valueStyle}>{formatoUsd(totalInversion)}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Facturación total</div>
          <div style={valueStyle}>{formatoUsd(totalFacturacion)}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>ROAS (solo ventas nuevas)</div>
          <div style={valueStyle}>{roasNuevoTotal !== null ? roasNuevoTotal.toFixed(2) : "—"}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>ROAS total (incl. renovaciones)</div>
          <div style={valueStyle}>{roasTotal !== null ? roasTotal.toFixed(2) : "—"}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>ARPU</div>
          <div style={valueStyle}>{formatoUsd(arpuTotal)}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Front-end (ventas)</div>
          <div style={valueStyle}>{formatoNumero(totalFrontEnd)}</div>
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <GraficoDiario datos={resumen.map((d) => ({ fecha: d.fecha, inversion: d.inversion, facturacion: d.facturacionNuevaTotal }))} />
      </div>

      <div style={{ overflowX: "auto", border: "0.5px solid var(--border)", borderRadius: "var(--radius)" }}>
        <table style={{ width: "100%", fontSize: 13, whiteSpace: "nowrap" }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)", background: "var(--surface-1)" }}>
              {[
                "Fecha",
                "Inversión",
                "Impresiones",
                "Clics",
                "CPC",
                "CTR",
                "CPM",
                "Visitas LP",
                "Costo/Visita",
                "Pagos iniciados",
                "Costo/Pago iniciado",
                ...CATEGORIAS_TABLA.map((c) => ETIQUETAS_CATEGORIA[c]),
                "Facturación nueva",
                "ROAS (nuevo)",
                "Facturación total",
                "ARPU",
                "ROAS total",
              ].map(
                (h) => (
                  <th key={h} style={{ textAlign: "right", padding: "8px 10px", color: "var(--text-secondary)", fontWeight: 500 }}>
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {[...resumen].reverse().map((dia) => (
              <tr key={dia.fecha} style={{ borderBottom: "0.5px solid var(--border)" }}>
                <td style={{ padding: "8px 10px", textAlign: "left", color: "var(--text-primary)" }}>{dia.fecha}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatoUsd(dia.inversion)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatoNumero(dia.impresiones)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatoNumero(dia.clics)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatoUsdPreciso(dia.cpc)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatoPct(dia.ctr)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatoUsdPreciso(dia.cpm)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatoNumero(dia.landingPageViews)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatoUsdPreciso(dia.costoPorVisita)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatoNumero(dia.pagosIniciados)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatoUsdPreciso(dia.costoPorPagoIniciado)}</td>
                {CATEGORIAS_TABLA.map((c) => (
                  <td key={c} style={{ padding: "8px 10px", textAlign: "right" }}>
                    {formatoNumero(dia.porCategoria[c].conteo)}
                  </td>
                ))}
                <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 500 }}>{formatoUsd(dia.facturacionNuevaTotal)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{dia.roasNuevo !== null ? dia.roasNuevo.toFixed(2) : "—"}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatoUsd(dia.facturacionTotal)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatoUsd(dia.arpu)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{dia.roas !== null ? dia.roas.toFixed(2) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
