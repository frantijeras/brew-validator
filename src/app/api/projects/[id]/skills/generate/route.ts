import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import type { ProjectMemory } from "@/lib/project-memory";
import type { GeneratedSkill } from "@/lib/skill-types";
import { buildProjectContext, type ProjectContext } from "@/lib/skill-context";
import { SKILL_CATALOG, getSkillOutputMeta } from "@/lib/skill-catalog";

const generateSkillsSchema = z.object({
  // Array vacío = "saltar": no genera nada, solo desbloquea el hand-off.
  skillIds: z.array(z.string()),
  // all → reemplaza; merge → upsert sólo skillIds; remove → quita skillIds.
  mode: z.enum(["all", "merge", "remove"]).default("all"),
});

/* ── Documentos de contexto del paquete (carpeta contexto/) ──────────── */
// Cada skill REFERENCIA los documentos relevantes del paquete por su ruta
// relativa (las skills viven en `skills/`, el contexto en `contexto/`).
const CONTEXT_DOCS = {
  ANALYSIS: "../contexto/1.analisis-de-mercado.md",
  BUSINESS: "../contexto/2.viabilidad-economica.md",
  VOICE: "../contexto/3.voz-y-tono.md",
  STYLE: "../contexto/3d.guia-de-estilo.md",
  CONTENT: "../contexto/4.estrategia-distribucion.md",
  ROADMAP: "../contexto/5.roadmap.md",
} as const;
type ContextDocKey = keyof typeof CONTEXT_DOCS;

// Resumen de qué contiene cada documento del paquete (mapa de contexto). El
// agente NO debe leerlos todos por defecto: usa este mapa para ir SOLO al
// archivo que necesite para la tarea concreta.
const CONTEXT_DOC_SUMMARY: Record<ContextDocKey, string> = {
  ANALYSIS: "Análisis de mercado: competencia, tendencias y oportunidad.",
  BUSINESS: "Viabilidad económica: costes, precios y unit economics.",
  VOICE: "Voz y tono de la marca (cómo comunica).",
  STYLE: "Guía de estilo: paleta de color, tipografía y componentes.",
  CONTENT: "Estrategia de distribución: canales y plan de contenidos.",
  ROADMAP: "Roadmap del proyecto: fases y prioridades de ejecución.",
};

// Resumen de los assets de identidad.
const ASSET_SUMMARY: Record<string, string> = {
  "../assets/logo.svg": "Logotipo vectorial elegido (SVG, 1:1).",
  "../assets/template.html": "Template web (set de componentes: hero, cards, formularios, secciones) con el logotipo incrustado.",
  "../assets/guia-estilos.pdf": "Guía de estilo en PDF.",
};

// Qué documentos del paquete son relevantes para cada skill (consulta puntual).
const SKILL_REFS: Record<string, ContextDocKey[]> = {
  "web-creator": ["ANALYSIS", "VOICE", "STYLE"],
  "contenido-redes": ["CONTENT", "VOICE", "ANALYSIS"],
  "seo-aso": ["ANALYSIS", "CONTENT"],
  "email-marketing": ["CONTENT", "VOICE", "BUSINESS"],
  analytics: ["BUSINESS", "ROADMAP"],
  "ads-manager": ["CONTENT", "BUSINESS", "ANALYSIS"],
  "finance-contabilidad": ["BUSINESS", "ROADMAP"],
  "project-handoff": ["ANALYSIS", "BUSINESS", "VOICE", "STYLE", "CONTENT", "ROADMAP"],
};

// Assets de identidad (carpeta assets/) que algunas skills usan.
const SKILL_ASSETS: Record<string, string[]> = {
  "web-creator": ["../assets/logo.svg", "../assets/template.html"],
  "project-handoff": ["../assets/logo.svg", "../assets/template.html", "../assets/guia-estilos.pdf"],
};

/**
 * Rol del agente por skill: una frase fuerte que define QUIÉN es y qué entrega,
 * en vez del genérico "actúa como un experto en X".
 */
