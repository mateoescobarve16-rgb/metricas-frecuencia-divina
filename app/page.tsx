import { obtenerResumenDiario, CATEGORIAS, restarDias, type ResumenDia } from "@/lib/resumen/diario";
import { ETIQUETAS_CATEGORIA, type CategoriaFunnel } from "@/lib/hotmart/mapeoProductos";
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

function sumar(resumen: ResumenDia[], campo: (d: ResumenDia) => number) {
  return resumen.reduce((acc, d) => acc + campo(d), 0);
}

function tendencia(actual: number, anterior: number): { texto: string; color: string; bg: string } {
  if (anterior <= 0) return { texto: "—", color: "var(--text-muted)", bg: "transparent" };
  const cambio = ((actual - anterior) / anterior) * 100;
  if (Math.abs(cambio) < 0.5) return { texto: "≈ igual", color: "var(--text-muted)", bg: "transparent" };
  const positivo = cambio > 0;
  return {
    texto: `${positivo ? "▲" : "▼"} ${Math.abs(cambio).toFixed(0)}%`,
    color: positivo ? "var(--positive-text)" : "var(--negative-text)",
    bg: positivo ? "var(--positive-bg)" : "var(--negative-bg)",
  };
}

const CATEGORIAS_EMBUDO = CATEGORIAS.filter((c) => c !== "miembros" && c !== "sin_clasificar");

