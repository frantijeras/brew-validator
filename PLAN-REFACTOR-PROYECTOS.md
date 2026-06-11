# Plan de refactor del flujo "Proyectos" — robustez del Bridge + UX

> Documento de continuación cross-sesión. Si una sesión se queda sin contexto,
> retoma desde aquí: cada bloque (U1–U10) es autocontenido y mergeable por su PR.
> Estado vivo en la tabla del final.

## Objetivo

Endurecer y completar el flujo "Proyectos" (5 fases) según el spec profesional:
error-handling granular del **Bridge** (Puente con las APIs de IA — Inteligencia
Artificial), feedback multi-capa al usuario, validación estructurada (JSON/Zod)
con reintentos y planes de contingencia (fallbacks), rollback en cascada,
densidad de contexto, UX asíncrona, y refactor por fusión de los prompts de las
skills (desplegados por SSH — Protocolo de shell seguro — al VPS — Servidor
privado virtual).

## Arquitectura (recordatorio)

- **App**: Next.js 15 + React 19 + TypeScript + Prisma 5 (PostgreSQL/Neon) +
  NextAuth 5 + Zod 4 + Tailwind. Alias de import `@/*` → `src/*`.
- **Bridge**: daemon OpenClaw remoto en el VPS (`46.225.80.127:9090`). La app
  encola `Job` (PENDING) y recibe resultados por webhooks
  (`/api/webhooks/project-phase-callback`, `/api/webhooks/agent-callback`).
  El **reintento real** (re-llamar al modelo) ocurre en el daemon; la app define
  la política y surfacea el estado al usuario.
- **Skills (prompts)**: viven en el VPS en `/root/.openclaw/workspace/skills/*/SKILL.md`.
  Copias versionadas en `docs/skills-backup/`. Agentes por fase:
  `project-analyst` (Fase 1), `project-business` (Fase 2), `project-branding`
  (Fase 3), `project-content` (Fase 4), `project-execution` (Fase 5).

## Reglas transversales (TODAS las unidades)

1. **Regla lingüística**: cada sigla/tecnicismo lleva su significado en español
   entre paréntesis la primera vez. Ej: `TAM (Mercado total disponible)`.
2. **Salidas estructuradas**: la IA nunca devuelve markdown libre para renderizar
   UI; se valida con Zod y se reintenta de forma transparente al romper esquema.
3. **Seguridad**: cero secretos en código/logs/respuestas. Todo por variables de
   entorno.
4. **Fuente única de errores**: `src/lib/phase-errors.ts`
   (`ErrorCategory`, `resolveErrorType`, `getErrorMeta`).
5. **Fusión, no borrado**: al tocar prompts, combinar lo mejor de la versión
   actual con las directrices nuevas.

## Verificación E2E (cada unidad)

```
npm install
npx prisma generate
npm run smoke   # OJO: 153/163 en Windows; las 10 fallas de ZIP-extract son
                # pre-existentes (usan rm -rf "/tmp/...", sintaxis Unix). No son
                # regresiones. Verifica que tu nº de fallas no AUMENTE.
npm run lint    # solo deben quedar warnings pre-existentes
npm run build   # debe quedar verde (typecheck completo)
```

## Bloques de trabajo

### U1 — Cimientos: schema + libs core ✅ (en `main` local / PR `feat/u1-cimientos-bridge`)
- `prisma/schema.prisma`: modelo `Notification` (capa 4) + `BridgeLog.schemaVersion`.
- Migración `20260612_add_notifications_and_schema_version`.
- `src/lib/phase-schemas.ts`: Zod del output de IA (quiz/report) +
  `safeParsePhaseOutput()` + `coerceJsonObject()` (corrección heurística).
- `src/lib/bridge-retry.ts`: backoff exponencial, `isRetryable`/`isCritical`,
  `RESOLUTION_ACTION`.
- `src/lib/user-messages.ts`: mensajes exactos por categoría (fuente única).
- `src/lib/critical-alert.ts`: `dispatchCriticalAlert()` (Notification + webhook).

### U2 — Endurecimiento del callback del Bridge
- `src/app/api/webhooks/project-phase-callback/route.ts`,
  `src/app/api/webhooks/agent-callback/route.ts`.
- Integrar `safeParsePhaseOutput`; al romper esquema → reintento con instrucción
  de formato; si falla → corrección heurística → si no, `invalid_response`.
