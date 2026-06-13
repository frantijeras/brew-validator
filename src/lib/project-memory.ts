/**
 * ProjectMemory — JSON acumulativo de decisiones del proyecto.
 *
 * Regla de oro: "la última decisión prevalece".
 * Cada clave tiene fuente (qué fase la decidió) y timestamp.
 * Si el usuario hace override manual, gana SIEMPRE el usuario.
 */

export type MemorySource =
  | "00"
  | "01"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "user";

export interface MemoryEntry {
  value: unknown; // string | string[] | number | object
  source: MemorySource;
  updatedAt: string; // ISO timestamp
  rationale?: string; // por qué se decidió (opcional)
}

export interface ProjectMemory {
  target?: MemoryEntry;
  channels?: MemoryEntry;
  tone?: MemoryEntry;
  visual?: MemoryEntry;
  pricing?: MemoryEntry;
  businessModel?: MemoryEntry;
  competitors?: MemoryEntry;
  // Extensible: cualquier topic puede añadirse en runtime
  [topic: string]: MemoryEntry | undefined;
}

/**
 * Mergea un parcial de memoria respetando "último gana".
 * Solo sobreescribe si source es "user" O si updatedAt es más reciente.
 *
 * Reglas:
 *  1. source="user" siempre prevalece sobre cualquier otro source.
 *  2. Si ambas entradas son "user", gana la última (updatedAt más reciente).
 *  3. Si ninguna es "user", gana la de updatedAt más reciente.
 *  4. Si una entrada entrante es "user" y la actual también es "user",
 *     gana la más reciente por updatedAt.
 */
export function mergeProjectMemory(
  current: ProjectMemory,
  incoming: Partial<Record<string, MemoryEntry>>,
  source: MemorySource,
): ProjectMemory {
  const merged = { ...current };

  for (const [key, entry] of Object.entries(incoming)) {
    if (!entry) continue;

    const existing = merged[key];
    if (!existing) {
      // No hay entrada previa → añadir directamente
      merged[key] = entry;
      continue;
    }

    // source="user" siempre prevalece sobre cualquier otro source
    // a menos que existing ya sea "user" y sea más reciente
    if (source === "user") {
      if (existing.source !== "user") {
        // existing no es user → user gana
        merged[key] = entry;
      } else {
        // Ambos son user → gana el más reciente
        if (entry.updatedAt > existing.updatedAt) {
          merged[key] = entry;
        }
        // Si existing es más reciente, se mantiene
      }
    } else if (existing.source === "user") {
      // existing es user, incoming no → existing se mantiene
      // (user prevalece sobre cualquier fase)
    } else {
      // Ninguno es user → gana el más reciente
      if (entry.updatedAt > existing.updatedAt) {
        merged[key] = entry;
      }
      // Si existing es más reciente, se mantiene
    }
  }

  return merged;
}

/**
 * Obtiene el valor vigente de una clave, con fallback.
 * Si el memory no existe o la clave no está definida, retorna el fallback.
 */
export function getMemoryValue<T = unknown>(
  memory: ProjectMemory | null,
  key: string,
  fallback?: T,
): T | undefined {
  if (!memory) return fallback;
  const entry = memory[key];
  if (!entry || entry.value === undefined || entry.value === null) {
    return fallback;
  }
  return entry.value as T;
}

/**
 * Convierte un valor genérico a string legible para el banner.
 * Arrays se unen con coma, objetos se serializan en JSON resumido.
 */
export function formatMemoryValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Etiquetas humanas para las keys del memory.
 */
export const memoryKeyLabels: Record<string, string> = {
  target: "target",
  channels: "canales",
  tone: "tono",
  brandName: "nombre de marca",
  visual: "visual",
  pricing: "pricing",
  businessModel: "modelo de negocio",
  competitors: "competidores",
};
