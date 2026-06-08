import { SKILL_CATALOG, type SkillCondition } from "./skill-catalog";

export interface SkillRecommendation {
  skill: (typeof SKILL_CATALOG)[number];
  confidence: number;
  matchedConditions: string[];
  reason: string;
  recommended: boolean;
}

export interface InferenceInput {
  businessModel?: string | null;
  phaseArtifacts: Array<{
    type: string;
    artifacts?: Array<{ title?: string; content?: string }> | null;
  }>;
  phaseQuizAnswers: Array<{
    type: string;
    questions?: Array<{
      id: string;
      answer?: string;
      options?: Array<{ value: string; label: string }>;
    }> | null;
  }>;
  projectMemory?: Record<string, unknown> | null;
}

// ── Condition evaluators ────────────────────────────────────────────

interface EvalResult {
  matched: boolean;
  weight: number;
  description: string;
}

function evaluateAlways(): EvalResult {
  return {
    matched: true,
    weight: 0.3,
    description: "base universal (siempre se considera)",
  };
}

function evaluateBusinessModel(
  condition: Extract<SkillCondition, { type: "business_model_is" }>,
  businessModel?: string | null,
): EvalResult {
  if (!businessModel) {
    return {
      matched: false,
      weight: 1.0,
      description: `modelo de negocio "${condition.values.join(", ")}" (no definido)`,
    };
  }
  const lowerBM = businessModel.toLowerCase();
  const matched = condition.values.some((v) => lowerBM.includes(v.toLowerCase()));
  return {
    matched,
    weight: 1.0,
    description: matched
      ? `modelo de negocio "${businessModel}" coincide con ${condition.values.join(", ")}`
      : `modelo de negocio "${businessModel}" no coincide con ${condition.values.join(", ")}`,
  };
}

function evaluatePhaseArtifactContains(
  condition: Extract<SkillCondition, { type: "phase_artifact_contains" }>,
  phaseArtifacts: InferenceInput["phaseArtifacts"],
): EvalResult {
  const phase = phaseArtifacts.find(
    (p) => p.type.toUpperCase() === condition.phaseType.toUpperCase(),
  );

  if (!phase || !phase.artifacts || phase.artifacts.length === 0) {
    return {
      matched: false,
      weight: 1.0,
      description: `sin artefactos en fase ${condition.phaseType}`,
    };
  }

  const combined = phase.artifacts
    .map((a) => [a.title ?? "", a.content ?? ""].join(" "))
    .join(" ")
    .toLowerCase();

  const hits = condition.keywords.filter((kw) =>
    combined.includes(kw.toLowerCase()),
  );

  if (hits.length === 0) {
    return {
      matched: false,
      weight: 1.0,
      description: `sin keywords detectadas en fase ${condition.phaseType}`,
    };
  }

  return {
    matched: true,
    weight: 1.0,
    description: `keywords "${hits.join(", ")}" en fase ${condition.phaseType}`,
  };
}

function evaluateHasChannelInBullseye(
  condition: Extract<SkillCondition, { type: "has_channel_in_bullseye" }>,
  phaseArtifacts: InferenceInput["phaseArtifacts"],
): EvalResult {
  // Extract channels from CONTENT phase artifacts
  const contentPhase = phaseArtifacts.find(
    (p) => p.type.toUpperCase() === "CONTENT",
  );

  if (!contentPhase || !contentPhase.artifacts || contentPhase.artifacts.length === 0) {
    return {
      matched: false,
      weight: 0.8,
      description: "sin artefactos de CONTENT para extraer canales",
    };
  }

  const combined = contentPhase.artifacts
    .map((a) => [a.title ?? "", a.content ?? ""].join(" "))
    .join(" ")
    .toLowerCase();

  const hits = condition.channelKeywords.filter((kw) =>
    combined.includes(kw.toLowerCase()),
  );

  if (hits.length === 0) {
    return {
      matched: false,
      weight: 0.8,
      description: "sin canales coincidentes en la Matriz Bullseye",
    };
  }

  return {
    matched: true,
    weight: 0.8,
    description: `canales "${hits.join(", ")}" en Matriz Bullseye`,
  };
}

