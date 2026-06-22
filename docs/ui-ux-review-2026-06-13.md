# Informe de revisión UI/UX — brewidea
**Fecha:** 2026-06-13 · **Alcance:** `src/app/**` + `src/components/**` (toda la UI) · **Modo:** solo lectura (no se modificó código de la app)

---

## 1. Veredicto y Design-System Health Score

### 🟠 Health Score: **45 / 100**

El proyecto **tiene** algunos primitivos compartidos (`confirm-modal`, `kebab-menu`, `toast/`, `skeletons/`), pero **no se usan de forma consistente** y faltan las piezas centrales: **no hay componente `Button` ni `Card`, ni una paleta de color semántica**. El resultado es deuda estructural amplia: el mismo botón/tarjeta/modal se reimplementa inline decenas de veces con variantes divergentes, y acciones equivalentes se comportan distinto según la pantalla. No es un problema de "un padding suelto": es la **ausencia de un sistema** lo que genera la inconsistencia en cascada.

**Conteo de hallazgos:** 🔴 6 altas · 🟡 6 medias · 🟢 2 bajas

---

## 2. Tabla-resumen

| # | Categoría | Sev. | Hallazgo | nº casos |
|---|-----------|------|----------|----------|
| 1 | A. Componentización | 🔴 | No existe `Button`; estilo de botón reimplementado inline con variantes divergentes | 40+ |
| 2 | A. Componentización | 🔴 | No existe `Card`; patrón `rounded-xl border ... bg-slate-950/60 p-5` duplicado | 30+ |
| 3 | D. Layout | 🔴 | Acción primaria/confirmación NO siempre a la derecha (Cancelar a la derecha) | 6 modales |
| 4 | C. Comportamiento | 🔴 | "Eliminar/Quitar" con UX distinta (modal simple vs confirmación por tipeo vs rollback) | 3 |
| 5 | B. Color | 🔴 | Sin paleta semántica: mismo rol con valores divergentes (amber/red/superficies) | global |
| 6 | E. Accesibilidad | 🔴 | Contraste insuficiente: `text-red-300/70` sobre `slate-900` (~2.8:1, falla WCAG AA) | varios |
| 7 | A. Componentización | 🟡 | Overlays de modal montados a mano en vez de un `Modal` base; z-index/backdrop dispares | ~8 |
| 8 | A. Componentización | 🟡 | Loading: `animate-pulse`/`Loader2` inline en vez de `Skeleton`/`Spinner` existentes | 6+ |
| 9 | A. Componentización | 🟡 | Feedback: `toast/` existe pero hay toasts/banners caseros con `setTimeout` | 3 |
| 10 | C. Comportamiento | 🟡 | Texto inconsistente para la misma acción (Guardar/Aplicar/Confirmar; Cancelar/Cerrar) | varios |
| 11 | B. Color | 🟡 | Hex/rgb hardcodeados en HTML/PDF generados sin centralizar | identity-3d, pdf-export, report-renderer |
| 12 | D. Layout | 🟡 | Icono de cierre/cancelar mezclado (`X` en headers vs `XCircle` en botones) | 4 |
| 13 | E. Accesibilidad | 🟡 | Cobertura baja de `aria-label` en botones-icono y de `focus-visible` | global |
| 14 | D. Layout | 🟢 | Radios/paddings/tamaños de icono dispares en elementos equivalentes (p-5 vs p-6; size-7/9) | varios |

---

## 3. Hallazgos detallados

### 🔴 #1 — No existe un componente `Button` (estilos inline divergentes)
**Categoría A · 40+ casos**

No hay `src/components/button.tsx`. Cada pantalla reescribe el mismo rol de botón con clases distintas. Para el **primario ámbar**:
- `project-phases-with-modal.tsx:250` → `... rounded-lg bg-amber-500 px-4 py-2 ...`
- `rename-modal.tsx:128` → `... bg-amber-500 px-4 py-2.5 ... shadow`
- `refine-quiz-modal.tsx:675` → `... bg-amber-500 px-4 py-3 ...`
- `settings-form.tsx:102` → `... bg-amber-500 px-4 py-2.5 ...`

Para el **peligro**: `project-row.tsx:276` y `project-header-menu.tsx:129` usan `bg-red-600`, pero `project-phases-with-modal.tsx:1110` usa `bg-red-500`.

**Problema:** padding (`py-2`/`2.5`/`3`), `shadow`, `transition-colors` y el tono de rojo varían sin criterio → botones que deberían ser idénticos se ven distintos, y cualquier cambio global obliga a tocar 40+ sitios.
**Corrección:** crear `<Button variant="primary|secondary|danger|ghost" size>` y migrar. Es la pieza de mayor impacto del informe.

---

### 🔴 #2 — No existe un componente `Card`
**Categoría A · 30+ casos**

