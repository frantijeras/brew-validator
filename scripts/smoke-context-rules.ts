/**
 * Smoke test for agent-context-rules.ts
 *
 * Verifies:
 *  1. buildAgentContextRules with empty memory → "no hay decisiones"
 *  2. With populated memory → includes "NO PREGUNTES ESTO"
 *  3. With entry with rationale → includes the rationale
 */

import { buildAgentContextRules } from "../src/lib/agent-context-rules";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`✅ ${label}`);
    passed++;
  } else {
    console.log(`❌ ${label}`);
    failed++;
  }
}

// ── Test 1: Empty memory → "no hay decisiones" ──
{
  const output = buildAgentContextRules(null);
  assert(output.includes("No hay decisiones previas"), "null memory → 'no hay decisiones'");
  assert(output.includes("Pregunta todo lo que necesites saber"), "null memory → 'Pregunta todo'");
}

// ── Test 2: Empty object → same as null ──
{
  const output = buildAgentContextRules({});
  assert(output.includes("No hay decisiones previas"), "empty memory → 'no hay decisiones'");
}

// ── Test 3: Populated memory → "NO PREGUNTES ESTO" ──
{
  const output = buildAgentContextRules({
    target: {
      value: "jóvenes 18-25, urbanos, España",
      source: "01",
      updatedAt: "2026-06-07T10:00:00Z",
    },
    channels: {
      value: ["TikTok", "Instagram"],
      source: "01",
      updatedAt: "2026-06-07T10:00:00Z",
    },
  });

  assert(output.includes("NO PREGUNTES ESTO"), "populated memory → 'NO PREGUNTES ESTO'");
  assert(output.includes("target"), "populated memory → includes 'target' key");
  assert(output.includes("jóvenes 18-25"), "populated memory → includes target value");
  assert(output.includes("TikTok"), "populated memory → includes channels value (TikTok)");
  assert(output.includes("Instagram"), "populated memory → includes channels value (Instagram)");
  assert(output.includes("decidido en fase 01"), "populated memory → source info present");
  assert(output.includes("Reglas de consistencia"), "populated memory → consistency rules present");
}

// ── Test 4: Entry with rationale → includes rationale ──
{
  const output = buildAgentContextRules({
    target: {
      value: "profesionales 30-45",
      source: "01",
      updatedAt: "2026-06-07T10:00:00Z",
      rationale: "Mayor poder adquisitivo y necesidad de productividad",
    },
  });

  assert(output.includes("Por qué:"), "memory with rationale → 'Por qué:' label present");
  assert(
    output.includes("Mayor poder adquisitivo"),
    "memory with rationale → rationale text present",
  );
}

// ── Test 5: Complex value (array) → JSON-stringified ──
{
  const output = buildAgentContextRules({
    pricing: {
      value: { model: "freemium", basePrice: 9.99, currency: "EUR" },
      source: "04",
      updatedAt: "2026-06-07T10:00:00Z",
    },
  });

  assert(output.includes("freemium"), "complex value → includes nested property");
  // Arrays already handled in test 3
}

// ── Test 6: No contextRules in jobInput (for bridge reference) ──
// This is a documentation check — verified by reading the file content.
// We just confirm the contextRules field is present in the enqueuePhaseJob output.
{
  // Read the file and verify contextRules is in jobInput
  const fs = require("fs");
  const phaseJobs = fs.readFileSync(
    require("path").resolve(__dirname, "../src/lib/bridge/phase-jobs.ts"),
    "utf-8",
  );
  assert(
    phaseJobs.includes("contextRules,"),
    "phase-jobs.ts → jobInput includes contextRules field",
  );
  assert(
    phaseJobs.includes("projectMemory:"),
    "phase-jobs.ts → jobInput includes projectMemory field",
  );
  assert(
    phaseJobs.includes('import { buildAgentContextRules } from "@/lib/agent-context-rules"'),
    "phase-jobs.ts → imports buildAgentContextRules",
  );
}

// ── Summary ──
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
