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
    name: "Web Creator",
    description: "Crea una landing page profesional con copy persuasivo, diseño responsive y llamada a la acción optimizada para conversión.",
    icon: "Globe",
    category: "desarrollo",
    conditions: [
      { type: "always" },
    ],
  },
  {
    id: "codebot-dev",
    name: "Desarrollo (CodeBot)",
    description: "Implementa el MVP técnico según stack y especificaciones de la Fase 05. Incluye SaaS (Software as a Service / Software como Servicio).",
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
    name: "Creador de Contenido",
    description: "Genera posts, artículos y contenido editorial según la estrategia de la Fase 04",
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
    name: "SEO / ASO",
    description: "Optimiza presencia orgánica en buscadores y tiendas de apps",
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
    description: "Diseña secuencias de email, newsletters y automatizaciones de captación",
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
    name: "Social Media Manager",
    description: "Gestiona presencia en redes sociales según canales de la Matriz Bullseye",
    icon: "Share2",
    category: "marketing",
    conditions: [
      {
        type: "has_channel_in_bullseye",
        channelKeywords: [
          "Instagram",
          "TikTok",
          "Twitter",
          "X",
          "LinkedIn",
          "Facebook",
          "YouTube",
          "social",
          "redes",
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
    name: "Analytics e Informes",
    description: "Configura dashboards, KPI (Key Performance Indicator / Indicador Clave de Rendimiento) y reportes periódicos de rendimiento",
    icon: "BarChart3",
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
    description: "Gestiona onboarding, retención y satisfacción de clientes",
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
    name: "Ads Manager",
    description: "Crea y optimiza campañas de publicidad digital (Meta, Google, TikTok)",
    icon: "Target",
    category: "marketing",
    conditions: [
      {
        type: "has_channel_in_bullseye",
        channelKeywords: [
          "ads",
          "paid",
          "anuncios",
          "Meta Ads",
          "Google Ads",
          "TikTok Ads",
          "publicidad",
        ],
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
    description: "Construye y modera una comunidad alrededor de tu marca o producto",
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
    description: "Crea un sistema de diseño completo basado en la identidad visual de la Fase 03",
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
    description: "Revisa requisitos legales, protección de datos y términos de servicio",
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
    name: "Finanzas y Contabilidad",
    description: "Gestiona facturación, impuestos, cashflow y proyecciones financieras. Incluye ROI (Return on Investment / Retorno de Inversión).",
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