- **Fix bug**: `category: "agent_error"` (no es `ErrorCategory`) → `empty_response`/`unknown`.
- `empty_response`: flag `simplifiedRetry` para reintento con prompt simplificado.
- `resolutionAction` real en `BridgeLog`. Llamar `dispatchCriticalAlert` si `retryCount >= 3`.

### U3 — Toast/Snackbar (Feedback capa 1)
- `src/components/toast/{toast-provider,toast,use-toast}.tsx` + montaje en layout.
- Color por severidad (rojo/amarillo/azul), texto desde `user-messages.ts`.

### U4 — Panel "Historial de Errores" (Feedback capa 3)
- `src/app/api/projects/[id]/bridge-logs/route.ts` (GET autenticado),
  `error-history-panel.tsx`, wiring en `project-tabs.tsx`.
- Lee `BridgeLog` por proyecto: tipo, hora, reintentos, acción, estado, telemetría.

### U5 — Alertas críticas + notificaciones in-app (Feedback capa 4 UI)
- `src/app/api/webhooks/critical-alert/route.ts`, `src/app/api/notifications/route.ts`,
  `src/components/notification-bell.tsx` + montaje en header.
- Lee/marca `Notification` (modelo de U1).

### U6 — UX asíncrona: skeletons/spinners por componente
- `src/components/skeletons/*`, `phase-card.tsx`.
- Estado de carga por fase/sub-paso para auto-triggers ("cocinando en 2º plano").

### U7 — Validación JSON + fallback de dominios (Fase 3)
- `src/app/api/domains/check/route.ts`, `sub-step-card.tsx`.
- Timeout por lookup; `degraded:true` cuando falla la verificación externa; UI de
  contingencia sin bloquear el flujo.

### U8 — Parser de densidad de contexto
- `src/lib/phase-context-parser.ts`, integración en `src/lib/bridge/phase-jobs.ts`.
- Extraer SOLO resultados consolidados de fases previas (no hilos de quiz/logs).

### U9 — Rollback en cascada
- `src/app/api/projects/[id]/phases/[phaseId]/rollback/route.ts`,
  `project-phases-with-modal.tsx`.
- Rehacer fase X → purgar BDD (fases con `sortOrder > X` a `LOCKED`, limpiar
  artifacts/questions/subStep*) + invalidar estado global del frontend.

### U10 — Refactor por fusión de prompts de skills (deploy SSH = coordinador)
- `docs/skills-backup/*.md` (analyst, business, branding, content, execution).
- Fusionar prompt actual + directrices nuevas: orden estricto de cada informe,
  salidas JSON, regla lingüística, calidad SVG (Gráficos vectoriales) semántico
  con `viewBox` + variables de color + cero CSS externo (logo/estilo Fase 3).
- Deploy: backup en Git → escribir en VPS por SSH → limpiar backups obsoletos.

## Propiedad de archivos (evitar colisiones en el fan-out)
| Archivo | Dueño |
|---|---|
| `prisma/schema.prisma` + migraciones | U1 |
| `webhooks/project-phase-callback`, `agent-callback` | U2 |
| layout dashboard (ToastProvider) | U3 |
| `project-tabs.tsx` | U4 |
| header dashboard (campanita) | U5 |
| `phase-card.tsx` | U6 |
| `domains/check`, `sub-step-card.tsx` | U7 |
| `phase-jobs.ts` | U8 |
| `project-phases-with-modal.tsx` | U9 |
| `docs/skills-backup/*` | U10 |

## Estado
| # | Unidad | Estado | PR |
|---|--------|--------|----|
| U1 | Cimientos schema+libs | ✅ hecho | feat/u1-cimientos-bridge |
| U2 | Callback Bridge | ⏳ fan-out | — |
| U3 | Toast/Snackbar | ⏳ fan-out | — |
| U4 | Panel historial | ⏳ fan-out | — |
| U5 | Alertas + notif | ⏳ fan-out | — |
| U6 | Skeletons | ⏳ fan-out | — |
| U7 | Dominios fallback | ⏳ fan-out | — |
| U8 | Parser contexto | ⏳ fan-out | — |
| U9 | Rollback cascada | ⏳ fan-out | — |
| U10 | Prompts skills + SSH | ⏳ coordinador | — |

> Nota: `gh` no está instalado en este entorno. Las ramas se pushean y el PR se
> abre desde la URL que devuelve GitHub. Mergea primero U1 para que los PRs de
> U2–U9 queden limpios al rebasar.
