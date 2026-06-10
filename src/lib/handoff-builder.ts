import { ZipArchive } from "archiver";
import { ProjectMemory, getMemoryValue, formatMemoryValue } from "./project-memory";
import { BrandBook, brandBookToMarkdown } from "./identity-brandbook";

/* ── Types ──────────────────────────────────────────────────────────── */

export interface HandoffOptions {
  projectId: string;
  projectName: string;
  ideaContext: {
    title: string;
    description: string;
    problem: string;
    valueProposition: string;
    targetUser: string;
    monetization: string;
    businessModel: string;
  };
  phases: Array<{
    type: string;
    label: string;
    sortOrder: number;
    artifacts: Array<{ title: string; content: string; type: string }> | null;
    subStepArtifact: { type?: string; content?: string; options?: Array<{ value: string; label: string }> } | null;
    subStepChoice: string | null;
    subStep: string | null;
    description: string | null;
    status: string;
  }>;
  memory: ProjectMemory | null;
  brandBook: BrandBook | null;
}

/* ── Sanitisation ───────────────────────────────────────────────────── */

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "proyecto";
}

/* ── Phase artifact helpers ─────────────────────────────────────────── */

interface PhaseAsset {
  phaseType: string;
  label: string;
  sortOrder: number;
  titles: string[];
  contents: string[];
}

function extractPhaseAssets(ctx: HandoffOptions): PhaseAsset[] {
  return ctx.phases
    .filter((p) => p.status === "COMPLETED" && p.artifacts && p.artifacts.length > 0)
    .map((p) => {
      const arts = p.artifacts!;
      // For IDENTITY, if we have a brandBook, use the consolidated markdown
      // instead of the raw identity artifact.
      if (p.type === "IDENTITY" && ctx.brandBook) {
        return {
          phaseType: p.type,
          label: p.label,
          sortOrder: p.sortOrder,
          titles: ["Brand Book consolidado"],
          contents: [brandBookToMarkdown(ctx.brandBook)],
        };
      }
      return {
        phaseType: p.type,
        label: p.label,
        sortOrder: p.sortOrder,
        titles: arts.map((a) => a.title),
        contents: arts.map((a) => a.content),
      };
    });
}

/* ── File builders ──────────────────────────────────────────────────── */

function buildReadme(ctx: HandoffOptions): string {
  const { projectName, ideaContext, memory } = ctx;
  const safeName = sanitizeFilename(projectName);

  const mTarget = getMemoryValue<string>(memory, "target");
  const mTone = getMemoryValue<string>(memory, "tone");
  const mChannels = getMemoryValue<string | string[]>(memory, "channels");
  const mPricing = getMemoryValue<string>(memory, "pricing");
  const mBusinessModel = getMemoryValue<string>(memory, "businessModel");
  const mCompetitors = getMemoryValue<string>(memory, "competitors");

  const phaseAssets = extractPhaseAssets(ctx);
  const completedPhaseTypes = phaseAssets.map((a) => a.phaseType);

  return [
    `# ${projectName}`,
    "",
    "> Proyecto validado y desarrollado con **BrewIdea Validator**.",
    "",
    `**Fecha de handoff:** ${new Date().toISOString().split("T")[0]}`,
    "",
    "---",
    "",
    "## 📋 Idea original",
    "",
    `- **Título:** ${ideaContext.title}`,
    `- **Descripción:** ${ideaContext.description}`,
    `- **Problema:** ${ideaContext.problem || "—"}`,
    `- **Propuesta de valor:** ${ideaContext.valueProposition || "—"}`,
    `- **Target:** ${ideaContext.targetUser}`,
    `- **Monetización:** ${ideaContext.monetization}`,
    `- **Modelo de negocio:** ${ideaContext.businessModel || "—"}`,
    "",
    "---",
    "",
    "## 🧠 Decisiones del proyecto",
    "",
    mTarget ? `- **Target:** ${mTarget}` : "- **Target:** PENDIENTE",
    mTone ? `- **Tono:** ${mTone}` : "- **Tono:** PENDIENTE",
    mChannels ? `- **Canales:** ${formatMemoryValue(mChannels)}` : "- **Canales:** PENDIENTE",
    mPricing ? `- **Pricing:** ${mPricing}` : "- **Pricing:** PENDIENTE",
    mBusinessModel ? `- **Modelo de negocio:** ${mBusinessModel}` : "- **Modelo de negocio:** PENDIENTE",
    mCompetitors ? `- **Competidores:** ${mCompetitors}` : "- **Competidores:** PENDIENTE",
    "",
    "---",
    "",
    "## 📦 Fases completadas",
    "",
    ...phaseAssets.map(
      (a) => `- ✅ **Fase ${a.sortOrder} — ${a.label}** (${a.titles.join(", ")})`
    ),
    "",
    ...(completedPhaseTypes.length === 0 ? ["⚠️ Ninguna fase completada aún."] : []),
    "",
    "---",
    "",
    "## 🛠️ Skills incluidas",
    "",
    "Este ZIP incluye skills listas para usar con agentes como **Cline**, **Cursor** o **Copilot**:",
    "",
    "| Skill | Descripción |",
    "|-------|-------------|",
    `| \`skills/landing-builder.md\` | Construir la landing page de ${projectName} |`,
    `| \`skills/content-writer.md\` | Escribir posts, ads y contenido para ${projectName} |`,
    `| \`skills/social-strategy.md\` | Planificar el calendario editorial de ${projectName} |`,
    `| \`skills/project-handoff.md\` | Contexto completo del proyecto para cualquier agente |`,
    "",
    "---",
    "",
    "## 🚀 Cómo empezar",
    "",
    "1. Descomprime el ZIP",
    "2. Lee `README.md` (este archivo)",
    "3. Revisa el informe de validación en `01-validacion.md`",
    "4. Abre `skills/project-handoff.md` y entrégaselo a tu agente (Cline/Cursor)",
    "5. Usa `skills/landing-builder.md` para generar la landing page",
    "",
    `_Generado por BrewIdea Validator el ${new Date().toISOString()}_`,
  ].join("\n");
}

