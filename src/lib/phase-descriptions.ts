/**
 * Descripciones canónicas de cada fase del proyecto, por tipo (PhaseType).
 *
 * FUENTE ÚNICA: se usa al CREAR el proyecto (para guardar en BDD) y al RENDERIZAR
 * en la interfaz. Renderizar desde aquí (en vez del valor guardado en BDD)
 * garantiza que proyectos antiguos y nuevos muestren siempre el texto actual,
 * sin necesidad de migrar la base de datos.
 */
export const PHASE_DESCRIPTIONS: Record<string, string> = {
  ANALYSIS:
    "Investigamos tu mercado y tu competencia para validar la oportunidad antes de invertir. Incluye análisis DAFO (Debilidades, Amenazas, Fortalezas y Oportunidades), 5 Fuerzas de Porter, estimación de TAM/SAM/SOM (mercado total, disponible y obtenible), Lean Canvas, segmentos de cliente con Buyer Persona y tu propuesta de valor única.",
  BUSINESS:
    "Comprobamos si el negocio es rentable y sostenible. Define el modelo de ingresos, la estrategia de pricing (estructura y niveles de precio), un simulador financiero basado en Unit Economics (métricas financieras unitarias), la proyección LTV/CAC (valor de vida del cliente frente a coste de adquisición) y un análisis de viabilidad en 3 escenarios: pesimista, realista y optimista.",
  IDENTITY:
    "Construimos la identidad completa de tu marca paso a paso: naming (con verificación de dominios en tiempo real), voz y tono basados en los 12 Arquetipos de Jung, estilo visual (paletas de color HEX, tipografías y mockups en HTML) y un brand book final descargable.",
  CONTENT:
    "Trazamos cómo llegar a tus clientes y conseguir tracción. Incluye la Matriz Bullseye para priorizar canales, la selección de canales prioritarios, los pilares de contenido, un calendario editorial y un plan de lanzamiento táctico.",
  EXECUTION:
    "Convertimos todo lo anterior en un plan de acción concreto: una hoja de ruta detallada y OKRs (objetivos y resultados clave) para los primeros 30, 60 y 90 días, con prioridades claras para empezar a ejecutar.",
};

/** Descripción de una fase por su tipo, con fallback al texto guardado. */
export function phaseDescription(type: string, fallback?: string | null): string {
  return PHASE_DESCRIPTIONS[type] ?? fallback ?? "";
}