const SKILL_ROLE: Record<string, string> = {
  "web-creator":
    "Eres un diseñador y maquetador web senior orientado a conversión. Produces el copy y la estructura HTML de una web profesional, accesible y responsive, reutilizando la identidad ya definida (logo, paleta, tipografías y tono).",
  "contenido-redes":
    "Eres un estratega de contenido y community manager. Diseñas la línea editorial y el calendario, y escribes copy listo para publicar en el tono exacto de la marca.",
  "seo-aso":
    "Eres un especialista en SEO (posicionamiento en buscadores) y ASO (optimización en tiendas de apps). Trabajas con intención de búsqueda y datos, no con relleno.",
  "email-marketing":
    "Eres un especialista en email marketing y ciclo de vida del cliente. Diseñas segmentos y secuencias que convierten manteniendo la voz de la marca.",
  analytics:
    "Eres un analista de producto y growth. Defines métricas accionables ligadas a los objetivos del negocio, no vanity metrics.",
  "ads-manager":
    "Eres un media buyer / gestor de paid media. Planificas campañas con segmentación, presupuesto y creatividades basadas en datos reales del proyecto.",
  "finance-contabilidad":
    "Eres un asesor financiero para pequeños negocios. Trabajas sobre los números reales del análisis de viabilidad.",
  "project-handoff":
    "Eres la guía de arranque para un agente externo (o un nuevo miembro del equipo) que va a ejecutar el paquete del proyecto.",
};

/**
 * Guía concreta POR SECCIÓN para las skills donde más importa (no relleno).
 * Cada entrada dice exactamente qué producir, conectado al proyecto por
 * referencia (sin repetir el target completo en cada sección).
 */
