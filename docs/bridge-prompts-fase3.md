# Fase 3 (IDENTITY) — contrato de prompts para el agente `project-branding`

> **Audiencia:** la IA / persona que mantiene el agente `project-branding`
> (o la *skill* equivalente) en el repo del **bridge** (VPS). Este documento
> NO es código de `brew-validator`; es la especificación que el agente debe
> cumplir para que la Fase 3 funcione correctamente.
>
> **Problema que resuelve:** hoy, al ejecutar el sub-paso `naming`, el agente
> a veces devuelve **las 3 sub-fases de golpe** (naming + voz + visual) en una
> sola salida. Eso rompe el flujo: cada sub-paso debe generarse por separado,
> el usuario elige una opción, y solo entonces se habilita el siguiente.

---

## 1. Cómo funciona la Fase 3 (contexto)

La Fase 3 se presenta al usuario como **4 sub-pasos secuenciales**:

| order | subStep  | Qué genera el agente                                  | Modo     |
|-------|----------|-------------------------------------------------------|----------|
| 0     | `naming` | 3 nombres de marca + rationale                        | `report` |
| 1     | `voice`  | Voz y tono de la marca                                | `report` |
| 2     | `visual` | 3 guías de estilo visual A/B/C (HTML)                 | `report` |
| 3     | `final`  | (no lo genera el agente) — la app consolida el Brand Book | —    |

Flujo por sub-paso: **ejecutar → el usuario revisa/elige una opción → se
lanza el siguiente sub-paso**. El sub-paso a ejecutar llega SIEMPRE en el
`jobInput` (`subStep` + `subStepOrder`). El agente **debe respetarlo** y emitir
**solo** el artefacto de ese sub-paso.

> La app ya guarda la elección de cada sub-paso por separado
> (`ProjectPhase.subStepHistory`) y consolida el Brand Book final a partir de
> las **opciones elegidas** (no del proceso). El agente NO genera el Brand Book.

---

## 2. Input que recibe el agente (`jobInput`)

```jsonc
{
  "mode": "report",                 // la Fase 3 siempre usa "report"
  "subStep": "naming",              // "naming" | "voice" | "visual" — EL ÚNICO sub-paso a generar
  "subStepOrder": 0,                // 0 | 1 | 2
  "phaseType": "IDENTITY",
  "ideaContext": { /* idea, target, problema, propuesta de valor, etc. */ },
  "previousArtifacts": [            // artefactos confirmados de sub-pasos previos
    { "title": "SubStep naming", "content": "..." }
  ],
  "projectMemory": { /* decisiones previas */ },
  "contextRules": "…",              // NO preguntes sobre decisiones ya tomadas
  "subStepChoice": "Nombre elegido",// presente cuando se viene de elegir el sub-paso anterior
  "previousSubStep": "naming"
}
```

**Regla de oro:** el valor de `subStep` manda. Si `subStep === "naming"`,
genera SOLO naming. Nunca incluyas voz ni visual en esa respuesta.

> La app, por su parte, fuerza el `subStep` esperado y **descarta** un `subStep`
> distinto reclamado por el agente, pero **no** puede partir un markdown que
> mezcle las 3 sub-fases. Por eso el agente debe emitir solo una.

---

## 3. Salida esperada por sub-paso

La app acepta el artefacto en `subStepArtifact` **o** como
`content` (+ `options` / `type`). Forma canónica:

### 3.1 `subStep: "naming"`

```jsonc
{
  "subStep": "naming",
  "subStepArtifact": {
    "type": "markdown",
    "content": "## Opciones de nombre\n\n### 1. <Nombre A>\n<rationale…>\n\n### 2. <Nombre B>\n…",
    "options": [
      { "value": "Nombre A", "label": "Nombre A — <gancho corto>" },
      { "value": "Nombre B", "label": "Nombre B — <gancho corto>" },
      { "value": "Nombre C", "label": "Nombre C — <gancho corto>" }
    ]
  }
}
```

- `content`: markdown con las 3 propuestas y su rationale (origen, significado,
  encaje con el target). **Solo nombres.** Nada de voz/tono ni colores/tipografías.
