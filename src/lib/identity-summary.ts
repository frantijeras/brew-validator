import { parseLogoIndex } from "@/lib/identity-logo";

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

  const logoIdx = parseLogoIndex(logo?.choice);
  const visualVariant = (visual?.choice || visualChoice || "").toString().trim();

  const parts: string[] = [];
  parts.push(`# Identidad de Marca — ${projectName}`);
  parts.push("");
  parts.push(
    "Resumen de las decisiones de identidad tomadas en la Fase 3 (naming, voz y tono, logotipo y estilo visual). Los assets descargables (logos SVG, maqueta HTML y guía de estilo en PDF) están disponibles en la sub-fase 3d y en el hand-off."
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
    logoIdx != null
      ? `Propuesta elegida: **logotipo ${logoIdx}** (de 12 variantes SVG).`
      : "_(No elegido)_"
  );
  parts.push("");

  parts.push("## Estilo Visual");
  parts.push(
    visualVariant
      ? `Variante elegida: **${visualVariant}**. La maqueta HTML (con el logotipo incrustado) y la guía de estilo en PDF se generan en la sub-fase 3d.`
      : "_(No elegido)_"
  );
  parts.push("");

  return parts.join("\n");
}
