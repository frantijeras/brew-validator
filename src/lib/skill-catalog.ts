export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "desarrollo" | "marketing" | "operaciones" | "legal" | "finanzas";
  conditions: SkillCondition[];
}

export type SkillCondition =
  | { type: "phase_artifact_contains"; phaseType: string; keywords: string[] }
  | { type: "business_model_is"; values: string[] }
  | { type: "has_channel_in_bullseye"; channelKeywords: string[] }
  | { type: "memory_key_contains"; key: string; values: string[] }
  | { type: "quiz_answer_matches"; phaseType: string; questionId: string; values: string[] }
  | { type: "always" };

/**
 * GLOSARIO DE TÉRMINOS (usar siempre en descriptions con la explicación entre paréntesis):
 * - TAM: Total Addressable Market (Mercado Total Direccionable)
 * - SAM: Serviceable Addressable Market (Mercado Servible Direccionable)
 * - SOM: Serviceable Obtainable Market (Mercado Obtenible)
 * - CAC: Coste de Adquisición de Cliente
 * - LTV: Lifetime Value (Valor de Vida del Cliente)
 * - ROI: Return on Investment (Retorno de Inversión)
 * - KPI: Key Performance Indicator (Indicador Clave de Rendimiento)
 * - OKR: Objectives and Key Results (Objetivos y Resultados Clave)
 * - B2B: Business to Business
 * - B2C: Business to Consumer
 * - SaaS: Software as a Service (Software como Servicio)
 * - ARR: Annual Recurring Revenue (Ingresos Recurrentes Anuales)
 * - MRR: Monthly Recurring Revenue (Ingresos Recurrentes Mensuales)
 * - Churn: Tasa de cancelación de clientes
 * - Upsell: Venta adicional de productos/servicios premium
 * - CTR: Click-Through Rate (Tasa de Clics)
 * - CPC: Cost Per Click (Coste por Clic)
 * - CPA: Cost Per Action (Coste por Acción)
 * - ROAS: Return on Ad Spend (Retorno sobre Inversión Publicitaria)
 * - UGC: User-Generated Content (Contenido Generado por el Usuario)
 * - MQL: Marketing Qualified Lead (Lead Calificado por Marketing)
 * - SQL: Sales Qualified Lead (Lead Calificado por Ventas)
 * - CRO: Conversion Rate Optimization (Optimización de Tasa de Conversión)
 */

