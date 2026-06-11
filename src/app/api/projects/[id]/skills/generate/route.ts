import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import type { ProjectMemory } from "@/lib/project-memory";

const generateSkillsSchema = z.object({
  // An empty array is valid: it means "skip skill generation" — the handler
  // generates nothing and just unlocks the hand-off (handoffReady = true).
  skillIds: z.array(z.string()),
  mode: z.enum(["all", "sequential"]).default("all"),
});

interface GeneratedSkill {
  id: string;
  name: string;
  content: string;
}

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

// Skill template generator function type
type SkillTemplateFn = (ctx: ProjectContext) => string;

function buildWebCreatorSkill(ctx: ProjectContext): string {
  const lines: string[] = [];
  lines.push("# Web Creator -- " + ctx.projectName);
  lines.push("");
  lines.push("> Skill para construir la landing page y presencia web de **" + ctx.projectName + "**.");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Contexto del proyecto");
  lines.push("");
  lines.push("- **Nombre:** " + ctx.projectName);
  lines.push("- **Descripcion:** " + ctx.description);
  lines.push("- **Target:** " + ctx.targetUser);
  lines.push("- **Propuesta de valor:** " + (ctx.valueProposition || "No definida"));
  lines.push("- **Problema:** " + (ctx.problem || "No definido"));
  lines.push("- **Monetizacion:** " + ctx.monetization);
  lines.push("- **Modelo de negocio:** " + (ctx.businessModel || "No especificado"));
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Identidad visual");
  lines.push("");
  if (ctx.brandColors.length > 0) {
    for (const c of ctx.brandColors) {
      lines.push("- **" + c.name + ":** `" + c.value + "`");
    }
  } else {
    lines.push("- Usar paleta coherente con la marca");
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Instrucciones");
  lines.push("");
  lines.push("Genera una landing page completa, responsive y lista para produccion.");
  lines.push("");
  lines.push("### Secciones obligatorias");
  lines.push("");
  lines.push("1. **Hero** -- Titulo + subtitulo + CTA principal");
  lines.push("2. **Problema** -- El dolor que resuelve el producto");
  lines.push("3. **Solucion** -- Como " + ctx.projectName + " resuelve el problema");
  lines.push("4. **Features** -- 3-6 funcionalidades clave");
  lines.push("5. **Social Proof** -- Testimonios / logos");
  lines.push("6. **Pricing** -- Tabla de precios (placeholder si no definido)");
  lines.push("7. **FAQ** -- 5-8 preguntas frecuentes");
  lines.push("8. **CTA final** -- Repite el CTA principal");
  lines.push("9. **Footer** -- Links, legal, redes");
  lines.push("");
  lines.push("### Stack tecnico");
  lines.push("");
  lines.push("- Next.js 14+ (App Router)");
  lines.push("- Tailwind CSS");
  lines.push("- Lucide React icons");
  lines.push("- Responsive (mobile-first)");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("_Generado por BrewValidator -- Handoff Package_");
  return lines.join("\n");
}

function buildSeoAsoSkill(ctx: ProjectContext): string {
  const lines: string[] = [];
  lines.push("# SEO & ASO Strategy -- " + ctx.projectName);
  lines.push("");
  lines.push("> Skill para optimizar el posicionamiento web y de apps de **" + ctx.projectName + "**.");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Contexto");
  lines.push("");
  lines.push("- **Proyecto:** " + ctx.projectName);
  lines.push("- **Target:** " + ctx.targetUser);
  lines.push("- **Propuesta de valor:** " + (ctx.valueProposition || "No definida"));
  lines.push("- **Modelo de negocio:** " + (ctx.businessModel || "No especificado"));
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## SEO Web");
  lines.push("");
  lines.push("### Palabras clave principales");
  lines.push("");
  if (ctx.keywords.length > 0) {
    for (const k of ctx.keywords) {
      lines.push("- " + k);
    }
  } else {
    lines.push("- " + ctx.projectName);
    lines.push("- " + (ctx.valueProposition || ctx.description).slice(0, 60));
  }
  lines.push("");
  lines.push("### Meta tags");
  lines.push("");
  lines.push("- **Title:** " + ctx.projectName + " | " + (ctx.valueProposition || "Solucion innovadora").slice(0, 50));
  lines.push("- **Description:** 150-160 caracteres resumiendo la propuesta de valor");
  lines.push("- **OG Image:** Placeholder con colores de marca");
  lines.push("");
  lines.push("### Estructura SEO");
  lines.push("");
  lines.push("- URL-friendly slugs");
  lines.push("- H1 unico por pagina");
  lines.push("- Schema.org markup (SoftwareApplication / Service)");
  lines.push("- Sitemap XML + robots.txt");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## ASO (App Store Optimization)");
  lines.push("");
  lines.push("- **Titulo:** Max 30 caracteres, incluir keyword principal");
  lines.push("- **Subtitulo:** Max 30 caracteres, keyword secundaria");
  lines.push("- **Keywords:** 100 caracteres, separados por comas");
  lines.push("- **Descripcion:** 4000 caracteres, keywords naturales");
  lines.push("- **Screenshots:** 5-8 capturas que muestren features clave");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("_Generado por BrewValidator -- Handoff Package_");
  return lines.join("\n");
}

function buildSocialMediaSkill(ctx: ProjectContext): string {
  const lines: string[] = [];
  lines.push("# Social Media Strategy -- " + ctx.projectName);
  lines.push("");
  lines.push("> Skill para planificar y ejecutar la estrategia en redes sociales de **" + ctx.projectName + "**.");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Objetivos");
  lines.push("");
  lines.push("- **Proyecto:** " + ctx.projectName);
  lines.push("- **Target:** " + ctx.targetUser);
  lines.push("- **Canales:** " + (ctx.channels.join(", ") || "A definir"));
  lines.push("- **Tono:** " + (ctx.tone || "Profesional y cercano"));
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Calendario editorial (30 dias)");
  lines.push("");
  lines.push("### Semana 1 -- Lanzamiento");
  lines.push("- Dia 1-2: Presentacion del proyecto");
  lines.push("- Dia 3-4: Contenido educativo sobre el problema");
  lines.push("- Dia 5-7: CTA a lista de espera");
  lines.push("");
  lines.push("### Semana 2 -- Engagement");
  lines.push("- Dia 8-10: Tutoriales / hilos");
  lines.push("- Dia 11-12: Encuestas a la comunidad");
  lines.push("- Dia 13-14: Colaboraciones");
  lines.push("");
  lines.push("### Semana 3 -- Conversion");
  lines.push("- Dia 15-17: Casos de uso");
  lines.push("- Dia 18-19: Comparativas");
  lines.push("- Dia 20-21: Oferta early bird");
  lines.push("");
  lines.push("### Semana 4 -- Retencion");
  lines.push("- Dia 22-24: User-generated content");
  lines.push("- Dia 25-26: Roadmap / features");
  lines.push("- Dia 27-30: Resumen + proximos pasos");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Metricas");
  lines.push("");
  lines.push("| Metrica | Mes 1 | Mes 3 |");
  lines.push("|---------|-------|-------|");
  lines.push("| Seguidores | +100 | +500 |");
  lines.push("| Engagement | >3% | >5% |");
  lines.push("| Clicks web | 200 | 1000 |");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("_Generado por BrewValidator -- Handoff Package_");
  return lines.join("\n");
}

function buildProjectHandoffSkill(ctx: ProjectContext): string {
  const lines: string[] = [];
  lines.push("# Project Handoff -- " + ctx.projectName);
  lines.push("");
  lines.push("> Meta-skill con el contexto completo del proyecto.");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Idea original");
  lines.push("");
  lines.push("- **Nombre:** " + ctx.projectName);
  lines.push("- **Descripcion:** " + ctx.description);
  lines.push("- **Problema:** " + (ctx.problem || "No especificado"));
  lines.push("- **Propuesta de valor:** " + (ctx.valueProposition || "No especificada"));
  lines.push("- **Target:** " + ctx.targetUser);
  lines.push("- **Monetizacion:** " + ctx.monetization);
  lines.push("- **Modelo de negocio:** " + (ctx.businessModel || "No especificado"));
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Decisiones del proyecto");
  lines.push("");
  for (const [k, v] of ctx.memoryEntries) {
    lines.push("- **" + k + ":** " + v);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Fases completadas");
  lines.push("");
  for (const p of ctx.completedPhases) {
    lines.push("- **" + p.label + "** (" + p.type + ")");
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Como usar");
  lines.push("");
  lines.push("1. Arrastra este archivo al chat de Cline/Cursor/Copilot");
  lines.push("2. El agente tiene TODO el contexto del proyecto");
  lines.push("3. Usa las otras skills para tareas especificas");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("_Generado por BrewValidator -- Handoff Package_");
  return lines.join("\n");
}

function buildContentWriterSkill(ctx: ProjectContext): string {
  const lines: string[] = [];
  lines.push("# Content Writer -- " + ctx.projectName);
  lines.push("");
  lines.push("> Skill para escribir contenido de marketing para **" + ctx.projectName + "**.");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Contexto");
  lines.push("");
  lines.push("- **Proyecto:** " + ctx.projectName);
  lines.push("- **Target:** " + ctx.targetUser);
  lines.push("- **Tono:** " + (ctx.tone || "Profesional y cercano"));
  lines.push("- **Canales:** " + (ctx.channels.join(", ") || "A definir"));
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Formatos de contenido");
  lines.push("");
  lines.push("### Posts de redes");
  lines.push("- Maximo 280 chars (Twitter) / 800-1200 chars (LinkedIn)");
  lines.push("- Hook -> Problema -> Solucion -> CTA");
  lines.push("");
  lines.push("### Anuncios");
  lines.push("- Headline: 30 chars max");
  lines.push("- Body: 90 chars max");
  lines.push("- CTA claro y accionable");
  lines.push("");
  lines.push("### Email marketing");
  lines.push("- Subject: 40-50 chars");
  lines.push("- Body: 150-300 palabras");
  lines.push("- CTA al final");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("_Generado por BrewValidator -- Handoff Package_");
  return lines.join("\n");
}

const SKILL_TEMPLATES: Record<string, SkillTemplateFn> = {
  "web-creator": buildWebCreatorSkill,
  "seo-aso": buildSeoAsoSkill,
  "social-media": buildSocialMediaSkill,
  "project-handoff": buildProjectHandoffSkill,
  "content-writer": buildContentWriterSkill,
  "landing-builder": buildWebCreatorSkill,
};

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
    brandColors: [],
    keywords: Array.isArray(keywords) ? keywords : keywords ? [keywords] : [],
    channels: Array.isArray(channels) ? channels : channels ? [channels] : [],
    tone,
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
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

    const generatedSkills: GeneratedSkill[] = [];

    for (const skillId of skillIds) {
      const templateFn = SKILL_TEMPLATES[skillId];
      const skillDef = DEFAULT_SKILLS.find((s) => s.id === skillId);

      if (templateFn) {
        generatedSkills.push({
          id: skillId,
          name: skillDef?.name || skillId,
          content: templateFn(ctx),
        });
      } else {
        const genericLines: string[] = [];
        genericLines.push("# " + (skillDef?.name || skillId) + " -- " + ctx.projectName);
        genericLines.push("");
        genericLines.push("> Skill para " + (skillDef?.description || skillId) + " del proyecto " + ctx.projectName + ".");
        genericLines.push("");
        genericLines.push("---");
        genericLines.push("");
        genericLines.push("## Contexto");
        genericLines.push("");
        genericLines.push("- **Proyecto:** " + ctx.projectName);
        genericLines.push("- **Target:** " + ctx.targetUser);
        genericLines.push("- **Descripcion:** " + ctx.description);
        genericLines.push("");
        genericLines.push("---");
        genericLines.push("");
        genericLines.push("_Generado por BrewValidator -- Handoff Package_");
        generatedSkills.push({
          id: skillId,
          name: skillDef?.name || skillId,
          content: genericLines.join("\n"),
        });
      }
    }

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