function buildValidationReport(ctx: HandoffOptions): string {
  const { ideaContext } = ctx;
  return [
    `# Informe de Validación — ${ideaContext.title}`,
    "",
    "## Datos de la idea",
    "",
    `- **Título:** ${ideaContext.title}`,
    `- **Descripción:** ${ideaContext.description}`,
    `- **Problema detectado:** ${ideaContext.problem || "No especificado"}`,
    `- **Propuesta de valor:** ${ideaContext.valueProposition || "No especificada"}`,
    `- **Usuario objetivo:** ${ideaContext.targetUser}`,
    `- **Modelo de monetización:** ${ideaContext.monetization}`,
    `- **Modelo de negocio:** ${ideaContext.businessModel || "No especificado"}`,
    "",
    "---",
    "",
    "## Resultado de la validación",
    "",
    "La idea fue validada mediante el proceso automático de BrewIdea Validator,",
    "que somete cada propuesta al análisis de un defensor, un escéptico y un juez.",
    "",
    "Para ver los reportes completos de cada agente, consulta la interfaz web",
    "del proyecto o los artefactos generados en fases posteriores.",
  ].join("\n");
}

function buildMarketAnalysis(ctx: HandoffOptions, assets: PhaseAsset[]): string | null {
  const analysis = assets.find((a) => a.phaseType === "ANALYSIS");
  if (!analysis) return null;
  return [
    `# Análisis de Mercado — ${ctx.projectName}`,
    "",
    ...analysis.contents.map((c) => c),
  ].join("\n");
}

function buildIdentityDocs(ctx: HandoffOptions): string | null {
  if (!ctx.brandBook) return null;
  const brandBook = ctx.brandBook;

  const sections: string[] = [];

  // Brand book content
  sections.push([
    `# Brand Book — ${ctx.projectName}`,
    "",
    `Generado: ${brandBook.generatedAt}`,
    "",
    brandBookToMarkdown(brandBook),
  ].join("\n"));

  // Voice and tone
  const voicePhase = ctx.phases.find(
    (p) => p.type === "IDENTITY" && p.subStep === "voice" && p.subStepArtifact?.content
  );
  if (voicePhase?.subStepArtifact?.content) {
    sections.push([
      `# Voz y Tono — ${ctx.projectName}`,
      "",
      voicePhase.subStepArtifact.content,
    ].join("\n"));
  }

  // Naming rationale
  const namingPhase = ctx.phases.find(
    (p) => p.type === "IDENTITY" && p.subStep === "naming"
  );
  if (namingPhase?.subStepArtifact?.content || namingPhase?.subStepChoice) {
    sections.push([
      `# Nombre y Rationale — ${ctx.projectName}`,
      "",
      `**Nombre elegido:** ${namingPhase.subStepChoice || ctx.projectName}`,
      "",
      namingPhase.subStepArtifact?.content || "PENDIENTE: completar sub-fase naming.",
    ].join("\n"));
  }

  return sections.length > 0 ? sections.join("\n\n---\n\n") : null;
}

