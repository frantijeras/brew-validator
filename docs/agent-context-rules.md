# Agent Context Rules — Especificación para el Bridge

> **Objetivo:** Los agentes de proyecto (project-analyst, project-branding, etc.) NO deben preguntar al usuario sobre temas que YA han sido decididos en fases anteriores. Deben leer `projectMemory` y `contextRules` del `jobInput` y usarlos como base.

---

## 1. Campos disponibles en el jobInput

Cada job enviado al bridge contiene dos campos nuevos:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `projectMemory` | `Record<string, MemoryEntry>` | Memoria acumulativa de decisiones del proyecto. Cada entrada tiene: `value`, `source` (fase), `updatedAt`, `rationale?`. |
| `contextRules` | `string` | Texto pre-formateado con reglas para el agente. Contiene las decisiones previas listadas con "NO PREGUNTES ESTO". |

Ejemplo de `projectMemory`:

```json
{
  "target": {
    "value": "jóvenes 18-25, urbanos, España",
    "source": "01",
    "updatedAt": "2026-06-07T10:30:00Z",
    "rationale": "Mayor penetración de smartphones y disposición a probar nuevas apps"
  },
  "channels": {
    "value": ["TikTok", "Instagram"],
    "source": "02",
    "updatedAt": "2026-06-07T11:00:00Z"
  }
}
```

Ejemplo de `contextRules`:

```markdown
## Decisiones previas del proyecto (NO PREGUNTES ESTO)

Las siguientes decisiones YA han sido tomadas en fases anteriores.
**NO preguntes NUNCA sobre estos temas.** En su lugar, usa estos valores
como base para tus propuestas.

- **target**: jóvenes 18-25, urbanos, España (decidido en fase 01)
  - Por qué: Mayor penetración de smartphones y disposición a probar nuevas apps
- **channels**: ["TikTok","Instagram"] (decidido en fase 02)

### Reglas de consistencia
- Si una decisión previa entra en conflicto con una nueva observación,
  propón actualizarla (no la ignores).
- Todas tus propuestas DEBEN ser coherentes con las decisiones previas.
- Si no hay suficiente información en las decisiones previas para un tema
  concreto, pregunta SOLO sobre ese tema. No preguntes lo que ya sabes.
```

---

## 2. Cómo debe usar el bridge estos campos

### Opción A: Si el bridge inyecta `contextRules` directamente en el prompt del agente ✅ (Recomendado)

El `contextRules` ya viene formateado como texto listo para incluir en el prompt. El bridge debe:

1. Leer `jobInput.contextRules`
2. Inyectarlo al final del system prompt, antes de las instrucciones de la fase
3. **No** modificar ni reinterpretar el texto

```
System Prompt = [Instrucciones del agente] + "\n\n" + [contextRules]
```

### Opción B: Si el bridge quiere construir su propio formato a partir de `projectMemory`

El bridge puede usar `projectMemory` directamente para construir su propio prompt. Debe seguir las mismas reglas:

- Listar TODAS las entradas de `projectMemory` como "decisiones previas"
- Indicar claramente que NO se deben preguntar estos temas
- Incluir el rationale si existe
- Añadir las reglas de consistencia

---

## 3. Regla de oro: "última prevalece"

El `projectMemory` ya respeta esta regla cuando se escribe (ver `mergeProjectMemory` en `src/lib/project-memory.ts`). Cuando el bridge reciba las respuestas del agente y actualice el memory, debe usar `mergeProjectMemory` con `source` = el código de la fase correspondiente.

Ejemplo tras la fase 01 (Análisis):

```typescript
const updated = mergeProjectMemory(currentMemory, {
  target: { value: "jóvenes 18-25", source: "01", updatedAt: now, rationale: "..." },
  channels: { value: ["TikTok", "Instagram"], source: "01", updatedAt: now },
}, "01");
```

---

## 4. Fases y sus códigos de source

| Código | Fase |
|--------|------|
| `"01"` | Análisis de Mercado |
| `"02"` | Estrategia de Negocio |
| `"03"` | Identidad de Marca |
| `"04"` | Estrategia de Distribución |
| `"05"` | Landing Page |
| `"06"` | Roadmap 30/60/90 |
| `"user"` | Override manual del usuario |

---

## 5. Comportamiento esperado del agente

Con `contextRules` en su prompt, el agente debe:

### ✅ Hacer esto
- Proponer 3 nombres que encajen con el `target` sin preguntar "¿cuál es tu público objetivo?"
- Proponer canales de contenido basados en `channels` sin preguntar "¿qué canal prefieres?"
- Si necesita más info de la que hay en memoria, preguntar SOLO sobre lo que falta

### ❌ NO hacer esto
- "¿Cuál es tu público objetivo?" ← YA está en `target`
- "¿Qué canales de marketing prefieres?" ← YA está en `channels`
- "¿Qué tono de comunicación buscas?" ← YA está en `tone`
- Ignorar las decisiones previas y proponer opciones contradictorias

---

## 6. Ejemplo completo de flujo

```
Fase 01 (Análisis):
  Agente investiga → propone target="jóvenes 18-25", channels=["TikTok"]
  → Se guarda en Project.memory con source="01"

Fase 02 (Identidad - Naming):
  Agente recibe contextRules con "target: jóvenes 18-25" y "channels: TikTok"
  → NO pregunta target ni channels
  → Propone: "Basado en tu target joven (18-25) y TikTok como canal principal,
     aquí tienes 3 opciones de nombre: 1) VibeCheck 2) Trendzy 3) PulseApp"
  → El usuario elige
  → Se guarda en Project.memory con source="02"

Fase 03 (Contenido):
  Agente recibe contextRules con target y channels DE LA FASE 01 + naming DE LA FASE 02
  → NO pregunta nada ya decidido
  → Propone estrategia de contenido coherente con TODO
```
