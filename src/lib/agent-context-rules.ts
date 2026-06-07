/**
 * Genera las reglas de contexto acumulativo que se añaden al prompt del agente.
 * Basadas en el Project.memory con la regla "última prevalece".
 */

import type { ProjectMemory, MemoryEntry } from "@/lib/project-memory";

export function buildAgentContextRules(
  projectMemory: ProjectMemory | null,
): string {
  if (!projectMemory || Object.keys(projectMemory).length === 0) {
    return [
      "## Nota",
      "No hay decisiones previas. Esta es la primera fase del proyecto.",
      "",
      "Pregunta todo lo que necesites saber.",
    ].join("\n");
  }

  const rules: string[] = [];

  // Lista de lo que YA está decidido
  rules.push("## Decisiones previas del proyecto (NO PREGUNTES ESTO)");
  rules.push("");
  rules.push(
    "Las siguientes decisiones YA han sido tomadas en fases anteriores.",
  );
  rules.push(
    "**NO preguntes NUNCA sobre estos temas.** En su lugar, usa estos valores",
  );
  rules.push("como base para tus propuestas.");
  rules.push("");

  for (const [topic, entry] of Object.entries(projectMemory)) {
    const mem = entry as MemoryEntry | undefined;
    if (!mem || !("value" in mem)) {
      continue;
    }

    const valueStr =
      typeof mem.value === "string" ? mem.value : JSON.stringify(mem.value);
    rules.push(
      `- **${topic}**: ${valueStr} (decidido en fase ${mem.source})`,
    );
    if (mem.rationale) {
      rules.push(`  - Por qué: ${mem.rationale}`);
    }
  }

  rules.push("");
  rules.push("### Reglas de consistencia");
  rules.push(
    "- Si una decisión previa entra en conflicto con una nueva observación,",
  );
  rules.push("  propón actualizarla (no la ignores).");
  rules.push(
    "- Todas tus propuestas DEBEN ser coherentes con las decisiones previas.",
  );
  rules.push(
    "- Si no hay suficiente información en las decisiones previas para un tema",
  );
  rules.push(
    "  concreto, pregunta SOLO sobre ese tema. No preguntes lo que ya sabes.",
  );

  return rules.join("\n");
}