function buildDistributionStrategy(ctx: HandoffOptions, assets: PhaseAsset[]): string | null {
  const content = assets.find((a) => a.phaseType === "CONTENT");
  if (!content) return null;
  return [
    `# Estrategia de Distribución — ${ctx.projectName}`,
    "",
    "## Canales y plataformas",
    "",
    ...content.contents.map((c, i) => `### ${content.titles[i] || "Documento"}\n\n${c}`),
  ].join("\n");
}

function buildLandingPage(_ctx: HandoffOptions, _assets: PhaseAsset[]): string | null {
  // DEVELOPMENT phase was removed — this builder is now a no-op.
  return null;
}

/**
 * Genera el documento de Estrategia de Negocio desde la fase BUSINESS (sortOrder 2).
 * Incluye Lean Canvas, modelo de ingresos y propuesta de valor estratégica.
 */
function buildBusinessPlan(ctx: HandoffOptions, assets: PhaseAsset[]): string | null {
  const biz = assets.find((a) => a.phaseType === "BUSINESS");
  if (!biz) return null;
  return [
    `# Estrategia de Negocio — ${ctx.projectName}`,
    "",
    "## Lean Canvas · Modelo de Ingresos · Propuesta de Valor Estratégica",
    "",
    ...biz.contents.map((c, i) => `### ${biz.titles[i] || "Documento"}\n\n${c}`),
  ].join("\n");
}

/**
 * Genera el documento de Roadmap desde la fase EXECUTION (sortOrder 6).
 * Incluye OKRs a 30/60/90 días, plan financiero detallado y próximos pasos.
 */
function buildRoadmap(ctx: HandoffOptions, assets: PhaseAsset[]): string | null {
  const exec = assets.find((a) => a.phaseType === "EXECUTION");
  if (!exec) return null;
  return [
    `# Roadmap 30-60-90 — ${ctx.projectName}`,
    "",
    "## OKRs · Plan Financiero · Próximos Pasos",
    "",
    ...exec.contents.map((c, i) => `### ${exec.titles[i] || "Documento"}\n\n${c}`),
  ].join("\n");
}

/* ── Skill builders ─────────────────────────────────────────────────── */