El patrón `rounded-xl border border-slate-800 bg-slate-950/60 p-5` se repite en, p. ej., `project-tabs.tsx:316,403,517`, `validation-progress.tsx:56`, `version-history.tsx:239`, `report-viewer.tsx:84`, `settings-form.tsx:474,685`, `ideas/new/page.tsx:104,119,137`, `content-subpage.tsx:223`. Aparecen variantes incoherentes: `border-slate-700`, `bg-slate-800/40`, `border-slate-700/60 bg-slate-900/40`, `p-4` vs `p-5`.
**Corrección:** `<Card>` (+ variantes `muted`/`accent`) con superficie, borde, radio y padding canónicos.

---

### 🔴 #3 — La acción primaria/confirmación no siempre va a la derecha
**Categoría D · 6 modales**

Estándar pedido: **confirmar/primario a la derecha, Cancelar a la izquierda**. Lo cumplen `confirm-modal.tsx` y `phase-questions-modal.tsx` (Atrás izq / Siguiente der). **No lo cumplen** (Cancelar queda a la derecha del primario):
- `project-phases-with-modal.tsx:1038-1063` (modal "Editar decisiones": Guardar izq / Cancelar der)
- `project-phases-with-modal.tsx:1106-1134` (rollback fase) y `:1175-1186` (rollback sub-paso)
- `settings-form.tsx:197-215` (editar perfil)
- `project-row.tsx:272-296` (borrar proyecto)
- `rename-modal.tsx:124-148` (Guardar izq / Cancelar der)

**Problema:** rompe la convención de lectura; el usuario espera la acción de avance a la derecha.
**Corrección:** fijar el orden en un footer de `Modal` base (`[Secundario] [Primario]`, `justify-end` o `justify-between` con Atrás a la izquierda).

---

### 🔴 #4 — "Eliminar / Quitar / Rehacer" con UX divergente
**Categoría C · 3 patrones**

- `idea-card.tsx` → borra con `ConfirmModal` simple.
- `project-row.tsx:272-296` → borra proyecto con **confirmación por tipeo** del nombre.
- `project-phases-with-modal.tsx:1106-1134/1175-1186` → rollback con modal de advertencia rojo propio.

**Problema:** acciones destructivas con fricción distinta y aspecto distinto. El usuario no aprende un patrón único.
**Corrección:** definir 2 niveles canónicos —(a) destructivo estándar = `ConfirmModal` rojo; (b) destructivo crítico = confirmación por tipeo— y aplicarlos por severidad, no por pantalla.

---

### 🔴 #5 — Sin paleta de color semántica (mismo rol, valores divergentes)
**Categoría B · global**

`tailwind.config.ts` no define colores; `globals.css` solo `--background/--foreground`. Conteos sobre `src/**/*.tsx`:
- Acento: **`amber-500` ×186**, `amber-400` ×139, `amber-300` ×30, `amber-600` ×22.
- Peligro: **`red-400` ×49** vs **`red-500` ×38** vs `red-300` ×10 — sin regla de cuándo cada uno.
- Superficies: `slate-900/40`, `/60`, `/70`, `slate-950/60` mezcladas para el mismo tipo de panel.

**Problema:** "primario" y "peligro" no tienen un valor único → micro-inconsistencias por toda la app y reskin imposible.
**Corrección:** definir tokens semánticos en `tailwind.config.ts` (`primary`, `danger`, `surface`, `surface-muted`, `border`, `muted`) y migrar las clases crudas.

---

### 🔴 #6 — Contraste insuficiente (texto rojo translúcido sobre fondo oscuro)
**Categoría E · varios**

`phase-card.tsx` (bloque de error, `text-[11px] text-red-300/70`) sobre `slate-900` da ≈2.8:1 → **falla WCAG AA (4.5:1)**. Patrón similar con `text-slate-500/600` para texto informativo sobre fondos oscuros.
**Corrección:** usar `text-red-300` (sin `/70`) o `text-red-400` con opacidad plena para texto de error; revisar mínimos de contraste de los grises de texto.

---

### 🟡 #7 — Overlays de modal reimplementados a mano
**Categoría A · ~8**

Existen `confirm-modal`, `rename-modal`, `content-viewer-modal`, pero montan el overlay a mano: `refine-quiz-modal.tsx:448`, `skill-selector.tsx:215`, `project-phases-with-modal.tsx:989/1106/1175`, `phase-questions-modal.tsx:202`, `project-header-menu.tsx:90`, `phase-substep-modal.tsx:891/1071/1141`, `settings-form.tsx:775`, `version-history.tsx:359`. Inconsistencias: `z-50` vs `z-[55]` vs `z-[60]`; `bg-black/50` vs `/60` vs `/70`; unos con backdrop separado y otros inline.
**Corrección:** un `<Modal>` base (overlay, z-index, backdrop, foco, ESC, scroll-lock, header/footer) y migrar todos.

---

### 🟡 #8 — Estados de carga no usan los primitivos existentes
**Categoría A · 6+**

