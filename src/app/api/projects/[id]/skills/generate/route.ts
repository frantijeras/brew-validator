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

/** Nota de guía por sección (genérica pero conectada al proyecto). */
function sectionNote(sec: string, ctx: ProjectContext): string {
  const target = ctx.targetUser || "tu publico objetivo";
  const tone = ctx.tone ? ` Manten el tono "${ctx.tone}".` : "";
  return (
    `Desarrolla "${sec}" a medida de ${ctx.projectName}, conectado al target ` +
    `(${target}) y al modelo de negocio (${ctx.businessModel || "por definir"}).${tone} ` +
    `Incluye ejemplos concretos y pasos accionables (no teoria generica).`
  );
}

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
    L.push(sectionNote(sec, ctx));
    L.push("");
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
