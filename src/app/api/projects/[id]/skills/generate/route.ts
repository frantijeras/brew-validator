import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ProjectMemory } from "@/lib/project-memory";

const generateSkillsSchema = z.object({
  skillIds: z.array(z.string()).min(1, "Selecciona al menos una skill"),
  mode: z.enum(["all", "sequential"]).default("all"),
});

interface GeneratedSkill {
  id: string;
  name: string;
  content: string;
}

// ── Skill templates ──────────────────────────────────────────────────

const SKILL_TEMPLATES: Record<
  string,
  (ctx: ProjectContext) => string
> = {
  "web-creator": (ctx) =>
    [
      `# Web Creator — ${ctx.projectName}`,
      "",
      "> Skill para construir la landing page y presencia web de **" + ctx.projectName + "**.",
      "",
      "---",
      "",
      "## 🎯 Contexto del proyecto",
      "",
      `- **Nombre:** ${ctx.projectName}`,
      `- **Descripción:** ${ctx.description}`,
      `- **Target:** ${ctx.targetUser}`,
      `- **Propuesta de valor:** ${ctx.valueProposition || "No definida"}`,
      `- **Problema:** ${ctx.problem || "No definido"}`,
      `- **Monetización:** ${ctx.monetization}`,
      `- **Modelo de negocio:** ${ctx.businessModel || "No especificado"}`,
      "",
      "---",
      "",
      "## 🎨 Identidad visual",
      "",
      ...(ctx.brandColors.length > 0
        ? ctx.brandColors.map((c) => `- **${c.name}:** \`${c.value}\``)
        : ["- Usar paleta coherente con la marca"]),
      "",
      "---",
      "",
      "## 📋 Instrucciones",
      "",
      "Genera una landing page completa, responsive y lista para producción.",
      "",
      "### Secciones obligatorias",
      "",
      "1. **Hero** — Título + subtítulo + CTA principal",
      "2. **Problema** — El dolor que resuelve el producto",
      "3. **Solución** — Cómo " + ctx.projectName + " resuelve el problema",
      "4. **Features** — 3-6 funcionalidades clave",
      "5. **Social Proof** — Testimonios / logos",
      "6. **Pricing** — Tabla de precios (placeholder si no definido)",
      "7. **FAQ** — 5-8 preguntas frecuentes",
      "8. **CTA final** — Repite el CTA principal",
      "9. **Footer** — Links, legal, redes",
      "",
      "### Stack técnico",
      "",
      "- Next.js 14+ (App Router)",
      "- Tailwind CSS",
      "- Lucide React icons",
      "- Responsive (mobile-first)",
      "",
      "---",
      "",
      `_Generado por BrewValidator — Handoff Package_`,
    ].join("\n"),

  "seo-aso": (ctx) =>
    [
      `# SEO & ASO Strategy — ${ctx.projectName}`,
      "",
      "> Skill para optimizar el posicionamiento web y de apps de **" + ctx.projectName + "**.",
      "",
      "---",
      "",
      "## 🎯 Contexto",
      "",
      `- **Proyecto:** ${ctx.projectName}`,
      `- **Target:** ${ctx.targetUser}`,
      `- **Propuesta de valor:** ${ctx.valueProposition || "No definida"}`,
      `- **Modelo de negocio:** ${ctx.businessModel || "No especificado"}`,
      "",
      "---",
      "",
      "## 🔍 SEO Web",
      "",
      "### Palabras clave principales",
      "",
      ...(ctx.keywords.length > 0
        ? ctx.keywords.map((k) => `- ${k}`)
        : `- ${ctx.projectName}\n- ${(ctx.valueProposition || ctx.description).slice(0, 60)}`),
      "",
      "### Meta tags",
      "",
      "- **Title:** " + ctx.projectName + " | " + (ctx.valueProposition || "Solución innovadora").slice(0, 50),
      "- **Description:** 150-160 caracteres resumiendo la propuesta de valor",
      "- **OG Image:** Placeholder con colores de marca",
      "",
      "### Estructura SEO",
      "",
      "- URL-friendly slugs",
      "- H1 único por página",
      "- Schema.org markup (SoftwareApplication / Service)",
      "- Sitemap XML + robots.txt",
      "",
      "---",
      "",
      "## 📱 ASO (App Store Optimization)",
      "",
      "- **Título:** Máx 30 caracteres, incluir keyword principal",
      "- **Subtítulo:** Máx 30 caracteres, keyword secundaria",
      "- **Keywords:** 100 caracteres, separados por comas",
      "- **Descripción:** 4000 caracteres, keywords naturales",
      "- **Screenshots:** 5-8 capturas que muestren features clave",
      "",
      "---",
      "",
      `_Generado por BrewValidator — Handoff Package_`,
    ].join("\n"),

  "social-media": (ctx) =>
    [
      `# Social Media Strategy — ${ctx.projectName}`,
      "",
      "> Skill para planificar y ejecutar la estrategia en redes sociales de **" + ctx.projectName + "**.",
      "",
      "---",
      "",
      "## 🎯 Objetivos",
      "",
      `- **Proyecto:** ${ctx.projectName}`,
      `- **Target:** ${ctx.targetUser}`,
      `- **Canales:** ${ctx.channels.join(", ") || "A definir"}`,
      `- **Tono:** ${ctx.tone || "Profesional y cercano"}`,
      "",
      "---",
      "",
      "## 📅 Calendario editorial (30 días)",
      "",
      "### Semana 1 — Lanzamiento",
      "- Día 1-2: Presentación del proyecto",
      "- Día 3-4: Contenido educativo sobre el problema",
      "- Día 5-7: CTA a lista de espera",
      "",
      "### Semana 2 — Engagement",
      "- Día 8-10: Tutoriales / hilos",
      "- Día 11-12: Encuestas a la comunidad",
      "- Día 13-14: Colaboraciones",
      "",
      "### Semana 3 — Conversión",
      "- Día 15-17: Casos de uso",
      "- Día 18-19: Comparativas",
      "- Día 20-21: Oferta early bird",
      "",
      "### Semana 4 — Retención",
      "- Día 22-24: User-generated content",
      "- Día 25-26: Roadmap / features",
      "- Día 27-30: Resumen + próximos pasos",
      "",
      "---",
      "",
      "## 📈 Métricas",
      "",
      "| Métrica | Mes 1 | Mes 3 |",
      "|---------|-------|-------|",
      "| Seguidores | +100 | +500 |",
      "| Engagement | >3% | >5% |",
      "| Clicks web | 200 | 1000 |",
      "",
      "---",
      "",
      `_Generado por BrewValidator — Handoff Package_`,
    ].join("\n"),

  "project-handoff": (ctx) =>
    [
      `# Project Handoff — ${ctx.projectName}`,
      "",
      "> Meta-skill con el contexto completo del proyecto.`,
      "",
      "---",
      "",
      "## 📋 Idea original",
      "",
      `- **Nombre:** ${ctx.projectName}`,
      `- **Descripción:** ${ctx.description}`,
      `- **Problema:** ${ctx.problem || "No especificado"}`,
      `- **Propuesta de valor:** ${ctx.valueProposition || "No especificada"}`,
      `- **Target:** ${ctx.targetUser}`,
      `- **Monetización:** ${ctx.monetization}`,
      `- **Modelo de negocio:** ${ctx.businessModel || "No especificado"}`,
      "",
      "---",
      "",
      "## 🧠 Decisiones del proyecto",
      "",
      ...ctx.memoryEntries.map(([k, v]) => `- **${k}:** ${v}`),
      "",
      "---",
      "",
      "## 📦 Fases completadas",
      "",
      ...ctx.completedPhases.map((p) => `- ✅ **${p.label}** (${p.type})`),
      "",
      "---",
      "",
      "## 🚀 Cómo usar",
      "",
      "1. Arrastra este archivo al chat de Cline/Cursor/Copilot",
      "2. El agente tiene TODO el contexto del proyecto",
      "3. Usa las otras skills para tareas específicas",
      "",
      "---",
      "",
      `_Generado por BrewValidator — Handoff Package_`,
    ].join("\n"),

  "content-writer": (ctx) =>
    [
      `# Content Writer — ${ctx.projectName}`,
      "",
      "> Skill para escribir contenido de marketing para **" + ctx.projectName + "**.",
      "",
      "---",
      "",
      "## 🎯 Contexto",
      "",
      `- **Proyecto:** ${ctx.projectName}`,
      `- **Target:** ${ctx.targetUser}`,
      `- **Tono:** ${ctx.tone || "Profesional y cercano"}`,
      `- **Canales:** ${ctx.channels.join(", ") || "A definir"}`,
      "",
      "---",
      "",
      "## ✍️ Formatos de contenido",
      "",
      "### Posts de redes",
      "- Máximo 280 chars (Twitter) / 800-1200 chars (LinkedIn)",
      "- Hook → Problema → Solución → CTA",
      "",
      "### Anuncios",
      "- Headline: 30 chars max",
      "- Body: 90 chars max",
      "- CTA claro y accionable",
      "",
      "### Email marketing",
      "- Subject: 40-50 chars",
      "- Body: 150-300 palabras",
      "- CTA al final",
      "",
      "---",
      "",
      `_Generado por BrewValidator — Handoff Package_`,
    ].join("\n"),

  "landing-builder": (ctx) =>
    SKILL_TEMPLATES["web-creator"]?.(ctx) ?? "",
};

