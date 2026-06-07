/**
 * smoke-brandbook.ts
 *
 * Smoke test for the Brand Book builder (`src/lib/identity-brandbook.ts`).
 *
 * Usage:
 *   npx tsx scripts/smoke-brandbook.ts
 *
 * Verifies:
 *  1. Full Brand Book generation with complete inputs.
 *  2. Partial Brand Book with missing naming content.
 *  3. Partial Brand Book with missing voice content.
 *  4. Partial Brand Book with missing visual content.
 *  5. Brand Book markdown serialization.
 *  6. Edge case: empty/null inputs don't crash.
 *
 * Does NOT touch the database or Prisma — it's a pure unit test
 * against the library functions.
 */

import {
  buildBrandBook,
  brandBookToMarkdown,
  BRANDBOOK_DEFAULT_SECTIONS,
} from "../src/lib/identity-brandbook";

/* ── Test helpers ── */

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}`);
  }
}

function section(label: string): void {
  console.log(`\n📋 ${label}`);
}

/* ── Mock visual artifact JSON (matching the VisualArtifactContent shape) ── */

const MOCK_VISUAL_JSON = JSON.stringify({
  options: [
    {
      variant: "A",
      html: "<html><head><meta name='mood' content='Moderno y minimalista'></head><body><h1>Estilo A</h1></body></html>",
      meta: {
        name: "Estilo A — Moderno y minimalista",
        primaryColor: "#0F172A",
        secondaryColor: "#F59E0B",
        fontHeading: "Inter",
        fontBody: "Source Sans 3",
        mood: "Moderno y minimalista",
      },
    },
    {
      variant: "B",
      html: "<html><head><meta name='mood' content='Clásico y elegante'></head><body><h1>Estilo B</h1></body></html>",
      meta: {
        name: "Estilo B — Clásico y elegante",
        primaryColor: "#1E3A5F",
        secondaryColor: "#D4AF37",
        fontHeading: "Playfair Display",
        fontBody: "Lora",
        mood: "Clásico y elegante",
      },
    },
    {
      variant: "C",
      html: "<html><head><meta name='mood' content='Innovador y disruptivo'></head><body><h1>Estilo C</h1></body></html>",
      meta: {
        name: "Estilo C — Innovador y disruptivo",
        primaryColor: "#7C3AED",
        secondaryColor: "#10B981",
        fontHeading: "Space Grotesk",
        fontBody: "DM Sans",
        mood: "Innovador y disruptivo",
      },
    },
  ],
});

const NAMING_CONTENT = `# Propuestas de nombre

## Opción A: "Tallow & Glow"
Un nombre que combina la tradición artesanal (tallow = sebo) con el
resultado final (glow = brillo). Elegimos esta opción porque evoca
autenticidad, conexión con ingredientes naturales y un resultado
visible y deseable.

## Opción B: "Hearth & Hide"
Inspirado en el hogar (hearth) y en los materiales naturales (hide).
Decidimos incluirla como alternativa porque transmite calidez y
sostenibilidad.

## Opción C: "Root & Ritual"
Conecta con las raíces (root) y la rutina de cuidado (ritual).`;

const VOICE_CONTENT = `# Voz y Tono de Marca

## Personalidad
La marca habla con un tono cálido, cercano y experto. No es pedante
ni demasiado técnico, pero demuestra conocimiento profundo sobre los
ingredientes y procesos artesanales. La voz es:

- **Cálida:** como una conversación junto al fuego.
- **Experta:** sabe de lo que habla sin necesidad de alardear.
- **Auténtica:** no usa lenguaje corporativo ni buzzwords vacías.
- **Inspiradora:** motiva a cuidar de uno mismo con rituales sencillos.

## Ejemplos de tono

### Redes sociales
"Tu piel merece ingredientes que puedas pronunciar. ✨  

Hoy hablamos del sebo de vacuno alimentado con pasto: por qué es el
mejor amigo de tu barrera cutánea y cómo lo usamos en Tallow & Glow."

### Email
"Hola {{nombre}},

Sabemos que elegir productos para la piel puede ser abrumador. Por eso
creamos fórmulas con menos de 5 ingredientes, todos reconocibles."`;

/* ── Tests ── */