const SKILL_SECTION_GUIDES: Record<string, Record<string, string>> = {
  "web-creator": {
    "Contexto e identidad":
      "En 3-4 líneas: a quién le habla la web y qué promesa hace (toma target y propuesta de valor del proyecto). Fija como sistema visual la paleta, las tipografías y el logo de la guía de estilo.",
    "Estructura de secciones":
      "Define el orden orientado a conversión y justifica cada sección para ESTE negocio: hero (promesa + CTA principal), prueba social, beneficios / cómo funciona, precios o planes (según la monetización), FAQ, CTA final y footer.",
    "Copy por seccion":
      "Escribe el copy REAL de cada sección en el tono de la marca (nada de Lorem ipsum). Reglas de estilo: simple sobre complejo, específico sobre vago (números concretos), voz activa, sin hedging, mostrar sobre contar; claridad antes que ingenio; beneficios antes que features. Titular del hero con una fórmula probada (\"{resultado} sin {dolor}\", \"El {categoría} para {audiencia}\", \"Nunca más {evento desagradable}\"). CTA = [verbo de acción] + [qué obtienen] (+ cualificador): p. ej. \"Reservar mi plaza\". Cubre: prueba social, problema/dolor, solución/beneficios, cómo funciona, manejo de objeciones (FAQs) y CTA final. Para cada bloque, da 2-3 alternativas.",
    "Stack tecnico sugerido":
      "Recomienda un stack realista para el equipo (p. ej. Next.js + Tailwind, o un CMS/no-code si encaja). El HTML debe cumplir las reglas de diseño web de la sección de abajo (accesibilidad, foco, responsive, rendimiento).",
  },
  "contenido-redes": {
    "Pilares de contenido":
      "Define 3-5 pilares con una distribución de mezcla (p. ej. 30% insights del sector, 25% behind-the-scenes, 25% educativo, 15% personal, 5% promocional), derivados del análisis de mercado y los problemas del target. Para cada pilar: objetivo y 3 temas concretos.",
    "Calendario 30 dias":
      "Tabla de 30 días (tema, pilar, canal, formato) repartida según los canales priorizados. Propón un batching semanal realista (escribir varios posts de una vez) y la práctica de \"content atoms\": reutilizar una pieza larga en varios formatos.",
    "Formatos por canal":
      "Por canal prioritario, su formato y frecuencia nativos (LinkedIn 3-5/sem, carruseles; X/Twitter 3-10/día, hilos; Instagram reels/carruseles a diario; TikTok vídeo corto). Usa fórmulas de gancho: curiosidad (\"Estaba equivocado sobre…\"), historia, valor (\"Cómo {resultado} sin {dolor}\"), contrarian (\"Opinión impopular:\"). En vídeo, regla de los 3 segundos: gancho visual + verbal + texto en pantalla.",
    Metricas:
      "Awareness (impresiones, alcance, crecimiento de seguidores), engagement (tasa, comentarios, compartidos, guardados) y conversión (clics, visitas al perfil, leads). Revisión semanal: top/bottom performers y mejores horas.",
  },
  "seo-aso": {
    Keywords:
      "Prioriza por 5 niveles (crawlability/indexación → técnico → on-page → calidad de contenido → autoridad). Investiga keywords por intención (informacional, comercial, transaccional) para el sector y el target. Tabla: keyword, intención, volumen estimado, dificultad y página objetivo. Si el negocio es local, prioriza long-tail con la geo.",
    "On-page":
      "Title 50-60 car. con la keyword cerca del inicio; meta description 150-160 con propuesta de valor; UN solo H1 con la keyword; jerarquía H1→H2→H3; keyword en las primeras 100 palabras; anchor text descriptivo; sin páginas huérfanas. Core Web Vitals objetivo: LCP < 2.5s, INP < 200ms, CLS < 0.1. Ejemplos reales para home y 2 páginas clave.",
    "Schema.org":
      "Elige el tipo correcto (LocalBusiness, Product, Service, FAQPage…) y entrega el JSON-LD listo para pegar con los datos reales. Nota: el schema inyectado por JS no se detecta con fetch/curl — valida con el Rich Results Test de Google.",
    ASO: "Si hay app: título, subtítulo, campo de keywords, descripción y estrategia de reseñas para App Store y Google Play. Si NO hay app, indícalo y concéntrate en el SEO web. Formato de hallazgos: Problema · Impacto (Alto/Medio/Bajo) · Evidencia · Fix · Prioridad.",
  },
  "email-marketing": {
    Segmentos:
      "Principios: un email = un trabajo (un CTA); valor antes de pedir; relevancia sobre volumen; camino claro al siguiente paso. Define segmentos accionables (RFM —recencia, frecuencia, valor—: nuevos, activos, en riesgo, perdidos; o por etapa del ciclo). Para cada uno: criterio de entrada y objetivo.",
    Secuencias:
      "Diseña los flujos con sus longitudes típicas: Bienvenida/activación 5-7 emails en 12-14 días; Nurturing 6-8 en 2-3 semanas (de explorar el problema a la oferta); Reactivación 3-4 en 2 semanas (disparada por 30-60 días de inactividad). Adáptalos a la monetización (recordatorio de reserva, upsell a bono o suscripción). Para cada flujo: disparador, cadencia y objetivo.",
    "Plantillas de email":
      "Escribe 3-5 emails REALES con la estructura Gancho → Contexto → Valor → CTA → Cierre (asunto + preheader incluidos), en el tono de la marca. Longitud: 50-125 palabras (transaccional), 150-300 (educativo), 300-500 (narrativo). Asuntos que convierten: preguntas, how-to, listas numeradas, afirmaciones directas.",
    Metricas:
      "Open rate, CTR, conversión y bajas por flujo; benchmark del sector y qué optimizar primero.",
  },
  analytics: {
    "KPIs por objetivo":
      "Enfoque decision-driven: cada evento debe informar una decisión; evita vanity metrics (calidad > cantidad). Mapea los KPIs al embudo AARRR (Adquisición, Activación, Retención, Ingresos, Recomendación) y define la métrica norte. Diseña el plan trabajando hacia atrás desde las decisiones del negocio.",
    "Eventos a medir":
      "Clasifica en pageviews, acciones de usuario, eventos de sistema (signup/compra/suscripción) y conversiones custom. Nombra con patrón objeto-acción en minúsculas con guion bajo (`signup_completed`, `cta_hero_clicked`); el contexto va en PROPIEDADES, no en el nombre del evento.",
    Dashboards:
      "2-3 dashboards (adquisición, conversión, retención) con los widgets concretos y la herramienta sugerida (GA4, PostHog, Metabase…).",
    "Cadencia de reporte":
      "Entregable: un Plan de Medición (tabla: evento, descripción, propiedades, disparador, definición de conversión). Qué se revisa a diario/semanal/mensual, quién y qué decisión dispara. Valida disparo correcto y cero fugas de PII (datos personales).",
  },
  "ads-manager": {
    Plataformas:
      "Elige plataformas por su fortaleza de señal y dónde está el target: Google = keywords/intención de búsqueda; Meta = intereses/comportamientos/lookalike (sobre los clientes de mayor LTV, no todos); LinkedIn = cargos/empresas/industrias. Estructura jerárquica Cuenta > Campaña [objetivo-audiencia] > Conjunto [variación de targeting] > Anuncio 1-3; naming `[Plataforma]_[Objetivo]_[Audiencia]_[Oferta]_[Fecha]`.",
    Segmentacion:
      "Audiencias concretas por plataforma (intereses, lookalike, retargeting, geo local si aplica). Regla crítica: EXCLUYE clientes actuales y conversores recientes (mostrarles ads desperdicia gasto).",
    "Presupuesto y pujas":
      "Fase de testing (sem. 1-4): 70% campañas probadas, 30% nuevas audiencias/creatividades; al escalar, sube presupuesto 20-30% cada 3-5 días sobre las ganadoras. Puja: empieza manual/cost cap → tras 50+ conversiones pasa a automática. CPA objetivo derivado del CAC vs LTV de la fase de viabilidad.",
    Creatividades:
      "3-5 conceptos. Vídeo: gancho 0-3s (pattern interrupt) → problema → solución → CTA; subtítulos siempre (85% sin sonido); vertical en Stories, cuadrado en feed; estética nativa rinde más que pulida. Copy con fórmulas PAS (Problema-Agitar-Solución), BAB (Antes-Después-Puente) o Social Proof Lead. Orden de testeo: concepto/ángulo > gancho > visual > copy > CTA.",
  },
  "finance-contabilidad": {
    "Facturacion e impuestos":
      "Régimen fiscal aplicable (autónomo o sociedad), IVA/IRPF, qué y cómo facturar según la forma jurídica y el país. Si faltan datos para concretar, indícalo en vez de inventar.",
    Cashflow:
      "Plantilla de cashflow mensual a 12 meses: entradas por cada línea de ingreso real del proyecto y salidas (costes fijos y variables identificados).",
    "Proyeccion de ingresos":
      "3 escenarios (pesimista, realista, optimista) coherentes con la viabilidad ya analizada, con el punto de equilibrio.",
    Indicadores:
      "Margen, burn rate (consumo de caja), runway (meses de caja), ticket medio; con semáforos de alerta.",
  },
  "project-handoff": {
    "Que es el proyecto":
      "Un párrafo: qué es, para quién y modelo de negocio (tómalo de AGENT.md). Resultado final, no el proceso.",
    "Estructura del paquete":
      "Árbol de carpetas (`contexto/`, `assets/`, `skills/`) con una línea por archivo y para qué sirve.",
    "Orden de lectura":
      "Empieza SIEMPRE por `../AGENT.md`; luego ve SOLO al doc de contexto que pida la tarea concreta. No leer todo por defecto.",
    "Como ejecutar cada skill":
      "Cada archivo de `skills/` indica su Rol y qué documentos consultar; ejecuta la que toque según la necesidad (web, contenido, ads…).",
  },
};