function buildLandingBuilderSkill(ctx: HandoffOptions): string {
  const { projectName, ideaContext, memory } = ctx;
  const mTarget = getMemoryValue<string>(memory, "target") || ideaContext.targetUser;
  const mTone = getMemoryValue<string>(memory, "tone") || "profesional y cercano";
  const mChannels = getMemoryValue<string | string[]>(memory, "channels");

  const visualMeta = ctx.brandBook?.meta?.visualMeta;
  const primaryColor = visualMeta?.primaryColor || "#1a1a2e";
  const secondaryColor = visualMeta?.secondaryColor || "#e94560";
  const fontHeading = visualMeta?.fontHeading || "Inter";
  const fontBody = visualMeta?.fontBody || "Inter";

  return [
    `# Landing Page Builder — ${projectName}`,
    "",
    "> Skill para construir la landing page de **" + projectName + "** usando Cline, Cursor o Copilot.",
    "",
    "---",
    "",
    "## 🎯 Contexto del proyecto",
    "",
    `- **Nombre:** ${projectName}`,
    `- **Target:** ${mTarget}`,
    `- **Propuesta de valor:** ${ideaContext.valueProposition || "No definida"}`,
    `- **Problema que resuelve:** ${ideaContext.problem || "No definido"}`,
    `- **Monetización:** ${ideaContext.monetization}`,
    `- **Modelo de negocio:** ${ideaContext.businessModel || "No especificado"}`,
    "",
    "---",
    "",
    "## 🎨 Identidad visual",
    "",
    `- **Color primario:** \`${primaryColor}\``,
    `- **Color secundario:** \`${secondaryColor}\``,
    `- **Tipografía headings:** ${fontHeading}`,
    `- **Tipografía body:** ${fontBody}`,
    "",
    "---",
    "",
    "## 📋 Instrucciones",
    "",
    "Genera una landing page completa, responsive y lista para producción.",
    "",
    "### Secciones obligatorias",
    "",
    "1. **Hero** — Título impactante + subtítulo + CTA principal + imagen/ilustración",
    "2. **Problema** — Explica el dolor que resuelve el producto",
    "3. **Solución** — Muestra cómo " + projectName + " resuelve el problema",
    "4. **Features** — 3-6 funcionalidades clave con iconos",
    "5. **Testimonios / Social Proof** — Placeholder para testimonios reales",
    "6. **Pricing** — Si aplica, tabla de precios (placeholder si no está definido)",
    "7. **FAQ** — 5-8 preguntas frecuentes",
    "8. **CTA final** — Repite el CTA principal",
    "9. **Footer** — Links, legal, redes sociales",
    "",
    "### Stack técnico",
    "",
    "- **Framework:** Next.js 14+ (App Router)",
    "- **Estilos:** Tailwind CSS",
    "- **Tipografía:** ${fontHeading} para headings, ${fontBody} para body (Google Fonts o similar)",
    "- **Iconos:** Lucide React",
    "- **Despliegue:** Vercel",
    "",
    "### Paleta de colores Tailwind",
    "",
    "```js",
    "// tailwind.config.ts",
    "colors: {",
    `  primary: '${primaryColor}',`,
    `  secondary: '${secondaryColor}',`,
    "}",
    "```",
    "",
    "### Tono de voz",
    "",
    `- **Voz:** ${mTone}`,
    "- **Lenguaje:** Español",
    "- **Estilo:** Directo, beneficios claros, sin hype exagerado",
    "",
    "### CTA principal",
    "",
    `La CTA principal debe estar orientada a ${ideaContext.monetization || "conversión"}.`,
    "Incluye un formulario de email para early access si no hay producto todavía.",
    "",
    "### SEO",
    "",
    "- Meta title: `" + projectName + " | " + (ideaContext.valueProposition || "Solución innovadora").slice(0, 50) + "`",
    "- Meta description: 150-160 caracteres resumiendo la propuesta de valor",
    "- Open Graph image (placeholder)",
    "- Schema.org markup para Software Application / Service",
    "",
    "---",
    "",
    "_Generado por BrewIdea Validator — Handoff Package_",
  ].join("\n");
}

function buildContentWriterSkill(ctx: HandoffOptions): string {
  const { projectName, ideaContext, memory } = ctx;
  const mTarget = getMemoryValue<string>(memory, "target") || ideaContext.targetUser;
  const mTone = getMemoryValue<string>(memory, "tone") || "profesional y cercano";

  return [
    `# Content Writer — ${projectName}`,
    "",
    "> Skill para escribir posts de redes sociales, anuncios, emails y contenido para **" + projectName + "**.",
    "",
    "---",
    "",
    "## 🎯 Contexto",
    "",
    `- **Proyecto:** ${projectName}`,
    `- **Target:** ${mTarget}`,
    `- **Propuesta de valor:** ${ideaContext.valueProposition || "No definida"}`,
    `- **Problema:** ${ideaContext.problem || "No definido"}`,
    "",
    "---",
    "",
    "## ✍️ Voz y tono",
    "",
    `- **Tono general:** ${mTone}`,
    "- **Lenguaje:** Español",
    "- **Personalidad:** " + (mTone === "formal" ? "Profesional, serio, autoritativo" : "Cercano, fresco, auténtico"),
    "",
    "---",
    "",
    "## 📝 Tipos de contenido",
    "",
    "### Posts de Twitter/X",
    "Máximo 280 caracteres. Directo, con gancho. Incluye emojis con moderación.",
    "Ejemplo:",
    '"[Problema]" → Así lo resolvemos en ' + projectName + '. Descúbrelo aquí 👇 [link]"',
    "",
    "### Posts de LinkedIn",
    "Formato storytelling. 800-1200 caracteres. Profesional pero accesible.",
    "Estructura: Hook → Problema → Solución → Resultado → CTA.",
    "",
    "### Anuncios (Meta Ads / Google Ads)",
    "- **Headline:** 30 caracteres máx",
    "- **Body:** 90 caracteres máx",
    "- **CTA:** Claro y accionable (\"Prueba gratis\", \"Descubre más\", \"Empieza ya\")",
    "",
    "### Email marketing",
    "- **Subject:** 40-50 caracteres, curiosidad o beneficio",
    "- **Body:** 150-300 palabras, tono cercano",
    "- **CTA:** Botón claro al final",
    "",
    "### Blog posts",
    "800-2000 palabras. SEO-friendly. Estructura: H1, H2, H3, bullets, conclusión.",
    "",
    "---",
    "",
    "## 🎨 Branding",
    "",
    ...(ctx.brandBook?.meta?.visualMeta
      ? [
          `- **Color primario:** \`${ctx.brandBook.meta.visualMeta.primaryColor}\``,
          `- **Color secundario:** \`${ctx.brandBook.meta.visualMeta.secondaryColor}\``,
        ]
      : ["- **Color primario:** Usar paleta del brand book", "- **Color secundario:** Ver brand book"]),
    "",
    "---",
    "",
    "## 📅 Calendario tipo",
    "",
    "- **Lunes:** Post educativo en LinkedIn",
    "- **Martes:** Tweet con tip/hack del sector",
    "- **Miércoles:** Anuncio en Meta Ads (variante nueva)",
    "- **Jueves:** Hilo de Twitter con caso de uso",
    "- **Viernes:** Email semanal a la lista",
    "- **Fin de semana:** Descanso o contenido ligero (memes, cultura)",
    "",
    "---",
    "",
    "_Generado por BrewIdea Validator — Handoff Package_",
  ].join("\n");
}

