# Informe UI/UX y de flujo — 2026-06-24

> Revisión de solo lectura. Foco pedido: **reactividad en tiempo real**, bugs de interfaz y de flujo. Evidencia con `archivo:línea`.

## Veredicto + Health Score: **72/100**

Hay primitivos de UI (`Button`, `Card`, `Modal`) y un mecanismo de reactividad (`useReactivePolling` + `router.refresh()` + `force-dynamic`), pero (a) los primitivos están **infrautilizados** (mucho botón/overlay inline) y (b) la reactividad **no llega a los modales abiertos**, que es justo la queja principal.

| Severidad | Nº hallazgos |
|---|---|
| 🔴 Alta | 1 |
| 🟡 Media | 2 |
| 🟢 Baja | 1 |

## Tabla-resumen

| # | Categoría | Sev | Hallazgo | nº casos |
|---|---|---|---|---|
| 1 | Reactividad/Comportamiento | 🔴 | Los modales usan un snapshot del estado de fase; no se actualizan al refrescar (no "tiempo real") | 2 modales |
| 2 | Componentización | 🟡 | Botones inline duplicados pese a existir `ui/button.tsx` | 61 en 17 archivos |
| 3 | Componentización | 🟡 | Overlays de modal reimplementados pese a existir `ui/modal.tsx` | 10 en 7 archivos |
| 4 | Color/tokens | 🟢 | Hex hardcodeados — pero casi todos en generadores de artefactos (legítimo) | 89 (sólo ~3 en UI) |

---

## 1. 🔴 Reactividad: los modales no reflejan el estado en tiempo real

**Evidencia** (`src/app/(dashboard)/proyectos/[id]/project-phases-with-modal.tsx`):
- Estado local con snapshot: `:333-334` `const [modalPhase] = useState(null)`, `const [substepModalPhase] = useState(null)`.
- Se setean copiando la fase al abrir: `:709` `setSubstepModalPhase({ ...phase, subStepArtifact })`, `:906` idem, `:694/:893` `setModalPhase(phase)`.
- Se consumen directos del snapshot: `:985-987` (`modalPhase.questions`), `:997-1002` (`substepModalPhase.subStepArtifact/subStepChoice/...`).
- El polling refresca `phases` (props del Server Component) → las **tarjetas** se actualizan, pero **no hay efecto que re-sincronice `modalPhase`/`substepModalPhase`** con las `phases` frescas.

**Problema:** mientras un job corre con el modal abierto (típico en Identidad: naming→voice→logo→visual), el modal sigue mostrando el estado viejo (p. ej. "procesando" o el artefacto anterior) hasta cerrar y reabrir. El usuario lo percibe como "no se actualiza en tiempo real" / "atascado".

**Corrección sugerida:** no guardar el snapshot completo; guardar **solo el `id`** de la fase abierta y derivar la fase en cada render desde la lista viva: `const substepModalPhase = phases.find(p => p.id === openSubstepId) ?? null`. Así el polling (`router.refresh()` → nuevas `phases`) re-renderiza el modal con datos frescos. Alternativa mínima: un `useEffect` que, cuando cambian `phases`, actualice `modalPhase/substepModalPhase` buscándolos por id.

---

## 2. 🟡 Botones inline duplicados (existe `ui/button.tsx` pero se usa poco)

**Evidencia:** 61 firmas de botón inline (`inline-flex … rounded … px- py-`) en 17 archivos, p. ej. `ideas/[id]/page.tsx` (9), `project-phases-with-modal.tsx` (10), `phase-substep-modal.tsx` (11), `components/project-row.tsx` (4), `sub-step-card.tsx` (4). Existe `src/components/ui/button.tsx`.

**Problema:** mismo "botón primario ámbar" reescrito decenas de veces → divergencias de padding/radio/estado disabled y coste de cambio alto. **Corrección:** migrar a `<Button variant="primary|secondary|danger">`; empezar por las pantallas de mayor tráfico (ideas, proyecto).

## 3. 🟡 Overlays de modal reimplementados (existe `ui/modal.tsx`)

**Evidencia:** 10 `fixed inset-0` en 7 archivos (`phase-substep-modal.tsx` 2, `project-phases-with-modal.tsx` 3, `phase-questions-modal.tsx`, `content-viewer-modal.tsx`, `settings-form.tsx`, `layout.tsx`) frente a `src/components/ui/modal.tsx`.

**Problema:** cada overlay re-monta backdrop/scroll/escape a mano → comportamiento inconsistente (cierre con backdrop, foco, scroll-lock). **Corrección:** envolver en el `Modal` base; los modales de fase pueden mantener su contenido pero reutilizar la envoltura.

## 4. 🟢 Colores hardcodeados — mayormente legítimos

**Evidencia:** 89 hex en 8 archivos, pero concentrados en **generadores de artefactos** (`lib/brand-colors.ts`, `lib/identity-3d.ts`, `lib/identity-logo.ts`, `lib/identity-visual.ts`, `lib/report-renderer.ts`) que producen SVG/HTML/PDF — ahí el hex es correcto. En UI real solo `globals.css` (2) y `ideas/[id]/page.tsx` (1). **Conclusión:** NO es deuda de tokens relevante; nota positiva.

---

## Quick wins
- **#1 reactividad** (alto impacto, bajo coste): derivar el modal de las `phases` vivas. Es la queja directa del usuario.
- Migrar los ~10 botones de `ideas/[id]/page.tsx` a `<Button>` (pantalla muy usada).

## Recomendaciones de sistema (orden)
1. **Arreglar la reactividad de modales (#1)** — primero.
2. Adoptar `<Button variant>` por pantallas (empezando por ideas y proyecto).
3. Unificar overlays bajo `ui/modal.tsx`.

---

_No se ha modificado código de la app en esta revisión; solo se ha generado este informe._
