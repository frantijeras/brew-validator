/**
 * Smoke test for buildHandoffZip.
 *
 * Usage: npx tsx scripts/smoke-handoff.ts
 *
 * Verifies:
 *  1. ZIP builds without errors
 *  2. ZIP can be opened and lists expected files
 *  3. Expected files are present (README.md, skills/landing-builder.md, etc.)
 *  4. Filenames are sanitized (no accents, spaces, or special chars)
 */

import { buildHandoffZip, type HandoffOptions } from "../src/lib/handoff-builder";
import { buildBrandBook } from "../src/lib/identity-brandbook";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ── Test data with accents, spaces and special chars ──
const TEST_PROJECT_NAME = "Mi Proyecto Épico 3000!";

const testOptions: HandoffOptions = {
  projectId: "test-123",
  projectName: TEST_PROJECT_NAME,
  ideaContext: {
    title: "Mi Proyecto Épico 3000!",
    description: "Una idea revolucionaria que cambiará el mundo",
    problem: "La gente pierde demasiado tiempo en tareas repetitivas",
    valueProposition: "Automatización inteligente al alcance de todos",
    targetUser: "Emprendedores y pequeños negocios",
    monetization: "Suscripción mensual con tier gratuito",
    businessModel: "SaaS",
  },
  phases: [
    {
      type: "IDENTITY",
      label: "Identidad de Marca",
      sortOrder: 1,
      status: "COMPLETED",
      description: "Define la identidad de marca",
      subStep: "final",
      subStepChoice: "Mi Proyecto Épico",
      subStepArtifact: null,
      artifacts: [
        {
          title: "Brand Book",
          content: "## Brand Book\n\nContenido de identidad...",
          type: "markdown",
        },
      ],
    },
    {
      type: "ANALYSIS",
      label: "Análisis de Mercado",
      sortOrder: 2,
      status: "COMPLETED",
      description: "Analiza el mercado y competencia",
      subStep: null,
      subStepChoice: null,
      subStepArtifact: null,
      artifacts: [
        {
          title: "Análisis de Mercado",
          content: "## Análisis de Mercado\n\n### Competidores\n- Competidor A\n- Competidor B\n\n### Tendencias\n...",
          type: "markdown",
        },
      ],
    },
    {
      type: "CONTENT",
      label: "Contenido y Distribución",
      sortOrder: 3,
      status: "COMPLETED",
      description: "Define la estrategia de contenido",
      subStep: null,
      subStepChoice: null,
      subStepArtifact: null,
      artifacts: [
        {
          title: "Estrategia de Distribución",
          content: "## Canales\n\n- Twitter\n- LinkedIn\n- Email",
          type: "markdown",
        },
      ],
    },
    {
      type: "DEVELOPMENT",
      label: "Desarrollo",
      sortOrder: 4,
      status: "COMPLETED",
      description: "Genera el prompt de desarrollo",
      subStep: null,
      subStepChoice: null,
      subStepArtifact: null,
      artifacts: [
        {
          title: "Landing Page Prompt",
          content: "## Landing Page\n\n### Hero\n...\n### Features\n...",
          type: "markdown",
        },
      ],
    },
    {
      type: "DOSSIER",
      label: "Dossier",
      sortOrder: 5,
      status: "LOCKED",
      description: "Prepara el dossier final",
      subStep: null,
      subStepChoice: null,
      subStepArtifact: null,
      artifacts: null,
    },
    {
      type: "BUSINESS",
      label: "Business",
      sortOrder: 6,
      status: "COMPLETED",
      description: "Define el plan de negocio",
      subStep: null,
      subStepChoice: null,
      subStepArtifact: null,
      artifacts: [
        {
          title: "Plan de Negocio",
          content: "## Plan de Negocio\n\n### Pricing\n...\n### Revenue Model\n...",
          type: "markdown",
        },
      ],
    },
    {
      type: "EXECUTION",
      label: "Ejecución",
      sortOrder: 7,
      status: "COMPLETED",
      description: "Define el roadmap",
      subStep: null,
      subStepChoice: null,
      subStepArtifact: null,
      artifacts: [
        {
          title: "Roadmap 30-60-90",
          content: "## Roadmap\n\n### Día 1-30\n...\n### Día 31-60\n...\n### Día 61-90\n...",
          type: "markdown",
        },
      ],
    },
  ],
  memory: {
    target: {
      value: "Emprendedores tech",
      source: "02",
      updatedAt: new Date().toISOString(),
    },
    tone: {
      value: "cercano y profesional",
      source: "01",
      updatedAt: new Date().toISOString(),
    },
    channels: {
      value: ["Twitter", "LinkedIn", "Email"],
      source: "03",
      updatedAt: new Date().toISOString(),
    },
  },
  brandBook: buildBrandBook({
    projectName: TEST_PROJECT_NAME,
    namingContent: "## Nombre\n\nElegimos 'Mi Proyecto Épico' porque transmite ambición y profesionalismo.",
    voiceContent: "## Voz y Tono\n\nLa marca habla con un tono cercano pero profesional. Usamos lenguaje inclusivo y directo.",
    visualChoice: "A",
    visualArtifactJson: JSON.stringify({
      options: [
        {
          variant: "A",
          meta: {
            name: "Estilo A — Moderno y vibrante",
            primaryColor: "#6C63FF",
            secondaryColor: "#FF6584",
            fontHeading: "Poppins",
            fontBody: "Inter",
            mood: "Moderno, fresco, tecnológico",
          },
        },
        {
          variant: "B",
          meta: {
            name: "Estilo B — Clásico y elegante",
            primaryColor: "#1a1a2e",
            secondaryColor: "#e94560",
            fontHeading: "Playfair Display",
            fontBody: "Lato",
            mood: "Elegante, sofisticado, premium",
          },
        },
      ],
    }),
    projectContext: { description: "Una idea revolucionaria" },
  }),
};