function buildSocialStrategySkill(ctx: HandoffOptions): string {
  const { projectName, ideaContext, memory } = ctx;
  const mTarget = getMemoryValue<string>(memory, "target") || ideaContext.targetUser;
  const mChannels = getMemoryValue<string | string[]>(memory, "channels");
  const mTone = getMemoryValue<string>(memory, "tone") || "profesional y cercano";

  const channelsList = mChannels
    ? (Array.isArray(mChannels) ? mChannels : [mChannels])
    : ["Twitter/X", "LinkedIn", "Instagram"];

  return [
    `# Social Strategy — ${projectName}`,
    "",
    "> Skill para planificar y ejecutar la estrategia de contenido en redes sociales de **" + projectName + "**.",
    "",
    "---",
    "",
    "## 🎯 Objetivos",
    "",
    `- **Proyecto:** ${projectName}`,
    `- **Target:** ${mTarget}`,
    `- **Propuesta de valor:** ${ideaContext.valueProposition || "No definida"}`,
    `- **Canales priorizados:** ${channelsList.join(", ")}`,
    `- **Tono:** ${mTone}`,
    "",
    "---",
    "",
    "## 📊 Canales y formatos",
    "",
    ...channelsList.map((ch: string) => {
      switch (ch.toLowerCase()) {
        case "twitter/x":
          return [
            "### Twitter / X",
            "- **Frecuencia:** 2-3 tweets/día",
            "- **Formatos:** Texto, hilos, imágenes, encuestas",
            "- **Horario:** 10:00, 14:00, 19:00 (hora España)",
            "- **Hashtags:** 1-2 por tweet máximo",
          ].join("\n");
        case "linkedin":
          return [
            "### LinkedIn",
            "- **Frecuencia:** 3-4 posts/semana",
            "- **Formatos:** Artículos largos, posts con imagen, carruseles PDF",
            "- **Horario:** Martes-Jueves 9:00-11:00",
            "- **Tono:** Profesional pero cercano. Aportar valor.",
          ].join("\n");
        case "instagram":
          return [
            "### Instagram",
            "- **Frecuencia:** 1 post/día + 3-5 stories/día",
            "- **Formatos:** Reels, carruseles, stories interactivas",
            "- **Horario:** 12:00, 18:00, 21:00",
            "- **Estilo:** Visual limpio, paleta de marca consistente",
          ].join("\n");
        case "tiktok":
          return [
            "### TikTok",
            "- **Frecuencia:** 1-2 videos/día",
            "- **Formatos:** Tutoriales rápidos, detrás de cámaras, tendencias",
            "- **Duración:** 15-60 segundos",
            "- **Tono:** Auténtico, divertido, educativo",
          ].join("\n");
        default:
          return `### ${ch}\n- **Frecuencia:** A definir\n- **Formatos:** A definir`;
      }
    }),
    "",
    "---",
    "",
    "## 📅 Calendario editorial (30 días)",
    "",
    "### Semana 1 — Lanzamiento / Awareness",
    "- Día 1-2: Posts de presentación del proyecto",
    "- Día 3-4: Contenido educativo sobre el problema que resuelve",
    "- Día 5-7: Testimonios / social proof (si existen) + CTA a lista de espera",
    "",
    "### Semana 2 — Engagement",
    "- Día 8-10: Hilos/tutoriales sobre el sector",
    "- Día 11-12: Encuestas y preguntas a la comunidad",
    "- Día 13-14: Colaboración / mención a cuentas relevantes",
    "",
    "### Semana 3 — Conversión",
    "- Día 15-17: Casos de uso con beneficios concretos",
    "- Día 18-19: Comparativas (antes/después)",
    "- Día 20-21: Oferta especial / early bird",
    "",
    "### Semana 4 — Retención",
    "- Día 22-24: User-generated content (si existe)",
    "- Día 25-26: Roadmap / próximas features",
    "- Día 27-28: Email capture / lead magnet",
    "- Día 29-30: Resumen del mes + próximos pasos",
    "",
    "---",
    "",
    "## 📈 Métricas clave",
    "",
    "| Métrica | Objetivo mes 1 | Objetivo mes 3 |",
    "|---------|---------------|----------------|",
    "| Seguidores | +100 | +500 |",
    "| Engagement rate | >3% | >5% |",
    "| Clicks a web | 200 | 1000 |",
    "| Emails capturados | 50 | 200 |",
    "",
    "---",
    "",
    "_Generado por BrewIdea Validator — Handoff Package_",
  ].join("\n");
}

