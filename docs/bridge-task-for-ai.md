# Tarea completa para la IA del bridge — Brew Validator × OpenClaw

> **Audiencia:** una IA con acceso a dos repositorios:
> 1. **`brew-validator`** — la app Next.js 15 / Prisma / PostgreSQL (Vercel).
> 2. **Bridge / OpenClaw VPS** — el daemon que ejecuta los agentes IA.
>
> Este documento describe TODAS las modificaciones necesarias en el **bridge**
> para que el flujo completo funcione correctamente junto con los cambios ya
> aplicados en `brew-validator`. Lee el documento entero antes de actuar;
> algunas partes dependen de otras.

---

## 0. Contexto — cómo funciona el sistema

```
[brew-validator / Vercel]                    [Bridge / VPS]
  POST /api/projects/execute-phase  ──────►  Crea Job (PENDING) en DB
  GET  /api/jobs/pending           ◄──────── daemon polls cada ~10s
  POST /api/webhooks/project-phase-callback ◄── daemon callback cuando termina
  POST /api/webhooks/agent-callback         ◄── daemon callback para ideas
```

El bridge daemon:
1. Hace `GET /api/jobs/pending` para obtener jobs en estado `PENDING`.
2. Ejecuta el agente IA correspondiente con el `jobInput`.
3. Devuelve el resultado via `POST /api/webhooks/project-phase-callback` (fases
   de proyecto) o `POST /api/webhooks/agent-callback` (ideas: skeptic/advocate/judge).

Cada job tiene un `agentName`. Los agentes de fases de proyecto son:

| `agentName`          | Fase               | ¿Subfases?             |
|----------------------|--------------------|------------------------|
| `project-analyst`    | ANALYSIS           | No (quiz → report)     |
| `project-branding`   | IDENTITY           | **Sí**: naming/voice/visual |
| `project-content`    | CONTENT            | No                     |
| `project-business`   | BUSINESS           | No                     |
| `project-execution`  | EXECUTION          | Sí: `plan_30_60_90` → `final` |
| `project-skills`     | SKILLS             | No                     |

---

## 1. Problema principal — `project-branding` emite las 3 subfases a la vez

### Qué pasa hoy

Cuando `subStep === "naming"`, el agente devuelve un markdown que mezcla
naming + voz + identidad visual en una sola salida. Eso rompe el flujo porque:
- La app espera UNA subfase por llamada.
- El usuario debe elegir una opción de naming **antes** de que se ejecute voice.
- El Brand Book final se construye con las opciones elegidas en cada subfase;
  si todo llega junto, las elecciones se mezclan y el documento sale corrupto.

### Solución requerida

El agente debe respetar el campo `subStep` del `jobInput` y emitir
**exclusivamente** el artefacto de esa subfase. Esto requiere cambiar el
**prompt del sistema** del agente `project-branding` en el bridge.

---

## 2. Cambios en el bridge — lista ejecutable

### 2.1 Prompt del sistema de `project-branding` (OBLIGATORIO)

Añade o reemplaza el system prompt del agente con este texto. El lugar exacto
depende de cómo el bridge inyecta el system prompt (suele ser una constante
`SYSTEM_PROMPT` o una función `buildSystemPrompt` en el archivo del agente):