/** Nota de guía por sección: usa la guía concreta si existe; si no, una
 * instrucción breve que referencia el contexto del proyecto SIN repetirlo. */
function sectionNote(skillId: string, sec: string, ctx: ProjectContext): string {
  const specific = SKILL_SECTION_GUIDES[skillId]?.[sec];
  if (specific) return specific;
  const tone = ctx.tone ? ` Mantén el tono de marca.` : "";
  return (
    `Desarrolla "${sec}" para el target y el modelo de negocio del proyecto (ver Contexto arriba).${tone} ` +
    `Ejemplos concretos y pasos accionables, no teoría genérica.`
  );
}

/**
 * Reglas de diseño web accionables (adaptadas de las Web Interface Guidelines de
 * Vercel) que la skill de web debe cumplir al maquetar.
 */
const WEB_DESIGN_RULES = [
  "## Reglas de diseño web (cumplir al maquetar)",
  "- **Accesibilidad:** HTML semántico (`<button>`, `<a>`, `<label>`) antes que ARIA; imágenes con `alt`; iconos decorativos `aria-hidden`; jerarquía de encabezados `<h1>`–`<h6>`.",
  "- **Foco e interacción:** estados de foco visibles (`:focus-visible`), nunca `outline:none` sin reemplazo; estados `hover` en botones y enlaces.",
  "- **Formularios:** cada input con `<label>` clicable, `type` y `autocomplete` correctos; errores en línea; no bloquees el pegado; botón de envío con spinner.",
  "- **Responsive:** móvil primero, unidades relativas; `min-w-0` en hijos flex para truncar; sin scroll horizontal indeseado; nada de `user-scalable=no`.",
  "- **Imágenes/rendimiento:** `<img>` con `width`/`height` (evita CLS); `loading=\"lazy\"` bajo el pliegue; `preconnect` a CDNs.",
  "- **Contenido:** voz activa y segunda persona; CTAs específicos (\"Reservar plaza\", no \"Continuar\"); estados vacíos contemplados; mensajes de error con el siguiente paso.",
  "",
].join("\n");