// ── Default skill definitions ────────────────────────────────────────

const DEFAULT_SKILLS: Array<{
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}> = [
  { id: "web-creator", name: "Web Creator", description: "Construir la landing page del proyecto", icon: "Code", category: "desarrollo" },
  { id: "seo-aso", name: "SEO & ASO", description: "Estrategia de posicionamiento web y apps", icon: "Search", category: "marketing" },
  { id: "social-media", name: "Social Media", description: "Estrategia de redes sociales", icon: "Share2", category: "marketing" },
  { id: "content-writer", name: "Content Writer", description: "Escribir contenido de marketing", icon: "PenLine", category: "marketing" },
  { id: "project-handoff", name: "Project Handoff", description: "Contexto completo del proyecto para agentes AI", icon: "Target", category: "desarrollo" },
];

// ── Context builder ──────────────────────────────────────────────────

interface ProjectContext {
  projectName: string;
  description: string;
  targetUser: string;
  valueProposition: string | null;
  problem: string | null;
  monetization: string;
  businessModel: string | null;
  completedPhases: Array<{ label: string; type: string }>;
  memoryEntries: Array<[string, string]>;
  brandColors: Array<{ name: string; value: string }>;
  keywords: string[];
  channels: string[];
  tone: string | null;
}

function buildProjectContext(project: {
  name: string;
  description: string | null;
  idea: {
    targetUser: string;
    valueProposition: string | null;
    problem: string | null;
    monetization: string;
    businessModel: string | null;
  };
  phases: Array<{ label: string; type: string; status: string }>;
  memory: ProjectMemory | null;
}): ProjectContext {
  const completedPhases = project.phases
    .filter((p) => p.status === "COMPLETED")
    .map((p) => ({ label: p.label, type: p.type }));

  const memoryEntries: Array<[string, string]> = [];
  if (project.memory) {
    for (const [key, entry] of Object.entries(project.memory)) {
      if (entry && entry.value !== null && entry.value !== undefined) {
        const val = typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value);
        memoryEntries.push([key, val]);
      }
    }
  }

  const tone = project.memory?.tone?.value as string | null;
  const channels = project.memory?.channels?.value as string[] | string | null;
  const keywords = project.memory?.keywords?.value as string[] | string | null;

  return {
    projectName: project.name,
    description: project.description || project.idea.valueProposition || "",
    targetUser: project.idea.targetUser,
    valueProposition: project.idea.valueProposition,
    problem: project.idea.problem,
    monetization: project.idea.monetization,
    businessModel: project.idea.businessModel,
    completedPhases,
    memoryEntries,
    brandColors: [], // Will be populated from brand book if available
    keywords: Array.isArray(keywords) ? keywords : keywords ? [keywords] : [],
    channels: Array.isArray(channels) ? channels : channels ? [channels] : [],
    tone,
  };
}

