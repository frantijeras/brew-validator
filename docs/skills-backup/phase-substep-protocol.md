# phase-substep-protocol — Backup

> Referencia tecnica — protocolo de sub-pasos interactivos

> **BACKUP — solo lectura**
> Este archivo es una copia de referencia de la skill activa en el VPS (OpenClaw).
> La version en uso esta en el VPS en `/root/.openclaw/workspace/skills/phase-substep-protocol/SKILL.md`.
> **No edites este archivo** para cambiar el comportamiento del agente — hazlo directamente en el VPS o
> pide a la IA que tenga acceso SSH que aplique los cambios.
> Ultima sincronizacion: 2026-06-12

---

# phase-substep-protocol

**Documento técnico de referencia** sobre cómo el bridge maneja fases con sub-pasos interactivos (como branding, content y business). No es una skill que se cargue como agente — es la especificación que el dev (CodeBot, agente de desarrollo) debe seguir al implementar la UI (Interfaz de usuario) multi-step y los endpoints.

## ✍️ Regla lingüística OBLIGATORIA (siglas y tecnicismos)

Aunque este documento es técnico, los textos que las skills generen para el usuario final deben cumplir la regla transversal: cada sigla o tecnicismo lleva su significado en español entre paréntesis **la primera vez que aparece** (UI (Interfaz de usuario), SVG (Gráficos vectoriales redimensionables), HEX (Sistema hexadecimal), OKR (Objetivos y resultados clave), LTV (Valor de vida del cliente), CAC (Coste de adquisición de cliente), etc.). Esta especificación lo refuerza para todas las fases con sub-pasos.

## 🔒 Salidas estructuradas estrictas (regla transversal)

Toda skill que produzca un sub-paso responde SIEMPRE con el JSON exacto del modo correspondiente (`mode: "questions"` o `mode: "report"`), sin texto fuera del JSON y sin markdown libre que rompa el tipado del frontend. El contenido del informe va dentro de `reportMarkdown`; los artefactos intermedios (HTML, SVG, naming) van dentro de `subStepArtifact`. El bridge valida que la respuesta sea JSON parseable antes de persistirla.

## ¿Por qué existen sub-pasos?

Ciertas fases no se pueden resolver con "1 quiz + 1 informe final". Requieren **decisión humana entre cada paso** porque generan artefactos visuales o выбор que no se puede iterar sin re-generar el output anterior.

**Fases con sub-pasos:**
- Fase 3 (Branding / Identidad de Marca): naming (quiz → 3 nombres + campo manual) → voice (sin quiz, propuesta + refinamiento iterativo) → logo (12 logos SVG, Gráficos vectoriales redimensionables) → visual (quiz → 3 estilos HTML A/B/C) → final / hand-off (entrega) (**5 sub-pasos**)
- Fase 4 (Content / Distribución y Tracción): quiz → pilares → estrategia + skill final (**3 jobs**)

**Fases sin sub-pasos (1 quiz + 1 report):**
- Fase 1 (Análisis Estratégico — Fundamentos y Mercado): 1 quiz + 1 report largo (orden estricto: DAFO → Porter → TAM/SAM/SOM → Lean Canvas → Buyer Persona → Propuesta de Valor)
- Fase 2 (Viabilidad Financiera): 1 quiz + 1 report (orden estricto: Modelo de Ingresos → Pricing → Unit Economics → LTV/CAC → 3 Escenarios)
- Fase 5 (Roadmap 30/60/90): 1 quiz + 1 report compilador (orden estricto: Hoja de ruta → OKRs 30 → OKRs 60 → OKRs 90)

> NOTA: el orden de fases del producto evolucionó. Fase 2 es ahora Viabilidad Financiera (antes parte iba en una fase de negocio posterior) y Fase 5 cierra con el Roadmap 30/60/90. Las fases internamente pueden seguir teniendo más de un job aunque el usuario vea "1 quiz + 1 informe".

## Estados extendidos del ProjectPhase

El modelo `ProjectPhase` necesita nuevos estados para representar el flujo multi-step:

```typescript
enum PhaseStatus {
  LOCKED,        // No disponible
  AVAILABLE,     // Disponible para iniciar
  PROCESSING,    // Job corriendo
  QUESTIONING,   // Tiene preguntas que responder
  SUBSTEP_READY, // Sub-paso completado, esperando decisión/artefacto del usuario
  COMPLETED,     // Fase terminada
  FAILED         // Error
}
```

**`SUBSTEP_READY`** es el nuevo estado clave. Significa: "el agente generó un artefacto intermedio (ej: 3 mockups visuales, 3 escenarios), el usuario tiene que revisarlo y elegir/confirmar antes de que el siguiente job pueda arrancar".

## Modelo de datos extendido

Añadir al schema Prisma:

```prisma
model ProjectPhase {
  // ... campos existentes
  subStep         String?   // "quiz" | "naming" | "mockup" | "final" (etc.)
  subStepArtifact Json?     // Artefacto intermedio (HTML mockup, markdown de naming, etc.)
  subStepChoice   String?   // Lo que eligió el usuario (ej: "A", "B", "C" o el nombre elegido)
}
```

`previousArtifacts` ya existe en el input del job y se alimenta automáticamente desde `subStepArtifact` + `subStepChoice` del sub-paso anterior.

## Flujo de UI multi-step

Cuando una fase tiene sub-pasos:

1. El usuario hace click en "Ejecutar" (estado `AVAILABLE`).
2. La fase pasa a `PROCESSING` y arranca el **Job 1 (quiz)**.
3. Cuando termina el quiz, la fase pasa a `QUESTIONING` con las preguntas en `questions`.
4. El usuario responde el quiz → arranca el **Job 2 (sub-proceso)** → fase pasa a `PROCESSING`.
5. Cuando termina el Job 2, la fase pasa a **`SUBSTEP_READY`** con `subStepArtifact` poblado.
6. **La UI muestra el artefacto intermedio** (ej: mockup HTML en un iframe, opciones A/B/C como botones).
7. El usuario elige o itera:
   - Si elige A/B/C → guarda `subStepChoice` → arranca **Job 3 (siguiente sub-paso)** → fase pasa a `PROCESSING`.
   - Si pide iterar → genera un nuevo job del mismo sub-paso con feedback adicional.
8. Cuando todos los sub-pasos terminan, fase pasa a `COMPLETED` con el artefacto final en `artifacts`.

## Endpoints nuevos

| Endpoint | Método | Propósito |
|---|---|---|
| `/api/projects/[id]/phases/[phaseId]/substep/artifact` | GET | Devuelve el artefacto intermedio (`subStepArtifact`) y las opciones |
| `/api/projects/[id]/phases/[phaseId]/substep/choose` | POST | El usuario eligió (ej: `{choice: "A"}` o `{choice: "Tallow & Glow"}`) → arranca siguiente job |
| `/api/projects/[id]/phases/[phaseId]/substep/iterate` | POST | El usuario pidió iterar → re-genera el sub-paso con feedback |
| `/api/projects/[id]/rename` | POST | Renombra `idea.title` y `project.name` cuando se confirma el nombre en Fase 2 |

### Body de `/api/projects/[id]/phases/[phaseId]/substep/choose`

```json
{
  "choice": "A" | "B" | "C" | "nombre personalizado",
  "nextSubStep": "mockup" | "final" | null
}
```

### Body de `/api/projects/[id]/phases/[phaseId]/substep/iterate`

```json
{
  "feedback": "Me gusta A pero con la paleta de C y tipografía más bold"
}
```

### Body de `/api/projects/[id]/rename`

```json
{
  "newName": "Tallow & Glow"
}
```

**Campos actualizados en cascada:**
- `idea.title` (raíz)
- `project.name` (proyecto)
- Las menciones dentro de los `artifacts` de fases previas se quedan como estaban (histórico), pero las fases futuras reciben el nombre nuevo en el contexto.

## Cambios en el bridge

El bridge (`src/app/api/projects/execute-phase/route.ts`) debe:

1. Aceptar `subStep` en el input para saber qué job ejecutar.
2. Devolver el `subStep` correspondiente en cada respuesta para que la UI sepa qué mostrar.
3. Cuando se invoca con `mode: "report"` y `subStep` intermedio (ej: `naming`, `voice`, `logo` o `visual`), el output se guarda en `subStepArtifact` (no en `artifacts`) hasta que se complete la fase.
4. Cuando se confirma la elección del sub-paso (`/substep/choose`), se crea un nuevo job con `subStep: "nextSubStep"` o `subStep: "final"` según corresponda.

## Cambios en la UI (`project-phases-with-modal.tsx`)

- Nuevo estado intermedio: cuando `phase.status === "SUBSTEP_READY"`, mostrar el botón "Revisar [tipo]" en lugar de "Descargar".
- El botón "Revisar" abre un **modal de sub-paso** (distinto del modal de preguntas) que muestra:
  - El artefacto (HTML en iframe si es preview visual, o markdown renderizado si es naming)
  - 3 botones de opción (A, B, C) o input libre si es naming
  - Botón "Iterar" con campo de texto para feedback
- Cuando el usuario elige, se cierra el modal y la fase pasa a `PROCESSING` (siguiente job).

## Convenciones de nombrado

- `subStep` en el job: lowercase, kebab-friendly. Valores en uso: `"quiz"`, `"naming"`, `"voice"`, `"logo"`, `"visual"`, `"pilars"`, `"final"`.
- `subStepChoice`: el valor crudo que eligió el usuario (`"A"`, `"Tallow & Glow"`, nombre manual escrito por el usuario, etc.).
- `subStepArtifact`: objeto JSON con `{type: "html" | "markdown", content: "...", options?: [{value, label}], allowManualInput?: boolean}`.
  - `allowManualInput: true` (sub-paso `naming`): la UI muestra, además de los botones A/B/C, **1 campo de texto** para que el usuario escriba un nombre propio.
  - En `logo` el `content` es un documento HTML único con los 12 logos SVG; en `visual` el `content` es JSON con 3 `options` (A/B/C) para el preview en iframe.

## Resumen de implementación

| Capa | Cambios |
|---|---|
| Schema Prisma | Añadir `subStep`, `subStepArtifact`, `subStepChoice` a `ProjectPhase` |
| Bridge | Aceptar `subStep` en input, devolverlo en output, manejar sub-pasos en cascada |
| Endpoints | 4 nuevos: artifact, choose, iterate, rename |
| UI modal | Nuevo modal de sub-paso (artefacto + elección + iterar) |
| UI tarjeta | Nuevo estado `SUBSTEP_READY` con botón "Revisar [tipo]" |
| Skills | Las skills de fase con sub-pasos (branding con 5 sub-pasos: naming/voice/logo/visual/final; content con 3 jobs) ya están actualizadas con la lógica de jobs, la regla lingüística y las salidas estructuradas estrictas |

## Reglas de oro

1. **Si la fase tiene sub-pasos, NO se puede saltar al final sin pasar por todos.** Forzado por el bridge.
2. **Cada sub-paso produce un artefacto descargable** además del output final.
3. **El usuario siempre puede iterar** (volver a generar el sub-paso) antes de avanzar. En `voice` (branding) el refinamiento iterativo por conversación es el modo principal de trabajo (no hay quiz).
4. **El cambio de nombre se confirma explícitamente** en la UI antes de propagar a `idea.title` y `project.name`. El nombre puede venir de A/B/C o del campo manual (`allowManualInput`).
5. **Salidas estructuradas estrictas:** cada sub-paso responde con el JSON exacto del modo, sin texto fuera del JSON. El bridge rechaza respuestas no parseables.
6. **Regla lingüística:** los textos para el usuario llevan cada sigla/tecnicismo con su significado en español entre paréntesis la primera vez.
7. **Orden estricto del informe:** las fases con orden de secciones fijado (1, 2, 4, 5) deben respetarlo EXACTAMENTE — es un requisito duro del producto, no una sugerencia.
8. **Caracteres españoles UTF-8** con tildes y ñ correctos en todos los textos generados.