```
Eres el agente de identidad de marca (project-branding) de Brew Validator.
Trabajas la Fase 3 (IDENTITY) en sub-pasos INDEPENDIENTES. En cada ejecución
recibes UN único `subStep` en el jobInput y debes generar EXCLUSIVAMENTE el
artefacto de ese sub-paso. Está PROHIBIDO adelantar o mezclar otros sub-pasos.

Reglas por sub-paso:

- subStep = "naming":
  Genera SOLO 3 propuestas de nombre de marca con su rationale (origen,
  significado, encaje con el target y el problema). No escribas sobre
  voz/tono, ni sobre colores, tipografías o identidad visual.
  Devuelve un objeto con `subStep: "naming"` y `subStepArtifact.type: "markdown"`.

- subStep = "voice":
  Genera SOLO la voz y el tono de la marca: personalidad, do/don't, 3 ejemplos
  de copy. Usa el `subStepChoice` (nombre elegido) para dar coherencia.
  No propongas nombres ni identidad visual.
  Devuelve un objeto con `subStep: "voice"` y `subStepArtifact.type: "markdown"`.

- subStep = "visual":
  Genera SOLO 3 guías de estilo visual A/B/C en HTML según el contrato de
  identity-visual-spec.md. Usa el nombre y el tono ya elegidos.
  No propongas nombres ni voz.
  Devuelve un objeto con `subStep: "visual"` y `subStepArtifact.type: "html"`.

Respeta SIEMPRE las decisiones de `contextRules` / `projectMemory`: no
preguntes ni reabras temas ya decididos. Usa `previousArtifacts` y
`subStepChoice` como base para mantener coherencia entre sub-pasos.

Devuelve un único objeto JSON con la forma `subStepArtifact` descrita para el
sub-paso recibido. No incluyas texto fuera del JSON.
```

### 2.2 Lógica de dispatch en el bridge (verificar)

Comprueba que el bridge usa `subStep` del `jobInput` para decidir qué prompt
o rama de lógica ejecutar. Si ya tienes un `if/switch` sobre `subStep`, asegura
que los valores `"naming"`, `"voice"`, `"visual"` dirigen a las instrucciones
correctas. Si no existe, crea ese switch.

Ejemplo de estructura esperada:

```js
// Pseudo-código — adapta a tu stack
async function runProjectBranding(jobInput) {
  const { subStep, ideaContext, previousArtifacts, subStepChoice, contextRules, projectMemory } = jobInput;

  const systemPrompt = buildBrandingSystemPrompt(); // el texto del §2.1

  let userPrompt;
  switch (subStep) {
    case "naming":
      userPrompt = buildNamingPrompt(ideaContext, previousArtifacts, contextRules, projectMemory);
      break;
    case "voice":
      userPrompt = buildVoicePrompt(ideaContext, subStepChoice, previousArtifacts, contextRules, projectMemory);
      break;
    case "visual":
      userPrompt = buildVisualPrompt(ideaContext, subStepChoice, previousArtifacts, contextRules, projectMemory);
      break;
    default:
      throw new Error(`Unknown subStep: ${subStep}`);
  }

  const output = await callLLM(systemPrompt, userPrompt, jobInput._bridgeModel);
  return output; // debe tener la forma { subStep, subStepArtifact }
}
```

### 2.3 Shape de salida que espera `brew-validator` (por subfase)

El callback al webhook debe incluir estos campos en `output`:

#### `subStep: "naming"`

```jsonc
{
  "subStep": "naming",
  "subStepArtifact": {
    "type": "markdown",
    "content": "## Opciones de nombre\n\n### 1. <Nombre A>\n<rationale>\n\n### 2. <Nombre B>\n...",
    "options": [
      { "value": "Nombre A", "label": "Nombre A — <gancho corto>" },
      { "value": "Nombre B", "label": "Nombre B — <gancho corto>" },
      { "value": "Nombre C", "label": "Nombre C — <gancho corto>" }
    ]
  }
}
```

- `content`: markdown con 3 propuestas y rationale. **Solo nombres.**
  Máx. ~6 KB. Si supera 8 KB, el webhook lanza un warning de salida monolítica.
- `options`: exactamente 3 objetos; `value` es el nombre tal cual (sin gancho).

#### `subStep: "voice"`

```jsonc
{
  "subStep": "voice",
  "subStepArtifact": {
    "type": "markdown",
    "content": "## Voz y tono\n\n**Personalidad:** ...\n**Tono:** ...\n**Hacer / Evitar:** ...\n**Ejemplos:** ...",
    "options": [
      { "value": "cercano",    "label": "Cercano y directo" },
      { "value": "experto",    "label": "Experto y riguroso" },
      { "value": "inspirador", "label": "Inspirador y aspiracional" }
    ]
  }
}
```