section("1. Full Brand Book with complete inputs");
{
  const bb = buildBrandBook({
    projectName: "Tallow & Glow",
    namingContent: NAMING_CONTENT,
    voiceContent: VOICE_CONTENT,
    visualChoice: "A",
    visualArtifactJson: MOCK_VISUAL_JSON,
    projectContext: {
      description:
        "Una marca de cosmética natural artesanal basada en sebo de vacuno.",
    },
  });

  assert(bb.projectName === "Tallow & Glow", "projectName is set correctly");
  assert(
    bb.generatedAt != null && typeof bb.generatedAt === "string",
    "generatedAt is an ISO string"
  );
  assert(bb.sections.length === 9, "has exactly 9 sections");
  assert(
    bb.sections[0].id === "intro",
    "first section is intro"
  );
  assert(
    bb.sections[8].id === "dosdonts",
    "last section is dosdonts"
  );
  assert(
    bb.sections.every((s) => s.content.length > 0),
    "all sections have content"
  );

  // Meta checks
  assert(
    bb.meta.visualMeta !== null,
    "visualMeta is populated"
  );
  assert(
    bb.meta.visualMeta?.variant === "A",
    "visualMeta.variant is A"
  );
  assert(
    bb.meta.visualMeta?.primaryColor === "#0F172A",
    "visualMeta.primaryColor is correct"
  );
  assert(
    bb.meta.visualMeta?.fontHeading === "Inter",
    "visualMeta.fontHeading is correct"
  );
  assert(
    bb.meta.voiceSummary.length > 0 && bb.meta.voiceSummary.length <= 800,
    "voiceSummary is populated and capped"
  );
  assert(
    bb.meta.namingRationale && bb.meta.namingRationale.length > 0,
    "namingRationale is extracted"
  );

  // Check naming rationale picks up the keyword sentence
  assert(
    bb.meta.namingRationale!.includes("Elegimos") ||
      bb.meta.namingRationale!.includes("elegimos"),
    "namingRationale contains rationale keyword"
  );

  // Check specific sections
  const namingSection = bb.sections.find((s) => s.id === "naming");
  assert(
    namingSection?.content.includes("Tallow & Glow"),
    "naming section includes project name"
  );

  const colorSection = bb.sections.find((s) => s.id === "color");
  assert(
    colorSection?.content.includes("#0F172A"),
    "color section includes primary color"
  );
  assert(
    colorSection?.content.includes("#F59E0B"),
    "color section includes secondary color"
  );

  const typoSection = bb.sections.find((s) => s.id === "typography");
  assert(
    typoSection?.content.includes("Inter"),
    "typography section includes heading font"
  );

  const voiceSection = bb.sections.find((s) => s.id === "voice");
  assert(
    voiceSection?.content.includes("cálida") ||
      voiceSection?.content.includes("cálido"),
    "voice section includes tone keywords"
  );
}

section("2. Partial Brand Book — missing naming content");
{
  const bb = buildBrandBook({
    projectName: "Proyecto X",
    namingContent: null,
    voiceContent: VOICE_CONTENT,
    visualChoice: "B",
    visualArtifactJson: MOCK_VISUAL_JSON,
  });

  assert(bb.sections.length === 9, "has 9 sections even with missing naming");
  const namingSection = bb.sections.find((s) => s.id === "naming");
  assert(
    namingSection?.content.includes("PENDIENTE"),
    "naming section shows PENDIENTE placeholder"
  );
  assert(
    !bb.meta.namingRationale,
    "namingRationale is undefined"
  );
}

section("3. Partial Brand Book — missing voice content");
{
  const bb = buildBrandBook({
    projectName: "Proyecto X",
    namingContent: NAMING_CONTENT,
    voiceContent: null,
    visualChoice: "C",
    visualArtifactJson: MOCK_VISUAL_JSON,
  });

  const voiceSection = bb.sections.find((s) => s.id === "voice");
  assert(
    voiceSection?.content.includes("PENDIENTE"),
    "voice section shows PENDIENTE placeholder"
  );
  assert(bb.meta.voiceSummary === "", "voiceSummary is empty string");
}