- `options`: exactamente las 3 opciones elegibles (`value` = el nombre tal cual).

### 3.2 `subStep: "voice"`

```jsonc
{
  "subStep": "voice",
  "subStepArtifact": {
    "type": "markdown",
    "content": "## Voz y tono\n\n**Personalidad:** …\n**Tono:** …\n**Hacer / Evitar:** …\n**Ejemplos de copy:** …",
    "options": [
      { "value": "cercano", "label": "Cercano y directo" },
      { "value": "experto", "label": "Experto y riguroso" },
      { "value": "inspirador", "label": "Inspirador y aspiracional" }
    ]
  }
}
```

- `content`: SOLO voz y tono (personalidad, do/don't, ejemplos de copy).
  Nada de nombres ni de identidad visual.
- `options`: opcional pero recomendado (los arquetipos de tono elegibles).

### 3.3 `subStep: "visual"`

Contrato detallado en [`identity-visual-spec.md`](identity-visual-spec.md).
Resumen:

```jsonc
{
  "subStep": "visual",
  "subStepArtifact": {
    "type": "html",
    "content": "{\"options\":[{\"variant\":\"A\",\"html\":\"<!DOCTYPE html>…\",\"meta\":{…}}, … B, C]}"
  }
}
```

- `content` es un **string JSON** con `{ options: [A, B, C] }`. Cada opción:
  `variant` (A/B/C), `html` (documento HTML5 autocontenido <50 KB, sin scripts
  ni imágenes remotas) y `meta` (`name`, `primaryColor`, `secondaryColor`,
  `fontHeading`, `fontBody`, `mood`).
- SOLO identidad visual. Nada de nombres ni de voz.

---

## 4. System prompt sugerido (plantilla)

Inyecta algo equivalente a esto en el system del agente, además de
`contextRules` y `projectMemory`:

```text
Eres el agente de identidad de marca (project-branding) de Brew Validator.
Trabajas la Fase 3 en sub-pasos INDEPENDIENTES. En cada ejecución recibes
UN único `subStep` en el input y debes generar EXCLUSIVAMENTE el artefacto de
ese sub-paso. Está PROHIBIDO adelantar o mezclar otros sub-pasos.

- subStep = "naming": genera SOLO 3 propuestas de nombre con su rationale y un
  array `options` con las 3. NO escribas sobre voz/tono ni sobre colores,
  tipografías o estilo visual.
- subStep = "voice": genera SOLO la voz y el tono (personalidad, do/don't,
  ejemplos de copy). NO propongas nombres ni identidad visual.
- subStep = "visual": genera SOLO 3 guías de estilo A/B/C en HTML según el
  contrato de identity-visual-spec.md. NO propongas nombres ni voz.

Respeta SIEMPRE las decisiones de `contextRules` / `projectMemory`: no
preguntes ni reabras temas ya decididos. Usa `previousArtifacts` y
`subStepChoice` (la opción elegida en el sub-paso anterior) como base para
mantener coherencia entre sub-pasos.

Devuelve un único objeto JSON con la forma `subStepArtifact` indicada para el
sub-paso recibido. No incluyas texto fuera del JSON.
```

---

## 5. Checklist de validación (para quien ajuste el bridge)

- [ ] Ejecutar `naming` → la salida contiene **solo** nombres + `options` (3).
      No aparece "voz", "tono", "paleta", "tipografía" ni "estilo visual".
- [ ] Ejecutar `voice` → solo voz/tono; usa el nombre elegido (`subStepChoice`)
      para dar ejemplos coherentes.
- [ ] Ejecutar `visual` → `type:"html"`, `content` es JSON con 3 variantes A/B/C
      válidas (ver `identity-visual-spec.md`).
- [ ] En ningún sub-paso el `content` supera ~8 KB de texto plano (naming/voice)
      — la app registra un warning si lo detecta como señal de salida monolítica.
- [ ] El agente nunca genera el sub-paso `final`: la app consolida el Brand Book
      a partir de las opciones elegidas (`subStepHistory`).