export const SKILL_CATALOG: SkillDefinition[] = [
  {
    id: "web-creator",
    name: "Landing Page",
    description: "Crea una landing page profesional con copy persuasivo, diseño responsive y CTA optimizada para conversión.",
    icon: "Globe",
    category: "desarrollo",
    conditions: [
      { type: "always" },
    ],
  },
  {
    id: "codebot-dev",
    name: "MVP Técnico",
    description: "Implementa el producto mínimo viable: stack técnico, arquitectura, base de código y despliegue.",
    icon: "Code",
    category: "desarrollo",
    conditions: [
      {
        type: "business_model_is",
        values: ["SaaS", "App móvil", "Plataforma", "Marketplace", "API/Infra", "E-commerce"],
      },
    ],
  },
  {
    id: "contenido-publicaciones",
    name: "Contenido Editorial",
    description: "Genera posts, artículos y contenido editorial según la estrategia de distribución.",
    icon: "PenLine",
    category: "marketing",
    conditions: [
      {
        type: "phase_artifact_contains",
        phaseType: "CONTENT",
        keywords: ["contenido", "posts", "artículos", "editorial", "newsletter"],
      },
    ],
  },
  {
    id: "seo-aso",
    name: "SEO & ASO",
    description: "Estrategia de posicionamiento orgánico en buscadores y tiendas de apps.",
    icon: "Search",
    category: "marketing",
    conditions: [
      {
        type: "phase_artifact_contains",
        phaseType: "CONTENT",
        keywords: ["SEO", "orgánico", "buscador", "ASO", "palabras clave"],
      },
      {
        type: "has_channel_in_bullseye",
        channelKeywords: ["SEO", "orgánico", "blog", "contenido", "Google"],
      },
    ],
  },
  {
    id: "email-marketing",
    name: "Email Marketing",
    description: "Secuencias de email, newsletters y automatizaciones de captación y nurturing.",
    icon: "Mail",
    category: "marketing",
    conditions: [
      {
        type: "phase_artifact_contains",
        phaseType: "CONTENT",
        keywords: ["email", "newsletter", "correo", "mail"],
      },
      {
        type: "quiz_answer_matches",
        phaseType: "BUSINESS",
        questionId: "segmento_primario",
        values: ["B2B"],
      },
      {
        type: "business_model_is",
        values: ["SaaS", "Marketplace", "Servicios"],
      },
    ],
  },
  {
    id: "social-media",
    name: "Social Media",
    description: "Estrategia y calendario editorial para redes sociales según canales priorizados.",
    icon: "Share2",
    category: "marketing",
    conditions: [
      {
        type: "has_channel_in_bullseye",
        channelKeywords: [
          "Instagram", "TikTok", "Twitter", "X", "LinkedIn", "Facebook", "YouTube", "social", "redes",
        ],
      },
      {
        type: "phase_artifact_contains",
        phaseType: "CONTENT",
        keywords: ["redes sociales", "social media", "Instagram", "TikTok"],
      },
    ],
  },
  {
    id: "analytics",
    name: "Analytics & KPIs",
    description: "Dashboards, métricas clave y reportes periódicos de rendimiento.",
    icon: "LineChart",
    category: "operaciones",
    conditions: [
      {
        type: "phase_artifact_contains",
        phaseType: "BUSINESS",
        keywords: ["métrica", "KPI", "dashboard", "analytics", "métrica clave"],
      },
      {
        type: "phase_artifact_contains",
        phaseType: "EXECUTION",
        keywords: ["métrica", "KPI", "medir", "objetivo"],
      },
    ],
  },
  {
    id: "customer-success",
    name: "Customer Success",
    description: "Onboarding, retención y satisfacción de clientes con playbooks y automatizaciones.",
    icon: "HeartHandshake",
    category: "operaciones",
    conditions: [
      {
        type: "business_model_is",
        values: ["SaaS", "Marketplace"],
      },
      {
        type: "quiz_answer_matches",
        phaseType: "BUSINESS",
        questionId: "modelo_ingresos",
        values: ["Suscripción"],
      },
    ],
  },
  {
    id: "ads-manager",
    name: "Ads & Paid Media",
    description: "Campañas de publicidad digital en Meta, Google y TikTok con presupuestos y creativos.",
    icon: "Target",
    category: "marketing",
    conditions: [
      {
        type: "has_channel_in_bullseye",
        channelKeywords: ["ads", "paid", "anuncios", "Meta Ads", "Google Ads", "TikTok Ads", "publicidad"],
      },
      {
        type: "quiz_answer_matches",
        phaseType: "CONTENT",
        questionId: "prioridad_canales",
        values: ["Paid-first", "3-4 canales simultáneos"],
      },
    ],
  },
  {
    id: "community-manager",
    name: "Community Manager",
    description: "Construye y modera una comunidad alrededor de tu marca en Discord, Telegram, etc.",
    icon: "Users",
    category: "marketing",
    conditions: [
      {
        type: "phase_artifact_contains",
        phaseType: "CONTENT",
        keywords: ["comunidad", "community", "engagement", "interacción"],
      },
      {
        type: "has_channel_in_bullseye",
        channelKeywords: ["comunidad", "Discord", "Telegram", "Slack", "foro"],
      },
    ],
  },
  {
    id: "design-system",
    name: "Design System",
    description: "Sistema de diseño completo basado en la identidad visual: tokens, componentes y guías.",
    icon: "Palette",
    category: "desarrollo",
    conditions: [
      {
        type: "phase_artifact_contains",
        phaseType: "IDENTITY",
        keywords: ["paleta", "tipografía", "color", "visual", "brand"],
      },
      {
        type: "business_model_is",
        values: ["SaaS", "Plataforma", "App móvil", "Marketplace"],
      },
    ],
  },
  {
    id: "legal-compliance",
    name: "Legal & Compliance",
    description: "Revisa requisitos legales, protección de datos RGPD y términos de servicio.",
    icon: "Scale",
    category: "legal",
    conditions: [
      {
        type: "phase_artifact_contains",
        phaseType: "ANALYSIS",
        keywords: ["regulación", "legal", "compliance", "GDPR", "normativa", "ley"],
      },
      {
        type: "quiz_answer_matches",
        phaseType: "BUSINESS",
        questionId: "segmento_primario",
        values: ["B2B"],
      },
    ],
  },
  {
    id: "finance-contabilidad",
    name: "Finanzas & Cashflow",
    description: "Facturación, impuestos, cashflow, proyecciones financieras y modelo de ingresos.",
    icon: "DollarSign",
    category: "finanzas",
    conditions: [
      {
        type: "phase_artifact_contains",
        phaseType: "BUSINESS",
        keywords: ["ingresos", "coste", "margen", "cashflow", "burn rate"],
      },
      {
        type: "memory_key_contains",
        key: "monetization",
        values: ["Suscripción", "Marketplace", "Enterprise"],
      },
    ],
  },
];