section("4. Partial Brand Book — missing visual content");
{
  const bb = buildBrandBook({
    projectName: "Proyecto X",
    namingContent: NAMING_CONTENT,
    voiceContent: VOICE_CONTENT,
    visualChoice: null,
    visualArtifactJson: null,
  });

  assert(bb.meta.visualMeta === null, "visualMeta is null when no visual data");
  const colorSection = bb.sections.find((s) => s.id === "color");
  assert(
    colorSection?.content.includes("PENDIENTE"),
    "color section shows PENDIENTE"
  );
  const typoSection = bb.sections.find((s) => s.id === "typography");
  assert(
    typoSection?.content.includes("PENDIENTE"),
    "typography section shows PENDIENTE"
  );
}

section("5. brandBookToMarkdown serialization");
{
  const bb = buildBrandBook({
    projectName: "Tallow & Glow",
    namingContent: NAMING_CONTENT,
    voiceContent: VOICE_CONTENT,
    visualChoice: "A",
    visualArtifactJson: MOCK_VISUAL_JSON,
  });

  const md = brandBookToMarkdown(bb);
  assert(typeof md === "string" && md.length > 500, "produces a long markdown string");
  assert(md.includes("---"), "contains section separators");
  assert(md.includes("Tallow & Glow"), "includes project name");
  assert(md.includes("#0F172A"), "includes color hex");
}

section("6. Edge cases — null/empty inputs");
{
  // All null
  const bb1 = buildBrandBook({
    projectName: "",
    namingContent: null,
    voiceContent: null,
    visualChoice: null,
    visualArtifactJson: null,
  });
  assert(bb1.sections.length === 9, "all-null still produces 9 sections");
  assert(bb1.projectName === "", "empty projectName is preserved");
  assert(bb1.meta.visualMeta === null, "visualMeta is null");

  // Empty string naming
  const bb2 = buildBrandBook({
    projectName: "Test",
    namingContent: "",
    voiceContent: "",
    visualChoice: "A",
    visualArtifactJson: null,
  });
  assert(
    bb2.sections.find((s) => s.id === "naming")?.content.includes("PENDIENTE"),
    "empty naming shows PENDIENTE"
  );

  // Invalid visual variant (should default to A)
  const bb3 = buildBrandBook({
    projectName: "Test",
    namingContent: NAMING_CONTENT,
    voiceContent: VOICE_CONTENT,
    visualChoice: "INVALID",
    visualArtifactJson: MOCK_VISUAL_JSON,
  });
  assert(
    bb3.meta.visualMeta?.variant === "A",
    "invalid variant falls back to A"
  );

  // Invalid JSON in visual artifact
  const bb4 = buildBrandBook({
    projectName: "Test",
    namingContent: null,
    voiceContent: null,
    visualChoice: "A",
    visualArtifactJson: "not-valid-json",
  });
  assert(bb4.meta.visualMeta === null, "invalid JSON produces null visualMeta");

  // Very long voice content (>800 chars) gets truncated
  const longVoice = "A".repeat(2000);
  const bb5 = buildBrandBook({
    projectName: "Test",
    namingContent: null,
    voiceContent: longVoice,
    visualChoice: null,
    visualArtifactJson: null,
  });
  assert(
    bb5.meta.voiceSummary.length <= 800 + 1, // +1 for possible ellipsis
    "long voice is truncated to ~800 chars"
  );
}

section("7. BRANDBOOK_DEFAULT_SECTIONS consistency");
{
  assert(
    BRANDBOOK_DEFAULT_SECTIONS.length === 9,
    "default sections list has 9 entries"
  );
  const ids = BRANDBOOK_DEFAULT_SECTIONS.map((s) => s.id);
  assert(
    new Set(ids).size === ids.length,
    "all section ids are unique"
  );
  assert(
    ids.includes("intro") && ids.includes("dosdonts"),
    "includes first and last sections"
  );

  // Check ordering
  for (let i = 1; i < BRANDBOOK_DEFAULT_SECTIONS.length; i++) {
    assert(
      BRANDBOOK_DEFAULT_SECTIONS[i].order >
        BRANDBOOK_DEFAULT_SECTIONS[i - 1].order,
      `section ${i} has higher order than section ${i - 1}`
    );
  }
}

/* ── Summary ── */

console.log(`\n${"═".repeat(50)}`);
console.log(
  `\n📊 Results: ${passed} passed, ${failed} failed (${passed + failed} total)`
);

if (failed > 0) {
  console.error("\n❌ Some tests FAILED. Check the output above.\n");
  process.exit(1);
} else {
  console.log("\n✅ All tests PASSED!\n");
  process.exit(0);
}