/**
 * Instrucción concreta de "cómo trabajar" por skill: en vez de inyectar la idea
 * en bruto, le dice al agente QUÉ documento/asset consultar ANTES de producir.
 * Esto conecta cada skill con el contexto real (tono, guía de estilo, template)
 * por referencia, no por copia.
 */
const SKILL_HOWTO: Record<string, string> = {
  "web-creator":
    "Antes de maquetar, lee la guía de estilo (`../contexto/3d.guia-de-estilo.md`) y abre el template de componentes (`../assets/template.html`) y el logotipo (`../assets/logo.svg`): reutiliza su paleta, tipografías y componentes. Respeta la voz/tono de `../contexto/3.voz-y-tono.md`. El copy debe hablarle al target del análisis de mercado.",
  "contenido-redes":
    "Antes de redactar, lee la voz y tono (`../contexto/3.voz-y-tono.md`) — es OBLIGATORIO mantener ese registro — y la estrategia de distribución (`../contexto/4.estrategia-distribucion.md`) para alinear pilares y canales. Apóyate en el análisis de mercado para los temas que importan al target.",
  "seo-aso":
    "Parte de las keywords y el público del análisis de mercado (`../contexto/1.analisis-de-mercado.md`) y de los pilares de contenido (`../contexto/4.estrategia-distribucion.md`).",
  "email-marketing":
    "Mantén la voz y tono (`../contexto/3.voz-y-tono.md`). Segmenta según el target y el modelo de negocio (`../contexto/2.viabilidad-economica.md`).",
  analytics:
    "Deriva los KPI del modelo de negocio (`../contexto/2.viabilidad-economica.md`) y del roadmap (`../contexto/5.roadmap.md`).",
  "ads-manager":
    "Usa el target y la competencia (`../contexto/1.analisis-de-mercado.md`), los canales (`../contexto/4.estrategia-distribucion.md`) y los unit economics (`../contexto/2.viabilidad-economica.md`) para presupuestos y segmentación. Mantén la voz/tono en las creatividades.",
  "finance-contabilidad":
    "Parte de los números del análisis de viabilidad (`../contexto/2.viabilidad-economica.md`) y del roadmap (`../contexto/5.roadmap.md`).",
  "project-handoff":
    "Empieza SIEMPRE por `../AGENT.md` (eje central con decisiones). Consulta cada doc de `../contexto/` solo cuando la tarea lo requiera.",
};

