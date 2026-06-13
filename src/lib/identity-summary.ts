import { parseVisualArtifactContent, getVisualOption } from "@/lib/identity-visual";

/**
 * Resumen de identidad de marca para el artefacto de cierre de la Fase 3.
 *
 * Antes, el cierre de IDENTITY generaba un "Brand Book" consolidado. Ese paso
 * se eliminó: ahora la fase se cierra al elegir el estilo visual (3d). Para que
 * la tarjeta de fase completada tenga un "Ver"/"Descargar" útil y para el
 * hand-off, generamos un resumen markdown a partir de `subStepHistory`
 * (nombre, voz y tono, logo elegido, estilo visual elegido).
 *
 * Es deliberadamente tolerante: cada sub-paso puede faltar (proyectos antiguos
 * o flujos parciales) y se omite con un texto neutro.
 */

interface HistoryEntry {
  subStep?: string;
  label?: string;
  choice?: string;
  artifact?: { type?: string; content?: string } | null;
}

function getEntry(history: unknown, id: string): HistoryEntry | null {
  if (!history || typeof history !== "object") return null;
  const e = (history as Record<string, unknown>)[id];
  return e && typeof e === "object" ? (e as HistoryEntry) : null;
}

/** Primeras `n` líneas no vacías de un texto markdown (resumen compacto). */
function firstLines(text: string | undefined | null, n: number): string {
  if (!text) return "";
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .slice(0, n)
    .join("\n");
}

export function buildIdentitySummaryMarkdown(params: {
  projectName: string;
  /** `ProjectPhase.subStepHistory` (JSON tolerante). */
  subStepHistory: unknown;
  /** Variante visual elegida ("A"/"B"/"C"), normalmente la última choice. */
  visualChoice?: string | null;
}): string {
  const { projectName, subStepHistory, visualChoice } = params;

  const naming = getEntry(subStepHistory, "naming");
  const voice = getEntry(subStepHistory, "voice");
  const logo = getEntry(subStepHistory, "logo");
  const visual = getEntry(subStepHistory, "visual");

  const hasLogo = !!(logo?.choice || logo?.artifact?.content);
  const visualVariant = (visual?.choice || visualChoice || "").toString().trim();

  // Atributos finales del estilo visual (paleta, tipografías, tono) extraídos de
  // la opción elegida. El handoff describe la identidad por sus atributos, NO
  // por la letra de variante ni el proceso de selección.
  const visualMeta = visual?.artifact?.content
    ? getVisualOption(parseVisualArtifactContent(visual.artifact.content), visualVariant || "A")?.meta ?? null
    : null;

  const parts: string[] = [];
  parts.push(`# Identidad de Marca — ${projectName}`);
  parts.push("");
  parts.push(
    "Identidad final de la marca: nombre, voz y tono, logotipo y sistema visual. Los assets están en `assets/` (logotipo `logo.svg`, template de componentes `template.html` y guía de estilo en PDF)."
  );
  parts.push("");

  parts.push("## Nombre");
  parts.push(naming?.choice ? `**${naming.choice}**` : projectName);
  parts.push("");

  parts.push("## Voz y Tono");
  parts.push(
    voice?.artifact?.content
      ? firstLines(voice.artifact.content, 12)
      : "_(No documentado)_"
  );
  parts.push("");

  parts.push("## Logotipo");
  parts.push(
    hasLogo
      ? "El logotipo de la marca en formato vectorial (`assets/logo.svg`, 1:1), ya incrustado en el template de componentes."
      : "_(No definido)_"
  );
  parts.push("");

  parts.push("## Sistema Visual");
  if (visualMeta) {
    if (visualMeta.mood) parts.push(`**Tono visual:** ${visualMeta.mood}`);
    const colors = [
      visualMeta.primaryColor ? `primario \`${visualMeta.primaryColor}\`` : null,
      visualMeta.secondaryColor ? `secundario \`${visualMeta.secondaryColor}\`` : null,
    ].filter(Boolean);
    if (colors.length) parts.push(`**Paleta:** ${colors.join(", ")}.`);
    const fonts = [
      visualMeta.fontHeading ? `titulares ${visualMeta.fontHeading}` : null,
      visualMeta.fontBody ? `cuerpo ${visualMeta.fontBody}` : null,
    ].filter(Boolean);
    if (fonts.length) parts.push(`**Tipografías:** ${fonts.join(", ")}.`);
    parts.push("");
    parts.push("Detalle completo en la guía de estilo (`assets/guia-estilos.pdf`) y el template (`assets/template.html`).");
  } else {
    parts.push("_(No definido)_");
  }
  parts.push("");

  return parts.join("\n");
}
