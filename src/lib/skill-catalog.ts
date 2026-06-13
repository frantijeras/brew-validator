/**
 * Catálogo de skills del Hand-off.
 *
 * Conjunto FIJO de 8 skills (sin motor de recomendación: se activan todas).
 * Cada skill genera un documento markdown accionable en `skills/<id>.md` que
 * REFERENCIA los documentos de contexto del paquete (carpeta `contexto/`).
 */

export type SkillCategory =
  | "desarrollo"
  | "marketing"
  | "operaciones"
  | "legal"
  | "finanzas";

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  /** Nombre de icono Lucide (ver ICON_MAP en skill-selector). */
  icon: string;
  category: SkillCategory;
}

export const SKILL_CATALOG: SkillDefinition[] = [
  {
    id: "web-creator",
    name: "Landing Page",
    description:
      "Copy y estructura de una landing profesional, responsive y orientada a conversion.",
    icon: "Globe",
    category: "desarrollo",
  },
  {
    id: "contenido-redes",
    name: "Contenido y Redes",
    description:
      "Linea editorial y calendario para redes sociales segun los canales priorizados.",
    icon: "Share2",
    category: "marketing",
  },
  {
    id: "seo-aso",
    name: "SEO y ASO",
    description:
      "Posicionamiento organico en buscadores y tiendas de apps (keywords, on-page, ASO).",
    icon: "Search",
    category: "marketing",
  },
  {
    id: "email-marketing",
    name: "Email Marketing",
    description:
      "Secuencias de email (bienvenida, nurturing, reactivacion) con asuntos y CTAs.",
    icon: "Mail",
    category: "marketing",
  },
  {
    id: "analytics",
    name: "Analitica y KPIs",
    description: "KPIs clave, eventos a medir, dashboards y cadencia de reporte.",
    icon: "BarChart3",
    category: "operaciones",
  },
  {
    id: "ads-manager",
    name: "Ads y Paid Media",
    description:
      "Campanas de publicidad digital (Meta, Google, TikTok): segmentacion, presupuesto y creatividades.",
    icon: "Megaphone",
    category: "marketing",
  },
  {
    id: "finance-contabilidad",
    name: "Finanzas y Cashflow",
    description:
      "Facturacion, impuestos, cashflow y proyeccion de ingresos del negocio.",
    icon: "DollarSign",
    category: "finanzas",
  },
  {
    id: "project-handoff",
    name: "Guia para Agentes",
    description:
      "Como un agente externo debe leer y ejecutar el paquete (estructura de carpetas y orden de lectura).",
    icon: "Target",
    category: "desarrollo",
  },
];

/**
 * Metadatos de SALIDA por skill: qué genera, esquema de secciones y extensión.
 * Permite mostrar "Qué genera" antes de generar.
 */
export interface SkillOutputMeta {
  outputSummary: string;
  sections: string[];
  length: "corta" | "media" | "extensa";
}

export const SKILL_OUTPUT_META: Record<string, SkillOutputMeta> = {
  "web-creator": {
    outputSummary:
      "Copy y estructura de la landing (Hero, beneficios, prueba social, precios, FAQ, CTA), conectada al analisis y la identidad.",
    sections: ["Contexto e identidad", "Estructura de secciones", "Copy por seccion", "Stack tecnico sugerido"],
    length: "extensa",
  },
  "contenido-redes": {
    outputSummary:
      "Pilares de contenido + calendario de 30 dias por canal, con plantillas de copy.",
    sections: ["Pilares de contenido", "Calendario 30 dias", "Formatos por canal", "Metricas"],
    length: "extensa",
  },
  "seo-aso": {
    outputSummary: "Keywords, on-page (meta, H1, slugs), schema y optimizacion de tienda (ASO).",
    sections: ["Keywords", "On-page", "Schema.org", "ASO"],
    length: "media",
  },
  "email-marketing": {
    outputSummary: "Segmentos + secuencias (bienvenida, nurturing, reactivacion) con plantillas.",
    sections: ["Segmentos", "Secuencias", "Plantillas de email", "Metricas"],
    length: "media",
  },
  analytics: {
    outputSummary: "KPIs por objetivo, eventos a medir, dashboards y cadencia de reporte.",
    sections: ["KPIs por objetivo", "Eventos a medir", "Dashboards", "Cadencia de reporte"],
    length: "media",
  },
  "ads-manager": {
    outputSummary: "Plan de paid media: plataformas, segmentacion, presupuesto y creatividades.",
    sections: ["Plataformas", "Segmentacion", "Presupuesto y pujas", "Creatividades"],
    length: "media",
  },
  "finance-contabilidad": {
    outputSummary: "Facturacion, impuestos, cashflow y proyeccion de ingresos.",
    sections: ["Facturacion e impuestos", "Cashflow", "Proyeccion de ingresos", "Indicadores"],
    length: "media",
  },
  "project-handoff": {
    outputSummary:
      "Guia para que un agente externo lea y ejecute el paquete: estructura de carpetas y orden de lectura.",
    sections: ["Que es el proyecto", "Estructura del paquete", "Orden de lectura", "Como ejecutar cada skill"],
    length: "media",
  },
};

export function getSkillOutputMeta(id: string): SkillOutputMeta {
  return (
    SKILL_OUTPUT_META[id] ?? {
      outputSummary: "Documento de trabajo con el contexto del proyecto aplicado a esta skill.",
      sections: ["Contexto", "Objetivo", "Pasos / entregables"],
      length: "media",
    }
  );
}