export default async function Home({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const params = await searchParams;
  const dias = Number(params.dias ?? "14");

  const hoyLocal = fechaLocalDesdeUTC(new Date().toISOString());
  const hastaMs = inicioDiaLocalComoUTC(hoyLocal) - 24 * 60 * 60 * 1000; // ayer local
  const desdeMs = hastaMs - (dias - 1) * 24 * 60 * 60 * 1000;
  const desde = fechaLocalDesdeUTC(new Date(desdeMs).toISOString());
  const hastaStr = fechaLocalDesdeUTC(new Date(hastaMs).toISOString());

  const desdeAnterior = restarDias(desde, dias);
  const hastaAnterior = restarDias(desde, 1);

  const [resumen, resumenAnterior] = await Promise.all([
    obtenerResumenDiario(desde, hastaStr),
    obtenerResumenDiario(desdeAnterior, hastaAnterior),
  ]);

  const totalInversion = sumar(resumen, (d) => d.inversion);
  const totalFacturacion = sumar(resumen, (d) => d.facturacionTotal);
  const totalFacturacionNueva = sumar(resumen, (d) => d.facturacionNuevaTotal);
  const roasNuevoTotal = totalInversion > 0 ? totalFacturacionNueva / totalInversion : null;
  const roasTotal = totalInversion > 0 ? totalFacturacion / totalInversion : null;
  const totalUsuariosUnicos = sumar(resumen, (d) => d.usuariosUnicos);
  const arpuTotal = totalUsuariosUnicos > 0 ? totalFacturacion / totalUsuariosUnicos : null;
  const totalFrontEnd = sumar(resumen, (d) => d.porCategoria.front_end.conteo);
  const totalPagosIniciados = sumar(resumen, (d) => d.pagosIniciados);
  const costoPorPagoIniciadoTotal = totalPagosIniciados > 0 ? totalInversion / totalPagosIniciados : null;

  const invAnterior = sumar(resumenAnterior, (d) => d.inversion);
  const factAnterior = sumar(resumenAnterior, (d) => d.facturacionTotal);
  const factNuevaAnterior = sumar(resumenAnterior, (d) => d.facturacionNuevaTotal);
  const roasNuevoAnterior = invAnterior > 0 ? factNuevaAnterior / invAnterior : 0;
  const usuariosAnterior = sumar(resumenAnterior, (d) => d.usuariosUnicos);
  const arpuAnterior = usuariosAnterior > 0 ? factAnterior / usuariosAnterior : 0;
  const frontEndAnterior = sumar(resumenAnterior, (d) => d.porCategoria.front_end.conteo);
  const pagosAnterior = sumar(resumenAnterior, (d) => d.pagosIniciados);
  const costoPorPagoAnterior = pagosAnterior > 0 ? invAnterior / pagosAnterior : 0;

  const diasConDiscrepancia = resumen.filter((d) => d.verificacion.estado === "discrepancia");
  const diasVerificados = resumen.filter((d) => d.verificacion.estado === "ok");
  const diasSinDatos = resumen.filter((d) => d.verificacion.estado === "sin_datos");
  const diasConAnomaliaMeta = resumen.filter((d) => d.verificacionMeta.estado === "anomalia");

  const conteoPorCategoria: Record<CategoriaFunnel, number> = Object.fromEntries(
    CATEGORIAS.map((c) => [c, sumar(resumen, (d) => d.porCategoria[c].conteo)])
  ) as Record<CategoriaFunnel, number>;

  const kpis = [
    { label: "Inversión", valor: formatoUsd(totalInversion), tend: tendencia(totalInversion, invAnterior) },
    { label: "Facturación", valor: formatoUsd(totalFacturacion), tend: tendencia(totalFacturacion, factAnterior) },
    { label: "ROAS (nuevo)", valor: roasNuevoTotal !== null ? roasNuevoTotal.toFixed(2) : "—", tend: tendencia(roasNuevoTotal ?? 0, roasNuevoAnterior) },
    { label: "ARPU", valor: formatoUsd(arpuTotal), tend: tendencia(arpuTotal ?? 0, arpuAnterior) },
    { label: "Front-end", valor: formatoNumero(totalFrontEnd), tend: tendencia(totalFrontEnd, frontEndAnterior) },
    { label: "Costo/Pago iniciado", valor: formatoUsdPreciso(costoPorPagoIniciadoTotal), tend: tendencia(costoPorPagoAnterior, costoPorPagoIniciadoTotal ?? 0) },
  ];

  const cardStyle: React.CSSProperties = {
    background: "var(--surface-1)",
    border: "0.5px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "1.1rem",
  };
  const labelStyle: React.CSSProperties = { fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" };
  const valueStyle: React.CSSProperties = { fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em" };

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Métricas Frecuencia Divina</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {[7, 14, 30, 90].map((n) => (
            <a
              key={n}
              href={`/?dias=${n}`}
              style={{
                fontSize: 13,
                padding: "5px 12px",
                borderRadius: "var(--radius)",
                border: `0.5px solid ${n === dias ? "var(--accent)" : "var(--border-strong)"}`,
                color: n === dias ? "var(--accent-text)" : "var(--text-secondary)",
                background: n === dias ? "var(--accent-bg)" : "var(--surface-1)",
                textDecoration: "none",
              }}
            >
              {n}d
            </a>
          ))}
        </div>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0, marginBottom: 4 }}>
        {desde} a {hastaStr} (día vencido) · vs. {desdeAnterior} a {hastaAnterior}
      </p>
      <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 0, marginBottom: 20, maxWidth: 680 }}>
        Los conteos por etapa incluyen renovaciones de suscripción (Acompañamiento) — igual que Hotmart. Solo la
        facturación/ROAS &quot;nuevo&quot; excluye renovaciones, para juzgar si el gasto del día se pagó solo.
      </p>

      {diasConDiscrepancia.length > 0 ? (
        <div style={{ background: "var(--negative-bg)", color: "var(--negative-text)", border: "0.5px solid var(--negative)", borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          ⚠ {diasConDiscrepancia.length} día(s) no coinciden con los números oficiales de Hotmart, revisar:{" "}
          {diasConDiscrepancia.map((d) => d.fecha).join(", ")}
        </div>
      ) : (
        <div style={{ background: "var(--positive-bg)", color: "var(--positive-text)", border: "0.5px solid var(--positive)", borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          ✓ Verificado automáticamente contra Hotmart — {diasVerificados.length} de {resumen.length} días coinciden exacto.
          {diasSinDatos.length > 0 ? ` ${diasSinDatos.length} día(s) sin dato oficial todavía.` : ""}
        </div>
      )}

      {diasConAnomaliaMeta.length > 0 && (
        <div style={{ background: "var(--negative-bg)", color: "var(--negative-text)", border: "0.5px solid var(--negative)", borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13, marginBottom: 24 }}>
          ⚠ Posible falla en la sincronización de Meta — la inversión cayó de golpe respecto al promedio de los 7 días anteriores en: {diasConAnomaliaMeta.map((d) => d.fecha).join(", ")}.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: diasConAnomaliaMeta.length > 0 ? 0 : 12, marginBottom: 32 }}>
        {kpis.map((k) => (
          <div key={k.label} style={cardStyle}>
            <div style={labelStyle}>{k.label}</div>
            <div style={valueStyle}>{k.valor}</div>
            <div style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 500, color: k.tend.color, background: k.tend.bg, padding: k.tend.bg !== "transparent" ? "2px 8px" : 0, borderRadius: 999 }}>
              {k.tend.texto}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 500, color: "var(--text-secondary)", margin: "0 0 12px" }}>Embudo</h2>
      <div style={{ overflowX: "auto", marginBottom: 32 }}>
        <div style={{ display: "flex", gap: 12, minWidth: "max-content", paddingBottom: 4 }}>
          {CATEGORIAS_EMBUDO.map((c) => {
            const conteo = conteoPorCategoria[c];
            const convPct = totalFrontEnd > 0 ? (conteo / totalFrontEnd) * 100 : null;
            const cpa = conteo > 0 ? totalInversion / conteo : null;
            const esUpsell = c.startsWith("upsell");
            return (
              <div key={c} style={{ ...cardStyle, minWidth: 150, borderTop: `2px solid ${esUpsell ? "var(--positive)" : c === "front_end" ? "var(--accent)" : "var(--warning)"}` }}>
                <div style={labelStyle}>{ETIQUETAS_CATEGORIA[c]}</div>
                <div style={valueStyle}>{formatoNumero(conteo)}</div>
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 2 }}>
                  <span>% conv.: {formatoPct(convPct)}</span>
                  <span>CPA: {formatoUsdPreciso(cpa)}</span>
                </div>
              </div>
            );
          })}
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
                ...CATEGORIAS_EMBUDO.map((c) => ETIQUETAS_CATEGORIA[c]),
                "Facturación nueva",
                "ROAS (nuevo)",
                "Facturación total",
                "ARPU",
                "ROAS total",
              ].map((h) => (
                <th key={h} style={{ textAlign: "right", padding: "8px 10px", color: "var(--text-secondary)", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
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
                {CATEGORIAS_EMBUDO.map((c) => (
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
