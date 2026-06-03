export interface ReformulateInput {
  title: string;
  description: string;
  targetUser: string;
  monetization: string;
}

interface ParsedPrompt {
  newFocusTarget: string | null;
  newMonetization: string | null;
  newTitle: string | null;
  toneModifier: string | null;
  addFeature: string | null;
  removeElement: string | null;
  otherInstructions: string;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Parse the user's prompt to extract structured reformulation directives.
 */
function parsePrompt(prompt: string): ParsedPrompt {
  const lower = prompt.toLowerCase().trim();

  const focusPatterns = [
    /enfoc[áa]te?\s*(?:m[áa]s\s*)?en\s+(.+?)(?:[.,;]|$)/i,
    /(?:cambia|orienta|dirige)\s+(?:el\s+)?(?:foco|target|enfoque|p[úu]blico|audiencia|usuario\s+objetivo)\s+(?:a|hacia|para)?\s+(.+?)(?:[.,;]|$)/i,
    /(?:para|audiencia|usuarios?|target|p[úu]blico)\s+(?:de\s+)?(.+?)(?:[.,;]|$)/i,
  ];

  const monetizationPatterns = [
    /(?:modelo de negocio|monetizaci[óo]n|forma de cobrar|pricing)\s+(?:a|como|sea|pasa a ser)?\s+(.+?)(?:[.,;]|$)/i,
    /(?:cambia|cambiar)\s+(?:la\s+)?(?:monetizaci[óo]n|forma de cobrar)\s+(?:a|por)\s+(.+?)(?:[.,;]|$)/i,
    /(.+?)\s*(?:modelo|plan)\s+(?:de\s+)?suscripci[óo]n/i,
    /(.+?)\s*(?:modelo\s+)?freemium/i,
    /(.+?)\s*(?:pago\s+)?[úu]nico/i,
  ];

  const titlePatterns = [
    /ll[áa]mal[oa]\s+"?(.+?)"?$/i,
    /c[áa]mbiale?\s+(?:el\s+)?nombre\s+(?:a|por)\s+"?(.+?)"?$/i,
    /(?:ll[áa]mal[oa]|ren[óo]mbral[oa]|cambia\s+el\s+t[íi]tulo)\s+(?:a|como|por)?\s+"?(.+?)"?$/i,
  ];

  let newFocusTarget: string | null = null;
  let newMonetization: string | null = null;
  let newTitle: string | null = null;

  for (const pattern of focusPatterns) {
    const m = prompt.match(pattern);
    if (m && m[1]?.trim()) {
      newFocusTarget = m[1].trim().replace(/[.,;]+$/, "");
      break;
    }
  }

  for (const pattern of monetizationPatterns) {
    const m = prompt.match(pattern);
    if (m && m[1]?.trim()) {
      newMonetization = capitalize(m[1].trim().replace(/[.,;]+$/, ""));
      break;
    }
  }

  for (const pattern of titlePatterns) {
    const m = prompt.match(pattern);
    if (m && m[1]?.trim()) {
      newTitle = m[1].trim().replace(/^["']|["']$/g, "");
      break;
    }
  }

  return {
    newFocusTarget,
    newMonetization,
    newTitle,
    toneModifier: null,
    addFeature: null,
    removeElement: null,
    otherInstructions: prompt,
  };
}

/**
 * Reformulate an idea based on the user's free-text prompt.
 * Uses pattern matching and template interpolation — no external AI call.
 */
export function reformulateIdea(
  input: ReformulateInput,
  prompt: string
): ReformulateInput {
  const parsed = parsePrompt(prompt);

  let title = input.title;
  let description = input.description;
  let targetUser = input.targetUser;
  let monetization = input.monetization;

  // 1. Title
  if (parsed.newTitle) {
    title = parsed.newTitle;
  } else if (parsed.newFocusTarget) {
    // Append focus to title if it doesn't already contain it
    const focusLower = parsed.newFocusTarget.toLowerCase();
    if (!title.toLowerCase().includes(focusLower)) {
      title = `${title} para ${capitalize(parsed.newFocusTarget)}`;
    }
  }

  // 2. Target user
  if (parsed.newFocusTarget) {
    targetUser = capitalize(parsed.newFocusTarget);
  }

  // 3. Monetization
  if (parsed.newMonetization) {
    monetization = parsed.newMonetization;
  }

  // 4. Description — synthesize a new description using the prompt
  const promptLower = prompt.toLowerCase().trim();
  description = buildDescription(input, {
    newTitle: parsed.newTitle,
    newFocusTarget: parsed.newFocusTarget,
    newMonetization: parsed.newMonetization,
    rawPrompt: prompt,
  });

  return { title, description, targetUser, monetization };
}

function buildDescription(
  original: ReformulateInput,
  changes: {
    newTitle: string | null;
    newFocusTarget: string | null;
    newMonetization: string | null;
    rawPrompt: string;
  }
): string {
  const parts: string[] = [];

  // Start with the reformulated concept
  const conceptName = changes.newTitle || original.title;
  const focus = changes.newFocusTarget;

  if (focus && changes.newMonetization) {
    parts.push(
      `${conceptName} es una plataforma enfocada en ${focus}. ` +
        `Ofrece soluciones específicas adaptadas a sus necesidades, ` +
        `con un modelo de negocio basado en ${changes.newMonetization.toLowerCase()}.`
    );
  } else if (focus) {
    parts.push(
      `${conceptName} es una plataforma diseñada específicamente para ${focus}. ` +
        `Proporciona herramientas y análisis adaptados a las necesidades ` +
        `particulares de este segmento, ayudándoles a tomar mejores decisiones.`
    );
  } else if (changes.newMonetization) {
    parts.push(
      `${conceptName} es una ${original.description.toLowerCase().startsWith("plataforma") ? "" : "plataforma que "}${original.description.toLowerCase().replace(/^(una?\s+)?plataforma\s+(que\s+)?/, "")}` +
        ` El modelo de negocio se basa en ${changes.newMonetization.toLowerCase()}, ` +
        `asegurando un flujo de ingresos recurrente y escalable.`
    );
  } else {
    // Generic rewrite based on the prompt instructions
    parts.push(
      `${conceptName} — reformulado según las indicaciones proporcionadas. ` +
        capitalize(changes.rawPrompt.replace(/[.,;]+$/, "")) +
        `. ${original.description}`
    );
  }

  return parts.join(" ").trim();
}