/** Construye el documento markdown de una skill (data-driven, referencia el paquete). */
function buildSkillMarkdown(skillId: string, ctx: ProjectContext): string {
  const def = SKILL_CATALOG.find((s) => s.id === skillId);
  const name = def?.name || skillId;
  const meta = getSkillOutputMeta(skillId);
  const refs = SKILL_REFS[skillId] || [];
  const assets = SKILL_ASSETS[skillId] || [];

  const L: string[] = [];
  L.push(`# ${name} - ${ctx.projectName}`);
  L.push("");
  L.push(`> ${def?.description || meta.outputSummary}`);
  L.push("");
  const role = SKILL_ROLE[skillId];
  if (role) {
    L.push("## Rol");
    L.push(role);
    L.push("");
  }
  L.push("## Contexto del proyecto");
  L.push(`- Proyecto: ${ctx.projectName}`);
  L.push(`- Target: ${ctx.targetUser}`);
  if (ctx.valueProposition) L.push(`- Propuesta de valor: ${ctx.valueProposition}`);
  if (ctx.problem) L.push(`- Problema: ${ctx.problem}`);
  L.push(`- Modelo de negocio: ${ctx.businessModel || "Por definir"}`);
  L.push(`- Monetizacion: ${ctx.monetization}`);
  if (ctx.tone) L.push(`- Tono de marca: ${ctx.tone}`);
  if (ctx.channels.length) L.push(`- Canales: ${ctx.channels.join(", ")}`);
  L.push("");

  if (refs.length || assets.length) {
    L.push("## Mapa del paquete (consulta puntual)");
    L.push(
      "No leas todo el contexto por defecto. Empieza por `../AGENT.md` (eje central " +
        "con el resumen e instrucciones del proyecto) y, para esta tarea, ve SOLO al " +
        "archivo de abajo cuya información necesites:"
    );
    for (const r of refs) L.push(`- \`${CONTEXT_DOCS[r]}\` — ${CONTEXT_DOC_SUMMARY[r]}`);
    for (const a of assets) L.push(`- \`${a}\` — ${ASSET_SUMMARY[a] ?? "Asset de identidad."}`);
    L.push("");
  }

  const howto = SKILL_HOWTO[skillId];
  if (howto) {
    L.push("## Cómo trabajar (antes de producir)");
    L.push(howto);
    L.push("");
  }

  L.push("## Plan de trabajo");
  L.push("");
  for (const sec of meta.sections) {
    L.push(`### ${sec}`);
    L.push(sectionNote(skillId, sec, ctx));
    L.push("");
  }

  // La skill de web incluye las reglas de diseño concretas a cumplir al maquetar.
  if (skillId === "web-creator") {
    L.push(WEB_DESIGN_RULES);
  }

  L.push("---");
  L.push(
    "_Generado por BrewValidator. Para un documento profundo y a medida, usa \"Mejorar con IA\" en la app._"
  );
  return L.join("\n");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = await guardProject(id);
    if (!guard.ok) return guard.response;
    const body = await req.json();
    const parsed = generateSkillsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { skillIds, mode } = parsed.data;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        idea: {
          select: {
            targetUser: true,
            valueProposition: true,
            problem: true,
            monetization: true,
            businessModel: true,
          },
        },
        phases: {
          orderBy: { sortOrder: "asc" },
          select: { label: true, type: true, status: true },
        },
      },
    });
    if (!project || !project.idea) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const existing: GeneratedSkill[] = Array.isArray(project.generatedSkills)
      ? (project.generatedSkills as unknown as GeneratedSkill[])
      : [];

    // ── mode "remove": quita las skillIds y persiste (sin generar) ──
    if (mode === "remove") {
      const remaining = existing.filter((g) => !skillIds.includes(g.id));
      await prisma.project.update({
        where: { id },
        data: {
          generatedSkills: remaining as unknown as Prisma.InputJsonValue,
          handoffReady: true,
        },
      });
      return NextResponse.json({ success: true, skills: remaining });
    }

    const ctx = buildProjectContext({
      name: project.name,
      description: project.description,
      idea: project.idea,
      phases: project.phases,
      memory: project.memory as ProjectMemory | null,
    });

    const generatedSkills: GeneratedSkill[] = skillIds.map((skillId) => {
      const def = SKILL_CATALOG.find((s) => s.id === skillId);
      return {
        id: skillId,
        name: def?.name || skillId,
        content: buildSkillMarkdown(skillId, ctx),
        source: "template" as const,
      };
    });

    // merge: upsert; all: reemplaza.
    let finalSkills: GeneratedSkill[];
    if (mode === "merge") {
      const byId = new Map(existing.map((g) => [g.id, g]));
      for (const g of generatedSkills) byId.set(g.id, g);
      finalSkills = Array.from(byId.values());
    } else {
      finalSkills = generatedSkills;
    }

    // Persiste también project.skills (meta del catálogo) para el AGENT.md del hand-off.
    const skillsMeta = finalSkills
      .map((g) => SKILL_CATALOG.find((s) => s.id === g.id))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        icon: s.icon,
        category: s.category,
        selected: true,
      }));

    await prisma.project.update({
      where: { id },
      data: {
        generatedSkills: finalSkills as unknown as Prisma.InputJsonValue,
        skills: skillsMeta as unknown as Prisma.InputJsonValue,
        handoffReady: true,
      },
    });

    return NextResponse.json({ success: true, skills: finalSkills });
  } catch (error) {
    console.error("POST /api/projects/[id]/skills/generate error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