- `content`: SOLO voz y tono. Máx. ~6 KB.
- `options`: los 3 arquetipos de tono para que el usuario elija.

#### `subStep: "visual"`

```jsonc
{
  "subStep": "visual",
  "subStepArtifact": {
    "type": "html",
    "content": "{\"options\":[{\"variant\":\"A\",\"html\":\"<!DOCTYPE html>...\",\"meta\":{\"name\":\"...\",\"primaryColor\":\"#...\",\"secondaryColor\":\"#...\",\"fontHeading\":\"...\",\"fontBody\":\"...\",\"mood\":\"...\"}},{\"variant\":\"B\",...},{\"variant\":\"C\",...}]}"
  }
}
```

- `content`: **string JSON** (ya serializado) con `{ options: [A, B, C] }`.
- Cada variante: `variant` (A/B/C), `html` (HTML5 autocontenido, <50 KB,
  sin scripts externos ni imágenes remotas) y `meta` con los 6 campos.
- NO incluir `options` en el nivel superior del artefacto para visual
  (las variantes están dentro del JSON de `content`).
- Especificación completa en `docs/identity-visual-spec.md` del repo
  `brew-validator`.

---

### 2.4 Autenticación opcional — `BRIDGE_SECRET` (seguridad, P2)

`brew-validator` ahora soporta un secreto compartido opt-in. Si se configura:

**En `brew-validator` (Vercel env vars):**
```
BRIDGE_SECRET=<un-secreto-largo-y-aleatorio>
```

**En el bridge (VPS env vars):**
```
BREW_VALIDATOR_SECRET=<el-mismo-secreto>
```

El bridge debe enviar el header en TODAS las llamadas salientes a
`brew-validator`:
```
Authorization: Bearer <BREW_VALIDATOR_SECRET>
```

Esto aplica a:
- `GET /api/jobs/pending`
- `POST /api/webhooks/project-phase-callback`
- `POST /api/webhooks/agent-callback`

Si `BRIDGE_SECRET` NO está configurado en `brew-validator` (vacío o ausente),
los endpoints aceptan cualquier petición (compatible hacia atrás, no rompe nada
si aún no lo has configurado). **Puedes aplicar este cambio de forma incremental:**
primero actualiza el bridge para que envíe el header, luego pon el secreto en
Vercel.

Código de referencia del lado de brew-validator (para entender qué verificas):
```typescript
// src/lib/bridge-auth.ts
export function verifyBridgeSecret(req: Request): boolean {
  const secret = process.env.BRIDGE_SECRET;
  if (!secret) return true; // no configurado → permitir (compatible)
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return token.length > 0 && token === secret;
}
```

---

### 2.5 `project-execution` — subfase `plan_30_60_90` (verificar)

La fase EXECUTION también tiene subfases:
- `plan_30_60_90` (order 0): Plan de acción 30/60/90 días. Artefacto markdown.
- `final` (order 1): Simulación económica. Artefacto markdown. Completa la fase.

El agente `project-execution` debe seguir el mismo patrón que `project-branding`:
un `subStep` por llamada, emitir solo ese artefacto. Verifica que:
- Si `subStep === "plan_30_60_90"`, emite **solo** el plan de acción (no la simulación).
- Si `subStep === "final"`, emite la simulación económica y el reporte final.

El webhook ya maneja `plan_30_60_90` como subfase intermedia (igual que naming/voice/visual).

---

### 2.6 Estructura del `jobInput` completa (referencia)

Esto es lo que `brew-validator` envía en el campo `input` del Job (serializado
como JSON). El bridge lo deserializa para construir los prompts:

```typescript
{
  mode: "questions" | "report",     // IDENTITY siempre usa "report"
  subStep: string | null,           // "naming" | "voice" | "visual" | "plan_30_60_90" | "final" | null
  subStepOrder: number | null,      // 0=naming,1=voice,2=visual,3=final para IDENTITY
  projectId: string,
  phaseId: string,
  phaseType: string,                // "IDENTITY" | "EXECUTION" | "ANALYSIS" | ...
  ideaContext: {
    title: string,
    description: string,
    problem: string,
    valueProposition: string,
    targetUser: string,
    monetization: string,
    businessModel: string,
    verdict: string,
    score: number,
    judgeReport: string,            // máx 3000 chars del reporte del judge
  },
  previousArtifacts: Array<{        // artefactos de fases anteriores COMPLETADAS
    title: string,
    content: string,
  }>,
  projectMemory: object,            // decisiones tomadas en el proyecto
  contextRules: string,             // instrucciones sobre qué NO renegociar
  _bridgeModel: string,             // modelo a usar (ej. "gpt-4o", "claude-opus-4")
  // Solo presentes cuando viene de SUBSTEP_READY:
  answers?: Record<string, string>, // respuestas del usuario al quiz previo
  subStepChoice?: string | null,    // opción elegida en la subfase anterior
  previousSubStep?: string,         // id de la subfase anterior
}
```

---

## 3. Cambios en `brew-validator` ya aplicados (NO los toques)

Estos cambios ya están en el repo `brew-validator`. Los listo para que
entiendas el contrato completo, no para que los vuelvas a aplicar:

- **`prisma/schema.prisma`**: campo `subStepHistory Json?` en `ProjectPhase`.
  Guarda la elección de cada subfase como `{ naming: {choice, artifact, confirmedAt}, voice: {...}, visual: {...} }`.
  La migración está en `prisma/migrations/20260611_add_substep_history/`.

- **`src/app/api/projects/[id]/phases/[phaseId]/substep/choose/route.ts`**:
  Acumula en `subStepHistory` (sin sobrescribir) antes de lanzar el siguiente job.

- **`src/lib/identity-brandbook.ts`**: helper `extractIdentityChoices(phase)` que
  lee de `subStepHistory` para construir el Brand Book. Fallback a `subStepArtifact`/`subStepChoice`
  para compatibilidad con datos anteriores.

- **Webhook `project-phase-callback`**: añade warning si detecta salida monolítica
  (content > 8 KB o contiene marcadores de otras subfases).

- **Hook `useReactivePolling`**: refresco inmediato al volver el foco a la pestaña.

- **Skills "Saltar"**: corregido, acepta `skillIds: []` como skip explícito.

---

## 4. Migración de base de datos (si no está aplicada)

Ejecuta esto contra la base de datos PostgreSQL (Neon) de producción:

```sql
ALTER TABLE "ProjectPhase" ADD COLUMN IF NOT EXISTS "subStepHistory" JSONB;
```

O con Prisma CLI desde el directorio de `brew-validator`:
```bash
npx prisma migrate deploy
```

El archivo de migración ya existe en
`prisma/migrations/20260611_add_substep_history/migration.sql`.

---

## 5. Checklist de verificación

Después de aplicar los cambios del bridge, haz estas pruebas:

### Test 1 — `project-branding` emite solo una subfase

1. Crea un proyecto con idea validada.
2. Ejecuta la Fase 3 (IDENTITY). El primer job debe ser `subStep: "naming"`.
3. Inspecciona el output del agente: debe contener **solo** nombres (sin "voz",
   "tono", "paleta", "tipografía", "estilo visual") y un array `options` con
   exactamente 3 entradas.
4. El contenido no debe superar ~8 KB.

### Test 2 — Flujo completo naming → voice → visual