/**
 * Metadatos de SALIDA por skill: qué documento markdown genera, su esquema de
 * secciones y su extensión aproximada. Sirven para que el usuario sepa, ANTES
 * de generar, qué va a obtener y cómo de extenso es ("Qué genera").
 */
export interface SkillOutputMeta {
  /** Resumen 1-2 líneas de lo que produce el .md de la skill. */
  outputSummary: string;
  /** Esquema de secciones del documento generado. */
  sections: string[];
  length: "corta" | "media" | "extensa";
}

export const SKILL_OUTPUT_META: Record<string, SkillOutputMeta> = {
  "web-creator": {
    outputSummary: "Guía + copy para una landing page lista para construir (Hero, beneficios, prueba social, precios, FAQ, CTA).",
    sections: ["Contexto e identidad", "Estructura de secciones", "Copy por sección", "Stack técnico sugerido"],
    length: "extensa",
  },
  "codebot-dev": {
    outputSummary: "Plan técnico del MVP: stack, arquitectura, modelo de datos y pasos de implementación.",
    sections: ["Stack y arquitectura", "Modelo de datos", "Roadmap técnico", "Despliegue"],
    length: "extensa",
  },
  "contenido-publicaciones": {
    outputSummary: "Línea editorial y plantillas de posts/artículos según la estrategia de distribución.",
    sections: ["Pilares de contenido", "Formatos", "Plantillas de copy", "Calendario base"],
    length: "media",
  },
  "seo-aso": {
    outputSummary: "Estrategia de posicionamiento orgánico: keywords, on-page, schema y ASO de tiendas.",
    sections: ["Keywords", "On-page (meta, H1, slugs)", "Schema.org", "ASO"],
    length: "media",
  },
  "email-marketing": {
    outputSummary: "Secuencias de email (bienvenida, nurturing, reactivación) con asuntos y CTAs.",
    sections: ["Segmentos", "Secuencias", "Plantillas de email", "Métricas"],
    length: "media",
  },
  "social-media": {
    outputSummary: "Estrategia y calendario editorial de 30 días para los canales priorizados.",
    sections: ["Objetivos y canales", "Calendario 30 días", "Formatos por canal", "Métricas"],
    length: "extensa",
  },
  analytics: {
    outputSummary: "Plan de medición: KPIs clave, dashboards y cadencia de reporte.",
    sections: ["KPIs por objetivo", "Eventos a medir", "Dashboards", "Cadencia de reporte"],
    length: "media",
  },
  "customer-success": {
    outputSummary: "Playbooks de onboarding, retención y satisfacción de clientes.",
    sections: ["Onboarding", "Retención", "Soporte", "Métricas (churn, NPS)"],
    length: "media",
  },
  "ads-manager": {
    outputSummary: "Plan de paid media: campañas, segmentación, presupuestos y creatividades.",
    sections: ["Plataformas", "Segmentación", "Presupuesto y pujas", "Creatividades"],
    length: "media",
  },
  "community-manager": {
    outputSummary: "Plan para construir y moderar comunidad (Discord/Telegram): normas, roles y dinamización.",
    sections: ["Plataforma y estructura", "Normas y roles", "Dinamización", "Métricas"],
    length: "corta",
  },
  "design-system": {
    outputSummary: "Sistema de diseño desde la identidad: tokens, componentes y guías de uso.",
    sections: ["Tokens (color, tipografía)", "Componentes", "Guías de uso"],
    length: "media",
  },
  "legal-compliance": {
    outputSummary: "Checklist legal: requisitos, protección de datos (RGPD) y textos base.",
    sections: ["Requisitos legales", "RGPD / privacidad", "Términos y condiciones", "Checklist"],
    length: "media",
  },
  "finance-contabilidad": {
    outputSummary: "Guía de facturación, impuestos, cashflow y proyección de ingresos.",
    sections: ["Facturación e impuestos", "Cashflow", "Proyección de ingresos", "Indicadores"],
    length: "media",
  },
  "project-handoff": {
    outputSummary: "Meta-skill: contexto completo del proyecto para que cualquier agente IA continúe el trabajo.",
    sections: ["Idea y decisiones", "Fases completadas", "Cómo usar el paquete"],
    length: "media",
  },
};

/** Metadatos de salida de una skill (con fallback genérico). */
export function getSkillOutputMeta(id: string): SkillOutputMeta {
  return (
    SKILL_OUTPUT_META[id] ?? {
      outputSummary: "Documento de trabajo con el contexto del proyecto aplicado a esta skill.",
      sections: ["Contexto", "Objetivo", "Pasos / entregables"],
      length: "media",
    }
  );
}
