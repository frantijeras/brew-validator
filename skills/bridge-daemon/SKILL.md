# bridge-daemon

**Rol:** Daemon que conecta la base de datos de Brew con los agentes de OpenClaw.

NO es un agente — es un gestor que orquesta el flujo:
1. Detecta jobs PENDING en Brew
2. Ejecuta la skill correspondiente
3. Envía el resultado al webhook de Brew

## Ejecución

El daemon se ejecuta como proceso permanente en la VPS:
```bash
python3 ~/.openclaw/workspace/skills/bridge-daemon/bridge.py
```

## Flujo

1. Polling cada 10s a `GET brew-validator.vercel.app/api/jobs/pending`
   - Filtra jobs con agentName: skeptic, advocate, judge
   - Toma los primeros 3 jobs

2. Para cada job:
   a. Marcar como RUNNING en Brew (`POST /api/jobs/:id/status`)
   b. Leer la skill correspondiente (`~/.openclaw/workspace/skills/NOMBRE/SKILL.md`)
   c. Ejecutar el agente usando `openclaw agent --local --session-id <unique>` con la skill + contexto
   d. Extraer el JSON de la respuesta
   e. POST resultado al webhook (`POST brew-validator.vercel.app/api/webhooks/agent-callback`)

3. Los agentes se ejecutan SECUENCIALMENTE:
   - Primero skeptic (investiga objeciones)
   - Luego advocate (recibe reporte del skeptic)
   - Finalmente judge (recibe ambos reportes)

## Arquitectura

### Agentes disponibles en OpenClaw

Los únicos agents configurados son: `main`, `content-creator`, `betbot`, `radar`, `arch-master`, `ui-designer`, `codebot`. No hay agents separados para `skeptic`, `judge`, `idea-generator`, etc.

**Por lo tanto, el bridge SIEMPRE ejecuta con `--agent main`**, pero inyecta la skill correspondiente (`idea-generator`, `skeptic`, `judge`, `brew-qa-refiner`, `idea-renamer`) como texto en el prompt. Esto es funcionalmente equivalente a tener agents separados, pero usa el system prompt base de `main` (con SOUL.md, IDENTITY.md, etc.).

### Aislamiento de sesión (CRÍTICO)

Cada job se ejecuta con un `--session-id` único generado como:
```
brew-{agent_name}-{timestamp_ms}-{pid}-{random_hex}
```

**Sin este session-id, el CLI caería en la sesión por defecto del agente `main` (la sesión de Telegram de Arquity), causando contaminación cruzada entre jobs y chats del usuario.**

### Modelos por agente (config en Vercel → DB → archivo)

El bridge usa `resolveModelForJobAgent()` que:
1. Mapea el job agent name → settings key (ver `src/lib/agent-models.ts`)
2. Lee el modelo de la tabla `Setting` (DB de Vercel)
3. Fallback al archivo `agent-models.json` local
4. Fallback al default hardcoded

Defaults:
- `generator`, `skeptic`, `defender`, `refiner` → `opencode-zen-free/deepseek-v4-flash-free`
- `judge` → `opencode-zen-free/big-pickle`

### Tests de aislamiento

Para verificar que el aislamiento funciona correctamente:
```bash
python3 ~/.openclaw/workspace/skills/bridge-daemon/test-isolation.py
```

El test ejecuta 3 ideas diferentes (fitness, comida, finanzas) y verifica:
- ✅ Ninguna menciona palabras de las otras
- ✅ Cada agente usa su modelo configurado

## Detalles técnicos

### Contexto enviado a cada agente

El daemon pasa como contexto el JSON de `Job.input` (que contiene title, description, targetUser, monetization).

Para el advocate, además pasa `skepticReport` con el reporte generado.
Para el judge, pasa `skepticReport` + `advocateReport`.

### Instrucción para el agente

La instrucción combina:
- El SKILL.md (rol, misión, formato de output)
- El contexto del job (idea completa)
- Los reportes previos (si aplica)

### Parsing de output

El agente devuelve markdown con JSON embebido. El daemon extrae:
```json
{
  "reportMarkdown": "...",
  "verdict": "...",
  "suggestedName": "...",
  "scorecard": "..."
}
```

### Callback

El daemon envía POST a:
`brew-validator.vercel.app/api/webhooks/agent-callback`
```json
{
  "jobId": "...",
  "status": "COMPLETED",
  "output": { ... },
  "cost": 0.03
}
```