// ── POST handler ─────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = generateSkillsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { skillIds } = parsed.data;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        idea: {
          select: {
            title: true,
            description: true,
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

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 },
      );
    }

    if (!project.idea) {
      return NextResponse.json(
        { error: "El proyecto no tiene idea asociada" },
        { status: 400 },
      );
    }

    const ctx = buildProjectContext({
      name: project.name,
      description: project.description,
      idea: project.idea,
      phases: project.phases,
      memory: project.memory as ProjectMemory | null,
    });

    // Generate skills
    const generatedSkills: GeneratedSkill[] = [];

    for (const skillId of skillIds) {
      // Try template first, then fall back to default
      const templateFn = SKILL_TEMPLATES[skillId];
      const skillDef = DEFAULT_SKILLS.find((s) => s.id === skillId);

      if (templateFn) {
        generatedSkills.push({
          id: skillId,
          name: skillDef?.name || skillId,
          content: templateFn(ctx),
        });
      } else {
        // Unknown skill — generate a generic one
        generatedSkills.push({
          id: skillId,
          name: skillDef?.name || skillId,
          content: [
            `# ${skillDef?.name || skillId} — ${ctx.projectName}`,
            "",
            `> Skill para ${skillDef?.description || skillId} del proyecto ${ctx.projectName}.`,
            "",
            "---",
            "",
            "## Contexto",
            "",
            `- **Proyecto:** ${ctx.projectName}`,
            `- **Target:** ${ctx.targetUser}`,
            `- **Descripción:** ${ctx.description}`,
            "",
            "---",
            "",
            `_Generado por BrewValidator — Handoff Package_`,
          ].join("\n"),
        });
      }
    }

    // Save to project
    await prisma.project.update({
      where: { id },
      data: {
        generatedSkills: generatedSkills as unknown as Prisma.InputJsonValue,
        handoffReady: true,
      },
    });

    return NextResponse.json({
      success: true,
      skills: generatedSkills,
    });
  } catch (error) {
    console.error("POST /api/projects/[id]/skills/generate error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