Existen `skeletons/` y `spinner.tsx`, pero hay `animate-pulse`/`Loader2` inline: `skill-selector.tsx:142,193`, `project-tabs.tsx:203`, `content-viewer-modal.tsx:65`, `rename-modal.tsx:132`, varios en `phase-substep-modal.tsx`.
**Corrección:** usar `Spinner`/`Skeleton` siempre; `skill-selector` debería reusar `PhaseCardSkeleton`.

---

### 🟡 #9 — Dos sistemas de feedback en paralelo
**Categoría A · 3**

Hay `components/toast/` con provider, pero `skill-selector.tsx:60-67` implementa un toast casero (`setTimeout` + `fixed bottom-6 right-6 z-50`), `phase-substep-modal.tsx:244` un banner propio (`z-[60]`) y `settings-form.tsx:470` un estado "Guardado" ad-hoc.
**Corrección:** centralizar en el `toast` provider; unificar posición y z-index.

---

### 🟡 #10 — Texto inconsistente para la misma acción
**Categoría C · varios**

- Guardar/confirmar: "Guardar" (`rename-modal`), "Guardar cambios" (`settings-form`), "Aplicar"/"Aplicar cambios" (`refine-quiz-modal`), "Confirmar" (`confirm-modal`).
- Cerrar/cancelar: "Cancelar" / "Cerrar" / "Volver".
- Borrar: "Eliminar" (`idea-card`) vs "Borrar proyecto" (`project-row`).
- Descargar: "Descargar todo" / "Descargar PDF" / "Descargar .zip" / "Descargar HTML/SVG".
**Corrección:** glosario de microcopy: 1 verbo por intención (Guardar = persistir; Aplicar = cambios en vivo; Eliminar = destructivo).

---

### 🟡 #11 — Hex/rgb hardcodeados en HTML/PDF generados
**Categoría B**

`identity-3d.ts` (`#0F172A`, `#F8FAFC`, `rgba(0,0,0,.08)`, `#1e293b`, `#fff`), `pdf-export.ts:110-115` (`C_ACCENT = [180,130,20]`, grises), `report-renderer.ts` (`#1f2937`, `#6b7280`, `#111827`). En jsPDF el RGB es inevitable, pero hoy cada generador define su propia paleta.
**Corrección:** un módulo único de tokens de marca (hex) consumido por los tres generadores, alineado con la paleta semántica de la app.

---

### 🟡 #12 — Icono de cierre/cancelar mezclado
**Categoría D · 4**

`X` en headers de modal (bien), pero `XCircle` como botón "Cancelar"/cerrar en `project-phases-with-modal.tsx:857`, `refine-idea-section.tsx:965,1035`, `project-tabs.tsx:298`.
**Corrección:** `X` para cerrar, `XCircle` solo para "cancelar proceso en curso" (o unificar a uno).

---

### 🟡 #13 — Accesibilidad: aria-label y focus-visible escasos
**Categoría E · global**

Cobertura baja de `focus:`/`focus-visible` (~29 ocurrencias en toda la UI); `confirm-modal.tsx` sin focus ring ni `disabled:` styles; algunos botones-icono solo con `title`.
**Corrección:** estilos de foco en el `Button` base; `aria-label` obligatorio en botones-icono; `disabled:` en todas las variantes.

---

### 🟢 #14 — Radios/paddings/iconos dispares
**Categoría D**

`confirm-modal` usa `p-6` mientras otras tarjetas/modales usan `p-5`; botones-icono `size-7` (kebab) vs `size-9` (notification-bell) sin `size-8` intermedio; iconos de botón `size-3.5` vs `size-4`.
**Corrección:** escala fija (paddings 4/5/6; iconos 4/5; botones-icono 7/9) aplicada vía componentes.

---

## 4. Quick wins (bajo coste, alto impacto)
1. Corregir el contraste de `text-red-300/70` en `phase-card.tsx` (#6) — cambio de 1 clase, evita fallo de accesibilidad.
2. Voltear el orden de botones en los 6 modales del #3 a `[Cancelar] [Primario]`.
3. Sustituir el toast casero de `skill-selector` por el `toast` provider (#9).
4. Reemplazar los `animate-pulse`/`Loader2` inline por `Skeleton`/`Spinner` (#8).
5. Unificar `XCircle`→`X` en botones de cierre de header (#12).

## 5. Recomendaciones de sistema (en orden)
1. **`Button` base** con variantes/tamaños/estados (foco, disabled) → ataca #1, #3, #13, #14.
2. **Tokens de color semánticos** en `tailwind.config.ts` + módulo de marca para PDF/HTML → #5, #11, #6.
3. **`Modal` base** (overlay, z-index, backdrop, foco, footer con orden canónico) → #3, #7, #12.
4. **`Card` base** → #2, #14.
5. **Glosario de microcopy** y **patrón único de confirmación destructiva** → #4, #10.
6. Migrar feedback y loading a los primitivos existentes → #8, #9.

---

> **Nota:** Esta revisión es **solo lectura**: no se ha modificado ningún componente, estilo ni configuración de la app. El único archivo generado es este informe. Las líneas citadas son representativas del patrón; conviene confirmarlas al abordar cada refactor.