function buildProjectHandoffSkill(ctx: HandoffOptions): string {
  const { projectName, ideaContext, memory } = ctx;

  const entries = memory
    ? Object.entries(memory)
        .filter(([, e]) => e && e.value !== null && e.value !== undefined)
    : [];

  return [
    `# Project Handoff — ${projectName}`,
    "",
    "> Meta-skill con el contexto completo del proyecto **" + projectName + "**.",
    "> Entrégasela a Cline, Cursor o Copilot para que cualquier agente tenga todo el contexto necesario.",
    "",
    "---",
    "",
    "## 📋 Idea original",
    "",
    `- **Nombre:** ${projectName}`,
    `- **Descripción:** ${ideaContext.description}`,
    `- **Problema:** ${ideaContext.problem || "No especificado"}`,
    `- **Propuesta de valor:** ${ideaContext.valueProposition || "No especificada"}`,
    `- **Usuario objetivo:** ${ideaContext.targetUser}`,
    `- **Monetización:** ${ideaContext.monetization}`,
    `- **Modelo de negocio:** ${ideaContext.businessModel || "No especificado"}`,
    "",
    "---",
    "",
    "## 🧠 Decisiones del proyecto (memory)",
    "",
    ...(entries.length > 0
      ? entries.map(
          ([k, e]) =>
            `- **${k}:** ${formatMemoryValue(e!.value)} (fuente: ${e!.source === "user" ? "usuario" : `Fase ${e!.source}`})`
        )
      : ["- No hay decisiones registradas aún."]),
    "",
    "---",
    "",
    "## 📦 Archivos del handoff",
    "",
    "Este ZIP contiene:",
    "",
    "| Archivo | Contenido |",
    "|---------|-----------|",
    "| `README.md` | Resumen general del proyecto |",
    "| `01-validacion.md` | Informe de validación original |",
    "| `02-analisis-mercado.md` | Análisis de mercado y competencia |",
    "| `03-estrategia-negocio.md` | Lean Canvas, modelo de ingresos y propuesta de valor |",
    "| `03-identidad-marca.md` | Brand book y identidad de marca |",
    "| `05-estrategia-distribucion.md` | Canales y estrategia de contenido |",
    "| `06-landing-page.md` | Prompt y estructura de la landing page |",
    "| `07-roadmap-30-60-90.md` | OKRs, plan financiero y próximos pasos |",
    "| `skills/` | Skills ejecutables para agentes AI |",
    "",
    "---",
    "",
    "## 🛠️ Skills disponibles",
    "",
    "1. **landing-builder.md** — Construir la landing page completa",
    "2. **content-writer.md** — Escribir posts, ads, emails",
    "3. **social-strategy.md** — Planificar el calendario editorial",
    "4. **project-handoff.md** — Este archivo, contexto completo",
    "",
    "---",
    "",
    "## 🚀 Cómo usar este handoff con un agente AI",
    "",
    "### Cursor / Cline / Copilot",
    "",
    "1. Abre el proyecto en tu IDE",
    "2. Arrastra `skills/project-handoff.md` al chat del agente",
    "3. El agente ahora tiene TODO el contexto del proyecto",
    "4. Para tareas específicas, usa la skill correspondiente:",
    '   - "Usa skills/landing-builder.md para construir la landing"',
    '   - "Usa skills/content-writer.md para escribir 5 posts de LinkedIn"',
    '   - "Usa skills/social-strategy.md para planificar el mes 1"',
    "",
    "### ChatGPT / Claude (copiar y pegar)",
    "",
    "Copia el contenido de la skill que necesites y pégalo como prompt inicial.",
    "Para contexto completo, copia este archivo (`project-handoff.md`).",
    "",
    "---",
    "",
    "_Generado por BrewIdea Validator — Handoff Package_",
  ].join("\n");
}