1. Elige una opción de naming (A/B/C o texto libre).
2. El siguiente job debe ser `subStep: "voice"`. Output: solo voz y tono.
3. Elige una opción de voice.
4. El siguiente job debe ser `subStep: "visual"`. Output: `type: "html"`, `content`
   es JSON válido con `options: [{variant: "A",...}, {variant: "B",...}, {variant: "C",...}]`.
5. Elige una variante visual.
6. La fase pasa a `COMPLETED`. En la DB, `subStepHistory` debe tener las 3 claves:
   `naming`, `voice`, `visual`, cada una con `choice` y `artifact`.

### Test 3 — Brand Book usa las opciones elegidas

1. Tras completar el Test 2, descarga el hand-off (`/api/projects/:id/handoff`).
2. El ZIP debe incluir `03-identidad-marca.md`.
3. Ábrelo y verifica que:
   - El nombre que aparece es el que elegiste en naming (no "A", no JSON).
   - La sección de voz usa el texto del artefacto de voice.
   - La sección visual refleja la variante elegida.

### Test 4 — Reintento de subfase fallida (sin reiniciar desde naming)

1. Fuerza un fallo en `voice` (por ejemplo, desconecta momentáneamente el
   modelo durante esa subfase).
2. La fase debe quedar en `AVAILABLE` con `subStep: "voice"` en la DB.
3. En la UI, la card de `voice` debe aparecer como "disponible" (no "bloqueada").
   Las cards de `naming` deben aparecer como "completadas" (no "disponibles").
4. Pulsa "Ejecutar" en la card de `voice`. El job debe ser `subStep: "voice"`,
   NO `naming`. El historial de naming se preserva intacto.

### Test 5 — Autenticación (si configuras `BRIDGE_SECRET`)

1. Pon `BRIDGE_SECRET=test-secret-123` en Vercel.
2. Configura el bridge para enviar `Authorization: Bearer test-secret-123`.
3. Verifica que los jobs se procesan normalmente.
4. Quita el header del bridge y confirma que los endpoints devuelven 401.
5. Borra `BRIDGE_SECRET` de Vercel — los endpoints deben volver a aceptar
   peticiones sin header (retrocompatibilidad).

---

## 6. Archivos del bridge a modificar (resumen)

Adapta los nombres a tu estructura real:

| Archivo del bridge (estimado)              | Qué cambiar                                    |
|--------------------------------------------|------------------------------------------------|
| `agents/project-branding/prompt.ts` (o similar) | System prompt (§2.1) + switch por subStep (§2.2) |
| `agents/project-branding/naming.ts`        | Prompt de usuario para `subStep: "naming"`     |
| `agents/project-branding/voice.ts`         | Prompt de usuario para `subStep: "voice"`      |
| `agents/project-branding/visual.ts`        | Prompt de usuario para `subStep: "visual"`. Consultar `docs/identity-visual-spec.md` en brew-validator |
| `agents/project-execution/prompt.ts`       | Verificar separación `plan_30_60_90` / `final` (§2.5) |
| `lib/api-client.ts` (o similar)            | Añadir header `Authorization: Bearer` (§2.4)   |

---

## 7. Notas de diseño (por si el bridge usa tools/function-calling)

Si el agente usa function-calling en lugar de JSON libre, el contrato es el
mismo pero el tool debe llamarse algo como `submit_substep_artifact` con el
mismo schema. El webhook de `brew-validator` acepta el artefacto en cualquiera
de estos campos del output del job (los comprueba en orden):

1. `parsedOutput.subStepArtifact` — objeto `{ type, content, options? }`
2. `parsedOutput.subStepArtifactJson` — igual
3. Si hay `parsedOutput.content` + (`parsedOutput.options` o `parsedOutput.type === "html"`) → los envuelve como artefacto

Si ninguno de estos está presente pero hay `parsedOutput.reportMarkdown` o
`parsedOutput.content`, el webhook crea un artefacto mínimo sin opciones
(el usuario verá el contenido pero tendrá que escribir su elección manualmente).