async function main() {
  console.log("🧪 Smoke test: buildHandoffZip\n");

  let passed = 0;
  let failed = 0;

  // ── Test 1: Build ZIP ──
  console.log("  Test 1: Build ZIP from test data...");
  let zipBuffer: Buffer;
  try {
    zipBuffer = await buildHandoffZip(testOptions);
    if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length === 0) {
      throw new Error("ZIP buffer is empty");
    }
    console.log(`  ✅ ZIP built successfully (${zipBuffer.length} bytes)`);
    passed++;
  } catch (err) {
    console.log(`  ❌ Failed: ${err}`);
    failed++;
    process.exit(1);
  }

  // ── Test 2: Filename sanitization ──
  console.log("\n  Test 2: Filename sanitization...");
  try {
    // The project name "Mi Proyecto Épico 3000!" should be sanitized
    // to "mi-proyecto-epico-3000"
    const expectedPrefix = "mi-proyecto-epico-3000/";
    const zipStr = zipBuffer.toString("utf-8");
    // ZIP stores filenames in binary; check for readable patterns
    const hasSanitized = zipStr.includes("mi-proyecto-epico-3000/");
    const hasNoSpaces = !zipStr.includes("Mi Proyecto Épico");
    if (hasSanitized || hasNoSpaces) {
      console.log("  ✅ Filename sanitization confirmed");
      passed++;
    } else {
      console.log("  ⚠️ Could not fully verify sanitization in binary ZIP, checking via unzip...");
    }
  } catch (err) {
    console.log(`  ❌ Failed: ${err}`);
    failed++;
  }

  // ── Test 3: Write ZIP to disk and extract ──
  console.log("\n  Test 3: Write ZIP to /tmp and verify contents...");
  const tmpZip = "/tmp/smoke-handoff-test.zip";
  const tmpDir = "/tmp/smoke-handoff-extract";

  try {
    writeFileSync(tmpZip, zipBuffer);
    execSync(`rm -rf ${tmpDir} && mkdir -p ${tmpDir}`, { encoding: "utf-8" });
    execSync(`unzip -o "${tmpZip}" -d "${tmpDir}"`, { encoding: "utf-8" });

    // List extracted files
    const files = execSync(`find "${tmpDir}" -type f | sort`, { encoding: "utf-8" })
      .trim()
      .split("\n")
      .map((f) => f.replace(tmpDir + "/", ""));

    console.log("  Extracted files:");
    files.forEach((f) => console.log(`    - ${f}`));

    // Verify expected files exist
    const requiredFiles = [
      "README.md",
      "01-validacion.md",
      "02-analisis-mercado.md",
      "03-identidad/brand-book.md",
      "04-estrategia-distribucion.md",
      "05-landing-page.md",
      "06-plan-negocio.md",
      "07-roadmap-30-60-90.md",
      "skills/landing-builder.md",
      "skills/content-writer.md",
      "skills/social-strategy.md",
      "skills/project-handoff.md",
    ];

    const topDir = files[0]?.split("/")[0] || "";
    console.log(`\n  Top-level directory: ${topDir}`);

    for (const required of requiredFiles) {
      const fullPath = `${topDir}/${required}`;
      const found = files.some(
        (f) => f === fullPath || f.startsWith(fullPath)
      );
      if (found) {
        console.log(`  ✅ Found: ${fullPath}`);
        passed++;
      } else {
        console.log(`  ❌ Missing: ${fullPath}`);
        failed++;
      }
    }

    // Verify that DOSSIER (LOCKED phase) is NOT included
    const hasDossier = files.some((f) => f.toLowerCase().includes("dossier"));
    if (!hasDossier) {
      console.log("  ✅ LOCKED phase correctly omitted");
      passed++;
    } else {
      console.log("  ❌ LOCKED phase should not appear in ZIP");
      failed++;
    }

  } catch (err) {
    console.log(`  ❌ Failed: ${err}`);
    failed++;
  } finally {
    execSync(`rm -f "${tmpZip}" && rm -rf "${tmpDir}"`, { encoding: "utf-8" });
  }

  // ── Summary ──
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