/* ── Main builder ───────────────────────────────────────────────────── */

/**
 * Genera un Buffer con el ZIP del handoff package.
 *
 * Usa la librería `archiver` para empaquetar en memoria.
 * 100% determinista — mismo input → mismo output (salvo timestamps en contenido).
 * No depende de APIs externas ni LLMs.
 */
export async function buildHandoffZip(options: HandoffOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on("error", (err: Error) => {
      reject(err);
    });

    const safeName = sanitizeFilename(options.projectName);
    const prefix = `${safeName}/`;

    const assets = extractPhaseAssets(options);

    // ── README.md ──
    archive.append(buildReadme(options), { name: `${prefix}README.md` });

    // ── 01-validacion.md ──
    archive.append(buildValidationReport(options), {
      name: `${prefix}01-validacion.md`,
    });

    // ── 02-analisis-mercado.md ──
    const marketAnalysis = buildMarketAnalysis(options, assets);
    if (marketAnalysis) {
      archive.append(marketAnalysis, {
        name: `${prefix}02-analisis-mercado.md`,
      });
    }

    // ── 03-estrategia-negocio.md ──
    const businessPlan = buildBusinessPlan(options, assets);
    if (businessPlan) {
      archive.append(businessPlan, {
        name: `${prefix}03-estrategia-negocio.md`,
      });
    }

    // ── 04-identidad/ ──
    // ── 03-identidad-marca.md (single file) ──
    const identityContent = buildIdentityDocs(options);
    if (identityContent) {
      archive.append(identityContent, {
        name: `${prefix}03-identidad-marca.md`,
      });
    }

    // ── 05-estrategia-distribucion.md ──
    const distStrategy = buildDistributionStrategy(options, assets);
    if (distStrategy) {
      archive.append(distStrategy, {
        name: `${prefix}05-estrategia-distribucion.md`,
      });
    }

    // ── 06-landing-page.md ──
    const landingContent = buildLandingPage(options, assets);
    if (landingContent) {
      archive.append(landingContent, {
        name: `${prefix}06-landing-page.md`,
      });
    }

    // ── 07-roadmap-30-60-90.md ──
    const roadmap = buildRoadmap(options, assets);
    if (roadmap) {
      archive.append(roadmap, {
        name: `${prefix}07-roadmap-30-60-90.md`,
      });
    }

    // ── skills/ ──
    archive.append(buildLandingBuilderSkill(options), {
      name: `${prefix}skills/landing-builder.md`,
    });
    archive.append(buildContentWriterSkill(options), {
      name: `${prefix}skills/content-writer.md`,
    });
    archive.append(buildSocialStrategySkill(options), {
      name: `${prefix}skills/social-strategy.md`,
    });
    archive.append(buildProjectHandoffSkill(options), {
      name: `${prefix}skills/project-handoff.md`,
    });

    void archive.finalize();
  });
}