function evaluateMemoryKeyContains(
  condition: Extract<SkillCondition, { type: "memory_key_contains" }>,
  projectMemory?: Record<string, unknown> | null,
): EvalResult {
  if (!projectMemory) {
    return {
      matched: false,
      weight: 0.7,
      description: "sin memoria de proyecto",
    };
  }

  const entry = projectMemory[condition.key];
  if (!entry) {
    return {
      matched: false,
      weight: 0.7,
      description: `sin valor para "${condition.key}" en memoria`,
    };
  }

  let valueStr = "";
  if (typeof entry === "string") {
    valueStr = entry;
  } else if (typeof entry === "object" && entry !== null && "value" in entry) {
    valueStr = String((entry as { value: unknown }).value ?? "");
  }

  const lowerVal = valueStr.toLowerCase();
  const matched = condition.values.some((v) =>
    lowerVal.includes(v.toLowerCase()),
  );

  return {
    matched,
    weight: 0.7,
    description: matched
      ? `memoria "${condition.key}" contiene "${condition.values.join(", ")}"`
      : `memoria "${condition.key}" no contiene "${condition.values.join(", ")}"`,
  };
}

function evaluateQuizAnswerMatches(
  condition: Extract<SkillCondition, { type: "quiz_answer_matches" }>,
  phaseQuizAnswers: InferenceInput["phaseQuizAnswers"],
): EvalResult {
  const quiz = phaseQuizAnswers.find(
    (q) => q.type.toUpperCase() === condition.phaseType.toUpperCase(),
  );

  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return {
      matched: false,
      weight: 0.8,
      description: `sin respuestas de quiz en fase ${condition.phaseType}`,
    };
  }

  const question = quiz.questions.find((q) => q.id === condition.questionId);
  if (!question) {
    return {
      matched: false,
      weight: 0.8,
      description: `pregunta "${condition.questionId}" no encontrada`,
    };
  }

  if (!question.answer) {
    return {
      matched: false,
      weight: 0.8,
      description: `pregunta "${condition.questionId}" sin respuesta`,
    };
  }

  // The answer could be a value that maps to an option label
  const lowerAnswer = question.answer.toLowerCase();
  const matched = condition.values.some((v) =>
    lowerAnswer.includes(v.toLowerCase()),
  );

  return {
    matched,
    weight: 0.8,
    description: matched
      ? `respuesta "${question.answer}" a "${condition.questionId}" coincide con ${condition.values.join(", ")}`
      : `respuesta "${question.answer}" a "${condition.questionId}" no coincide con ${condition.values.join(", ")}"`,
  };
}

// ── Dispatch per condition type ──────────────────────────────────────

function evaluateCondition(
  condition: SkillCondition,
  input: InferenceInput,
): EvalResult {
  switch (condition.type) {
    case "always":
      return evaluateAlways();
    case "business_model_is":
      return evaluateBusinessModel(condition, input.businessModel);
    case "phase_artifact_contains":
      return evaluatePhaseArtifactContains(condition, input.phaseArtifacts);
    case "has_channel_in_bullseye":
      return evaluateHasChannelInBullseye(condition, input.phaseArtifacts);
    case "memory_key_contains":
      return evaluateMemoryKeyContains(condition, input.projectMemory);
    case "quiz_answer_matches":
      return evaluateQuizAnswerMatches(condition, input.phaseQuizAnswers);
    default:
      return { matched: false, weight: 0, description: "condición desconocida" };
  }
}

// ── Main inference ───────────────────────────────────────────────────

export function inferSkills(input: InferenceInput): SkillRecommendation[] {
  return SKILL_CATALOG.map((skill) => {
    const results = skill.conditions.map((c) => evaluateCondition(c, input));

    let matchedWeight = 0;
    let totalWeight = 0;
    const matchedDescs: string[] = [];
    const allDescs: string[] = [];

    for (const r of results) {
      totalWeight += r.weight;
      allDescs.push(r.description);
      if (r.matched) {
        matchedWeight += r.weight;
        matchedDescs.push(r.description);
      }
    }

    const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0;
    const recommended = confidence >= 0.4;

    let reason: string;
    if (recommended) {
      reason = `Recomendado porque ${matchedDescs.join("; ")}`;
    } else {
      reason = `No se detectaron necesidades de ${skill.name} en tu proyecto`;
    }

    return {
      skill,
      confidence,
      matchedConditions: matchedDescs,
      reason,
      recommended,
    };
  });
}
