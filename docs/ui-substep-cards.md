# Especificación de Diseño — Sub-step Cards (Brew Validator)

> **Documento de diseño UI/UX para CoderBot**  
> **Proyecto:** Brew Validator (Next.js + Tailwind CSS)  
> **Fecha:** 2025-06-08  
> **Versión:** 1.0  
> **Autor:** UIDesigner (subagente)

---

## 1. Resumen Ejecutivo

Se rediseña la visualización de **sub-steps** dentro de cada fase del proyecto. Actualmente se muestran como badges de progreso (`subProgress`) o barras horizontales (`miniProgressBar`). Se requiere transformarlos en **cards anidadas independientes** con número, nombre, descripción, indicador de estado y botón de acción propio.

Las sub-cards viven **dentro** de la card padre (`PhaseCard`), debajo de la descripción y antes de las acciones globales de la fase.

---

## 2. Sistema de Diseño (Tokens)

### 2.1 Paleta de Colores (existente, a mantener)

| Token | HEX | Uso |
|-------|-----|-----|
| `--slate-950` | `#020617` | Fondo de cards |
| `--slate-900` | `#0f172a` | Fondo de sub-cards |
| `--slate-800` | `#1e293b` | Bordes, hover backgrounds |
| `--slate-700` | `#334155` | Bordes sutil, separadores |
| `--slate-600` | `#475569` | Texto deshabilitado |
| `--slate-500` | `#64748b` | Texto secundario, descripciones |
| `--slate-400` | `#94a3b8` | Texto terciario |
| `--slate-300` | `#cbd5e1` | Texto body |
| `--slate-200` | `#e2e8f0` | Texto primario claro |
| `--amber-500` | `#f59e0b` | Acciones primarias, botón principal |
| `--amber-400` | `#fbbf24` | Hover de botón primario |
| `--green-500` | `#22c55e` | Completado, éxito |
| `--green-400` | `#4ade80` | Hover completado |
| `--purple-500` | `#a855f7` | Sub-step ready, IDENTITY |
| `--purple-400` | `#c084fc` | Hover sub-step ready |
| `--blue-500` | `#3b82f6` | Fases disponibles, info |
| `--cyan-500` | `#06b6d4` | BUSINESS |
| `--orange-500` | `#f97316` | EXECUTION |
| `--rose-500` | `#f43f5e` | DOSSIER |

### 2.2 Tipografía

| Elemento | Font | Size | Weight | Color |
|----------|------|------|--------|-------|
| Título de sub-card | System UI | `text-sm` (14px) | `font-semibold` (600) | `text-white` / `text-slate-400` (locked) |
| Número de sub-card | System UI | `text-xs` (12px) | `font-bold` (700) | heredado del tono de fase |
| Descripción sub-card | System UI | `text-xs` (12px) | `font-normal` (400) | `text-slate-500` |
| Estado badge | System UI | `text-[10px]` (10px) | `font-medium` (500) | variable por estado |
| Botón sub-card | System UI | `text-xs` (12px) | `font-medium` (500) | variable por estado |

### 2.3 Espaciado (grid 8px)

| Token | Valor | Uso |
|-------|-------|-----|
| `space-y-3` | 12px | Gap entre fases |
| `space-y-2` | 8px | Gap entre sub-cards dentro de una fase |
| `p-4` | 16px | Padding interno de sub-card |
| `p-3` | 12px | Padding interno reducido (móvil) |
| `mt-4` | 16px | Separador entre descripción de fase y sub-cards |
| `gap-2` | 8px | Gap entre elementos dentro de sub-card |
| `gap-1.5` | 6px | Gap icono-texto |

### 2.4 Bordes y Radios

| Token | Valor | Uso |
|-------|-------|-----|
| `rounded-xl` | 12px | Card padre |
| `rounded-lg` | 8px | Sub-card |
| `rounded-md` | 6px | Botones, badges |
| `rounded-full` | 999px | Badges de estado, indicadores |
| `border` | 1px | Sub-card border |
| `border-slate-800` | #1e293b | Border por defecto sub-card |
| `border-slate-700` | #334155 | Border hover sub-card |

### 2.5 Sombras

| Token | Valor | Uso |
|-------|-------|-----|
| `shadow-sm` | sutil | Sub-card en estado active/available |
| `shadow-none` | — | Sub-card locked (aplanada) |

---

## 3. Definición de Sub-steps por Fase

### 3.1 Tabla Maestra de Sub-steps

| Fase | ID de Fase | Sub-steps | Orden |
|------|-----------|-----------|-------|
| **ANALYSIS** | Fase 01 | `quiz` → `report` | (implícito, no muestra cards) |
| **BUSINESS** | Fase 02 | `quiz` (1), `final` (2) | 2 sub-steps |
| **IDENTITY** | Fase 03 | `naming` (1), `voice` (2), `visual` (3), `final` (4) | 4 sub-steps |
| **CONTENT** | Fase 04 | `quiz` (1), `pilars` (2), `final` (3) | 3 sub-steps |
| **DEVELOPMENT** | Fase 05 | `quiz` (1), `compare` (2), `final` (3) | 3 sub-steps |
| **EXECUTION** | Fase 06 | `quiz` (1), `simulate` (2), `final` (3) | 3 sub-steps |

### 3.2 Metadatos de Cada Sub-step (para UI)

```typescript
// Definición de sub-steps por fase (NUEVO — a implementar en lib/)
export interface SubStepMeta {
  id: string;
  order: number;          // 0-based
  label: string;           // "Nombre", "Voz y Tono", etc.
  description: string;    // Breve descripción del sub-step
  icon: string;            // Nombre del icono Lucide (ej. "Type", "MessageSquare", etc.)
}

export const PHASE_SUBSTEPS: Record<string, SubStepMeta[]> = {
  IDENTITY: [
    { id: "naming",  order: 0, label: "Nombre",      description: "Elige el nombre de tu proyecto",           icon: "Type" },
    { id: "voice",   order: 1, label: "Voz y Tono",  description: "Define la personalidad de tu marca",       icon: "MessageSquare" },
    { id: "visual",  order: 2, label: "Estilo Visual", description: "Fuentes, colores e identidad visual",     icon: "Palette" },
    { id: "final",   order: 3, label: "Brand Book",  description: "Documento final con toda la identidad",    icon: "BookOpen" },
  ],
  BUSINESS: [
    { id: "quiz",    order: 0, label: "Cuestionario", description: "Responde preguntas clave de negocio",       icon: "HelpCircle" },
    { id: "final",   order: 1, label: "Plan de Negocio", description: "Documento final consolidado",         icon: "BriefcaseBusiness" },
  ],
  CONTENT: [
    { id: "quiz",    order: 0, label: "Cuestionario", description: "Estrategia de contenido",                  icon: "HelpCircle" },
    { id: "pilars",  order: 1, label: "Pilares de Contenido", description: "Temas y calendario editorial",     icon: "LayoutGrid" },
    { id: "final",   order: 2, label: "Estrategia Final", description: "Plan de contenido completo",          icon: "FileText" },
  ],
  DEVELOPMENT: [
    { id: "quiz",    order: 0, label: "Cuestionario", description: "Requisitos técnicos",                      icon: "HelpCircle" },
    { id: "compare", order: 1, label: "Comparativa", description: "Comparación de stacks y arquitecturas",    icon: "GitCompare" },
    { id: "final",   order: 2, label: "Especificación Técnica", description: "Documento de desarrollo",       icon: "Code" },
  ],
  EXECUTION: [
    { id: "quiz",    order: 0, label: "Cuestionario", description: "Plan de lanzamiento",                      icon: "HelpCircle" },
    { id: "simulate",order: 1, label: "Simulación", description: "Escenarios y riesgos",                      icon: "PlayCircle" },
    { id: "final",   order: 2, label: "Plan de Ejecución", description: "Roadmap de lanzamiento",               icon: "Rocket" },
  ],
  // ANALYSIS: no tiene sub-steps con nombre (solo quiz → report implícito)
};
```

> **Nota:** `ANALYSIS` (Fase 01) no renderiza sub-cards. Solo muestra el quiz de análisis como fase simple.

---

## 4. Componente: SubStepCard

### 4.1 Props

```typescript
interface SubStepCardProps {
  phaseType: string;              // "IDENTITY", "BUSINESS", etc.
  subStepMeta: SubStepMeta;       // Metadata del sub-step (label, desc, icon)
  status: SubStepStatus;          // Ver sección 5
  number: number;                 // 1-based para display ("1.", "2.", etc.)
  onAction?: () => void;          // Callback del botón de acción
  isLast?: boolean;               // Si es el último sub-step (para estilo final)
}

type SubStepStatus = "locked" | "available" | "processing" | "completed" | "substep_ready";
```

### 4.2 Layout Desktop (≥ 768px)

```
┌──────────────────────────────────────────────────────────┐
│ [1.]  📝  Nombre                           [Ejecutar] → │  ← fila horizontal
│       Elige el nombre de tu proyecto                     │  ← descripción debajo
│                                                          │
│ [2.]  💬  Voz y Tono                       [Responder] → │  ← siguiente sub-card
│       Define la personalidad de tu marca                 │
│                                                          │
│ [3.]  🎨  Estilo Visual              [Ver resultado] →   │  ← substep_ready
│       Fuentes, colores e identidad visual                │
│                                                          │
│ [4.]  📖  Brand Book                      [Completado] ✓  │  ← completed (sin botón)
│       Documento final con toda la identidad              │
└──────────────────────────────────────────────────────────┘
```

### 4.3 Layout Mobile (< 768px)

```
┌──────────────────────────────────────────────────┐
│  [1.] 📝                                            │
│  Nombre                                             │
│  Elige el nombre de tu proyecto                     │
│  ┌────────────────────────┐                         │
│  │  [Ejecutar →]          │  ← botón ancho completo │
│  └────────────────────────┘                         │
├──────────────────────────────────────────────────┤
│  [2.] 💬                                            │
│  Voz y Tono                                         │
│  Define la personalidad de tu marca                 │
│  ┌────────────────────────┐                         │
│  │  [Responder →]         │                         │
│  └────────────────────────┘                         │
└──────────────────────────────────────────────────┘
```

### 4.4 Estructura HTML (pseudocódigo)

```html
<!-- SubStepCard -->
<div class="rounded-lg border border-slate-800 bg-slate-900/50 p-4 transition-all hover:border-slate-700 hover:bg-slate-900/80">
  <!-- Header: número + icono + título + badge de estado (opcional) + botón -->
  <div class="flex items-center gap-3">
    <!-- Número circular -->
    <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-{tone}-500/10 text-[11px] font-bold text-{tone}-400">
      {number}
    </span>
    
    <!-- Icono -->
    <span class="text-slate-400">
      <IconComponent className="size-4" />
    </span>
    
    <!-- Título + descripción (stack vertical) -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-white">{label}</span>
        <!-- Badge de estado (solo si no es available) -->
        <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium {badgeClasses}">
          {statusLabel}
        </span>
      </div>
      <p class="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
    
    <!-- Botón de acción (desktop: al lado; móvil: debajo) -->
    <button class="{buttonClasses}">
      {buttonLabel} {icon}
    </button>
  </div>
  
  <!-- Botón de acción (móvil: debajo, ancho completo) -->
  <div class="mt-3 w-full md:hidden">
    <button class="{buttonClasses} w-full">
      {buttonLabel} {icon}
    </button>
  </div>
</div>
```

### 4.5 Clases Tailwind Exactas (por estado)

#### Estado: `locked` (pendiente de que se complete el anterior)

```css
/* Card container */
"rounded-lg border border-slate-800/60 bg-slate-900/30 opacity-60"

/* Número */
"inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-500"

/* Icono */
"text-slate-600"

/* Título */
"text-sm font-semibold text-slate-500"

/* Descripción */
"text-xs text-slate-600"

/* Badge */
"inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500"
  → label: "Pendiente"
  → icon: <Lock className="size-3 mr-1" />

/* Botón */
"inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-500 cursor-not-allowed"
  → label: "Bloqueado"
  → icon: <Lock className="size-3" />
```

#### Estado: `available` (listo para ejecutar)

```css
/* Card container */
"rounded-lg border border-slate-700 bg-slate-900/70 transition-all hover:border-slate-600 hover:bg-slate-900 hover:shadow-sm"

/* Número */
"inline-flex h-6 w-6 items-center justify-center rounded-full bg-{tone}-500/15 text-[11px] font-bold text-{tone}-400"
  → tone: heredado de la fase padre (ej. purple para IDENTITY)

/* Icono */
"text-slate-400"

/* Título */
"text-sm font-semibold text-white"

/* Descripción */
"text-xs text-slate-500"

/* Badge: NO se muestra (estado implícito por botón activo) */

/* Botón (acción primaria) */
"inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-slate-950 transition-all hover:bg-amber-400 active:bg-amber-600"
  → label: "Ejecutar"
  → icon: <Play className="size-3.5" />
```

#### Estado: `processing` (agente trabajando en este sub-step)

```css
/* Card container */
"rounded-lg border border-amber-500/30 bg-amber-500/5 transition-all"

/* Número */
"inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-400"

/* Icono */
"text-amber-400"

/* Título */
"text-sm font-semibold text-amber-200"

/* Descripción */
"text-xs text-amber-400/70"

/* Badge */
"inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300"
  → label: "Procesando"
  → icon: <Loader2 className="size-3 animate-spin" />

/* Botón: NO se muestra (en proceso, no hay acción de usuario) */
/* En su lugar, se muestra indicador de progreso: */
"flex items-center gap-2 text-xs text-amber-400/80"
  → <Loader2 className="size-3 animate-spin" />
  → "Generando... ~2-3 min"
```

#### Estado: `substep_ready` (resultado listo para revisar)

```css
/* Card container */
"rounded-lg border border-purple-500/30 bg-purple-500/5 transition-all hover:border-purple-500/50 hover:bg-purple-500/10"

/* Número */
"inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20 text-[11px] font-bold text-purple-400"

/* Icono */
"text-purple-400"

/* Título */
"text-sm font-semibold text-purple-200"

/* Descripción */
"text-xs text-purple-400/70"

/* Badge */
"inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[10px] font-medium text-purple-300"
  → label: "Listo para revisar"
  → icon: <Sparkles className="size-3" />

/* Botón (acción primaria) */
"inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-500 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-purple-400 active:bg-purple-600"
  → label: "Revisar"
  → icon: <Sparkles className="size-3.5" />
```

#### Estado: `completed` (sub-step terminado)

```css
/* Card container */
"rounded-lg border border-green-500/20 bg-green-500/5 transition-all"

/* Número */
"inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-[11px] font-bold text-green-400"

/* Icono */
"text-green-400"

/* Título */
"text-sm font-semibold text-green-300"

/* Descripción */
"text-xs text-green-400/70"

/* Badge */
"inline-flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-300"
  → label: "Completado"
  → icon: <CheckCircle className="size-3" />

/* Botón: NO se muestra. Se muestra checkmark estático: */
"inline-flex items-center gap-1 text-xs font-medium text-green-400"
  → <CheckCircle className="size-4" />
  → "Hecho"
```

### 4.6 Mapa de Tono Heredado por Fase

```typescript
const subStepToneMap: Record<string, PhaseCardTone> = {
  IDENTITY:   "purple",
  BUSINESS:   "cyan",      // Nota: usar blue si cyan no está en toneNumberStyles
  CONTENT:    "amber",
  DEVELOPMENT:"green",
  EXECUTION:  "amber",     // O crear un tone "orange" si se agrega
};
```

> **Nota:** Si el tone de la fase no está en `toneNumberStyles`, mapear al más cercano:
> - `cyan` → `blue`
> - `orange` → `amber`
> - `rose` → `purple` (o agregar `rose` a `toneNumberStyles`)

---

## 5. Estados Visuales — Lógica de Determinación

### 5.1 Algoritmo de Estado por Sub-step

```typescript
function getSubStepStatus(
  phase: PhaseData,
  subStepMeta: SubStepMeta,
  phaseStatus: PhaseCardStatus
): SubStepStatus {
  // Si la fase está completada, TODOS los sub-steps están completados
  if (phaseStatus === "completed") return "completed";
  
  // Si la fase está bloqueada, TODOS los sub-steps están bloqueados
  if (phaseStatus === "locked") return "locked";
  
  // Si la fase está disponible pero no ha iniciado, todos los sub-steps están bloqueados
  // excepto el primero (order === 0) que está available
  if (phaseStatus === "available") {
    return subStepMeta.order === 0 ? "available" : "locked";
  }
  
  // Si la fase está procesando, consultamos el subStep actual
  if (phaseStatus === "processing") {
    const currentSubStepIndex = phase.subStepOrder ?? 
      (phase.subStep ? getSubStepIndex(phase.subStep, phase.type) : 0);
    
    if (subStepMeta.order < currentSubStepIndex) return "completed";
    if (subStepMeta.order === currentSubStepIndex) return "processing";
    return "locked";
  }
  
  // Si la fase está en substep_ready, el subStep actual está listo para revisar
  if (phaseStatus === "substep_ready") {
    const currentSubStepIndex = phase.subStepOrder ?? 
      (phase.subStep ? getSubStepIndex(phase.subStep, phase.type) : 0);
    
    if (subStepMeta.order < currentSubStepIndex) return "completed";
    if (subStepMeta.order === currentSubStepIndex) return "substep_ready";
    return "locked";
  }
  
  // Si la fase está questioning (cuestionario de quiz), el sub-step quiz está processing
  if (phaseStatus === "questioning") {
    const quizIndex = getSubStepIndex("quiz", phase.type);
    if (subStepMeta.order < quizIndex) return "completed";
    if (subStepMeta.order === quizIndex) return "processing";
    return "locked";
  }
  
  return "locked";
}
```

### 5.2 Diagrama de Flujo de Estados

```
┌────────────────────────────────────────────────────────────────────────┐
│  FASE: LOCKED                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │
│  │ 🔒 Pend │  │ 🔒 Pend │  │ 🔒 Pend │  │ 🔒 Pend │  (todos locked)   │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘                  │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│  FASE: AVAILABLE (inicio)                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │
│  │ ▶ Ejec  │  │ 🔒 Pend │  │ 🔒 Pend │  │ 🔒 Pend │                  │
│  │   [0]   │  │   [1]   │  │   [2]   │  │   [3]   │                  │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘                  │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│  FASE: PROCESSING (subStepOrder = 1, subStep = "voice")                │
│  ┌─────────┐  ┌─────────────────┐  ┌─────────┐  ┌─────────┐            │
│  │ ✓ Hecho │  │ 🔄 Procesando   │  │ 🔒 Pend │  │ 🔒 Pend │            │
│  │   [0]   │  │   [1] voice     │  │   [2]   │  │   [3]   │            │
│  └─────────┘  └─────────────────┘  └─────────┘  └─────────┘            │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│  FASE: SUBSTEP_READY (subStepOrder = 1, subStep = "voice")             │
│  ┌─────────┐  ┌─────────────────┐  ┌─────────┐  ┌─────────┐            │
│  │ ✓ Hecho │  │ ✨ Revisar      │  │ 🔒 Pend │  │ 🔒 Pend │            │
│  │   [0]   │  │   [1] voice     │  │   [2]   │  │   [3]   │            │
│  └─────────┘  └─────────────────┘  └─────────┘  └─────────┘            │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│  FASE: COMPLETED                                                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │
│  │ ✓ Done  │  │ ✓ Done  │  │ ✓ Done  │  │ ✓ Done  │  (todos done)    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Integración en PhaseCard

### 6.1 Posición en el Layout

Las sub-cards se renderizan **dentro** de `PhaseCard`, en una nueva sección ubicada:

1. **ANTES** de la descripción de la fase: NO
2. **DESPUÉS** de la descripción de la fase: SÍ
3. **ANTES** de las acciones globales de la fase: SÍ
4. **DESPUÉS** de los artefactos: DEPENDE (si hay artefactos, sub-cards antes)

**Orden final dentro de PhaseCard:**
```
┌────────────────────────────────────────────┐
│  Header (número + icono + título)          │
│  Badge de estado de fase                     │
│  Indicador de progreso (si processing)      │
│  Descripción de la fase                      │
│  ─────────────────────────────────────────  │
│  🆕 SECCIÓN: Sub-step Cards                 │
│  ┌──────────────────────────────────────┐  │
│  │  [1] Nombre              [Ejecutar]  │  │
│  │  Elige el nombre...                  │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  [2] Voz y Tono        [Responder]   │  │
│  │  Define la personalidad...           │  │
│  └──────────────────────────────────────┘  │
│  ─────────────────────────────────────────  │
│  Acciones globales de la fase               │
│  [Ver] [Descargar PDF]                      │
└────────────────────────────────────────────┘
```

### 6.2 Clases Tailwind para el Contenedor de Sub-cards

```html
<!-- Contenedor de sub-cards dentro de PhaseCard -->
<div class="mt-4 space-y-2">
  {subStepCards.map((card) => (
    <SubStepCard key={card.id} {...card} />
  ))}
</div>
```

- **`mt-4`**: Separación desde la descripción de la fase (16px)
- **`space-y-2`**: Gap de 8px entre cada sub-card
- **No** se usa `border-t` ni separador visual — las sub-cards ya tienen su propio borde

### 6.3 Condiciones de Renderizado

Las sub-cards se renderizan **solo** si:
1. La fase tiene sub-steps definidos en `PHASE_SUBSTEPS` (todas excepto ANALYSIS)
2. La fase **NO** está en estado `LOCKED` (en locked, se muestra la fase aplanada sin sub-cards)
3. La fase **NO** está en estado `COMPLETED` con artefactos (en completed, las acciones globales cubren todo; sub-cards opcionales como resumen)

> **Decisión de diseño:** En fases `COMPLETED`, las sub-cards se muestran como **resumen de progreso** (todos en estado `completed`, sin botones) para que el usuario vea qué pasos se completaron. Esto añade valor visual y claridad histórica.

---

## 7. Botones de Acción por Sub-step

### 7.1 Mapa de Acciones por Estado

| Estado | Label del botón | Icono | Color | Acción |
|--------|-----------------|-------|-------|--------|
| `available` | "Ejecutar" | `<Play>` | Ámbar (primary) | Lanza el sub-step (quiz o ejecución) |
| `processing` | — | `<Loader2>` | Ámbar (spinner) | No hay botón, solo indicador |
| `substep_ready` | "Revisar" | `<Sparkles>` | Púrpura | Abre modal de sub-step (`PhaseSubstepModal`) |
| `completed` | — | `<CheckCircle>` | Verde | Checkmark estático, no botón |
| `locked` | "Bloqueado" | `<Lock>` | Slate (disabled) | Botón deshabilitado |

### 7.2 Acciones Específicas por Tipo de Sub-step

| Sub-step | Estado `available` | Estado `substep_ready` | Estado `processing` |
|----------|-------------------|----------------------|---------------------|
| `quiz` (cualquier fase) | "Responder" | — | "Procesando respuestas..." |
| `naming` | "Ejecutar" | "Revisar nombres" | "Generando opciones..." |
| `voice` | "Ejecutar" | "Revisar voz" | "Definiendo personalidad..." |
| `visual` | "Ejecutar" | "Revisar mockup" | "Generando mockup..." |
| `pilars` | "Ejecutar" | "Revisar pilares" | "Generando pilares..." |
| `compare` | "Ejecutar" | "Revisar comparativa" | "Comparando stacks..." |
| `simulate` | "Ejecutar" | "Revisar simulación" | "Simulando escenarios..." |
| `final` (cualquier fase) | "Ejecutar" | "Revisar resultado" | "Consolidando documento..." |

### 7.3 Clases Tailwind de Botones (referencia)

```typescript
const subStepBtnStyles = {
  available: 
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-slate-950 transition-all hover:bg-amber-400 active:bg-amber-600",
  substep_ready: 
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-500 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-purple-400 active:bg-purple-600",
  locked: 
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-500 cursor-not-allowed",
  completed_indicator: 
    "inline-flex items-center gap-1 text-xs font-medium text-green-400",
} as const;
```

---

## 8. Versión Mobile (< 768px)

### 8.1 Adaptaciones

| Elemento | Desktop | Mobile |
|----------|---------|--------|
| **Layout de sub-card** | Fila horizontal (icono + título + botón) | Stack vertical |
| **Botón de acción** | A la derecha, ancho auto | Debajo, ancho completo (`w-full`) |
| **Padding de sub-card** | `p-4` (16px) | `p-3` (12px) |
| **Gap entre sub-cards** | `space-y-2` (8px) | `space-y-2` (8px) |
| **Tamaño de icono** | `size-4` (16px) | `size-4` (16px) |
| **Tamaño de número** | `h-6 w-6` (24px) | `h-5 w-5` (20px) |
| **Font del título** | `text-sm` (14px) | `text-sm` (14px) |
| **Font descripción** | `text-xs` (12px) | `text-xs` (12px) |
| **Botón** | `text-xs` (12px) | `text-xs` (12px), `w-full` |

### 8.2 Layout Mobile Detallado

```
┌──────────────────────────────────────────┐
│  ┌────────────────────────────────────┐  │
│  │  [1] 📝                           │  │  ← número + icono en fila
│  │  Nombre                            │  │  ← título debajo
│  │  Elige el nombre de tu proyecto    │  │  ← descripción
│  │  ┌──────────────────────────────┐  │  │
│  │  │      ▶ Ejecutar              │  │  │  ← botón ancho completo
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  [2] 💬  🔄 Procesando            │  │  ← número + icono + badge
│  │  Voz y Tono                        │  │
│  │  Define la personalidad...         │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │  🔄 Generando... ~2-3 min    │  │  │  ← indicador en lugar de botón
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  [3] 🎨  ✓ Completado            │  │
│  │  Estilo Visual                     │  │
│  │  Fuentes, colores...               │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │  ✓ Hecho                     │  │  │  ← checkmark estático
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 8.3 Clases Tailwind para Responsive

```typescript
// Contenedor principal de sub-card (ya tiene responsive en la definición base)
// El botón se muestra en desktop al lado, en mobile debajo:

// Desktop: botón en la fila del header
<button className="hidden md:inline-flex items-center ...">
  {label} <Icon />
</button>

// Mobile: botón debajo, ancho completo
<div className="mt-3 w-full md:hidden">
  <button className="inline-flex w-full items-center justify-center ...">
    {label} <Icon />
  </button>
</div>

// O usando un solo botón con responsive:
<button className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-slate-950 transition-all hover:bg-amber-400 w-full md:w-auto">
```

---

## 9. Animaciones y Transiciones

### 9.1 Transiciones de Estado

```css
/* Transición suave en cambio de estado */
"transition-all duration-300 ease-in-out"

/* Hover en sub-card available/substep_ready */
"hover:border-slate-600 hover:bg-slate-900 hover:shadow-sm"
"hover:border-purple-500/50 hover:bg-purple-500/10"

/* Focus en botón (accesibilidad) */
"focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
```

### 9.2 Animaciones de Carga

```css
/* Spinner en estado processing */
"animate-spin"

/* Pulse sutil en sub-card processing */
"animate-pulse"  /* Solo si se quiere, preferiblemente NO (distractor) */

/* Transición de borde en estado processing */
"border-amber-500/30" → hover no aplica (está en proceso)
```

### 9.3 Microinteracciones

| Evento | Efecto | Clases |
|--------|--------|--------|
| Hover sub-card | Border más claro, bg más opaco | `hover:border-slate-600 hover:bg-slate-900` |
| Hover botón | Fondo más claro | `hover:bg-amber-400` |
| Active botón | Fondo más oscuro | `active:bg-amber-600` |
| Focus botón | Ring ámbar | `focus:ring-2 focus:ring-amber-500/50` |
| Checkmark completado | Scale pop | `transition-transform hover:scale-110` (opcional) |

---

## 10. Accesibilidad

### 10.1 ARIA y Semántica

```html
<!-- Sub-card container -->
<div 
  role="region" 
  aria-label={`Sub-paso ${number}: ${label}`}
  class="..."
>
  <!-- Botón con estado deshabilitado explícito -->
  <button 
    aria-disabled={isLocked} 
    disabled={isLocked}
    aria-label={isLocked ? `${label} — bloqueado` : `Ejecutar ${label}`}
  >
    {label}
  </button>
  
  <!-- Badge de estado -->
  <span aria-label={`Estado: ${statusLabel}`}>
    {statusLabel}
  </span>
</div>
```

### 10.2 Contraste y Legibilidad

| Elemento | Foreground | Background | Ratio WCAG |
|----------|-----------|------------|------------|
| Título sub-card | `text-white` (#fff) | `bg-slate-900/50` (#0f172a80) | > 7:1 ✅ |
| Descripción | `text-slate-500` (#64748b) | `bg-slate-900/50` | > 4.5:1 ✅ |
| Botón ámbar | `text-slate-950` (#020617) | `bg-amber-500` (#f59e0b) | > 4.5:1 ✅ |
| Botón púrpura | `text-white` (#fff) | `bg-purple-500` (#a855f7) | > 4.5:1 ✅ |
| Estado locked | `text-slate-500` (#64748b) | `bg-slate-800/50` (#1e293b80) | > 4.5:1 ✅ |

### 10.3 Touch Targets

- Botón de acción: mínimo **44x44px** en móvil
- Sub-card completa: clickable solo si tiene botón activo
- Separación entre sub-cards: **8px** mínimo (evitar taps accidentales)

---

## 11. Diagrama de Componente

### 11.1 Árbol de Componentes

```
ProjectPhasesWithModal
├── PhaseCard (fase padre)
│   ├── Header (número + icono + título + badge estado)
│   ├── Description
│   ├── SubProgress (legacy, a deprecar)
│   ├── MiniProgressBar (legacy, a deprecar)
│   ├── 🆕 SubStepList (NUEVO)
│   │   ├── SubStepCard
│   │   │   ├── NumberBadge
│   │   │   ├── Icon
│   │   │   ├── Content (título + descripción + badge estado)
│   │   │   └── ActionButton / StatusIndicator
│   │   ├── SubStepCard
│   │   └── ...
│   ├── Artifacts (legacy, a deprecar en fases con sub-steps)
│   └── Actions (botones globales de fase: Ver, Descargar PDF)
├── PhaseQuestionsModal
├── PhaseSubstepModal
└── ...
```

### 11.2 Flujo de Datos

```
PhaseData (DB)
  ├── id, type, label, status, sortOrder
  ├── subStep: "voice"          ← sub-step actual
  ├── subStepOrder: 1             ← índice del sub-step actual
  ├── subStepArtifact: {...}      ← artefacto del sub-step actual
  ├── subStepChoice: "A"          ← elección del usuario
  └── ...

        ↓

getSubStepsForPhase(type) → SubStepMeta[]
  (de PHASE_SUBSTEPS)

        ↓

getSubStepStatus(phase, meta, phaseStatus) → SubStepStatus
  (compara subStepOrder vs meta.order)

        ↓

SubStepCard
  renderiza según status
  → onAction() abre PhaseSubstepModal o ejecuta quiz
```

### 11.3 Diagrama de Secuencia (Interacción)

```
Usuario                          SubStepCard                    PhaseSubstepModal
  │                                 │                                  │
  │ ── Click "Revisar" ─────────> │                                  │
  │                                 │ ── onAction() ────────────────> │
  │                                 │                                  │
  │                                 │                       ┌────────┴────────┐
  │                                 │                       │  Muestra modal  │
  │                                 │                       │  con artefacto  │
  │                                 │                       │  de sub-step    │
  │                                 │                       └────────┬────────┘
  │                                 │ <── setSubstepModalPhase() ────│
  │                                 │                                  │
  │ <── Modal abierto ──────────────│                                  │
  │                                 │                                  │
  │ ── Click "Confirmar" ────────> │                                  │
  │                                 │ ── API call / mutation ───────> │
  │                                 │                                  │
  │                                 │                       ┌────────┴────────┐
  │                                 │                       │  Avanza sub-step│
  │                                 │                       │  o marca done   │
  │                                 │                       └────────┬────────┘
  │                                 │ <── Refresh router ──────────────│
  │                                 │                                  │
  │ <── Sub-cards actualizadas ─────│                                  │
  │                                 │                                  │
```

---

## 12. Checklist de Implementación (para CoderBot)

### 12.1 Archivos a Modificar

- [ ] `src/lib/phase-substeps.ts` — **NUEVO**: Definir `PHASE_SUBSTEPS` con metadatos de sub-steps por fase
- [ ] `src/app/(dashboard)/proyectos/[id]/sub-step-card.tsx` — **NUEVO**: Componente `SubStepCard`
- [ ] `src/app/(dashboard)/proyectos/[id]/phase-card.tsx` — **MODIFICAR**: Agregar sección `<SubStepList>` debajo de descripción
- [ ] `src/app/(dashboard)/proyectos/[id]/project-phases-with-modal.tsx` — **MODIFICAR**: 
  - Deprecar `subProgress` y `miniProgressBar` (eliminar props del `PhaseCard`)
  - Pasar `subSteps` renderizados al `PhaseCard` o mantener lógica en `PhaseCard` interna
- [ ] `src/lib/identity-substeps.ts` — **MODIFICAR**: Unificar con `PHASE_SUBSTEPS` o importar desde ahí

### 12.2 Reglas de Implementación

1. **NUNCA** usar estilos inline (`style={{...}}`). Todo vía Tailwind CSS.
2. **NUNCA** usar `!important` en Tailwind.
3. Mantener consistencia con la paleta existente (`slate`, `amber`, `green`, `purple`).
4. Los iconos son de **Lucide React** (ya instalado en el proyecto).
5. El componente debe ser **Client Component** (`"use client"`) si usa estados locales o eventos.
6. **Mobile-first**: escribir primero las clases móviles, luego `md:` para desktop.
7. Los botones deben tener **estados disabled** explícitos con `aria-disabled`.
8. El spinner de carga usa `Loader2` con `animate-spin` de Tailwind.

### 12.3 Tests Visuales a Verificar

- [ ] Fase `IDENTITY` en `AVAILABLE` muestra sub-step 1 como "Ejecutar", resto como "Bloqueado"
- [ ] Fase `IDENTITY` en `PROCESSING` (subStepOrder=1) muestra sub-step 1 como "Procesando", sub-step 0 como "Hecho", resto como "Bloqueado"
- [ ] Fase `IDENTITY` en `SUBSTEP_READY` (subStepOrder=1) muestra sub-step 1 como "Revisar", sub-step 0 como "Hecho", resto como "Bloqueado"
- [ ] Fase `IDENTITY` en `COMPLETED` muestra los 4 sub-steps como "Completado" con checkmarks
- [ ] Fase `BUSINESS` en `PROCESSING` (quiz) muestra sub-step 1 como "Procesando", sub-step 2 como "Bloqueado"
- [ ] Fase `ANALYSIS` **NO** muestra sub-cards (no tiene definición en `PHASE_SUBSTEPS`)
- [ ] En móvil, los botones ocupan el ancho completo debajo de cada sub-card
- [ ] En desktop, los botones están alineados a la derecha de cada sub-card
- [ ] El tono de color del número del sub-card coincide con el tono de la fase padre

---

## 13. Glosario

| Término | Definición |
|---------|-----------|
| **Sub-step** | Paso individual dentro de una fase del proyecto (ej. "naming" dentro de "IDENTITY") |
| **PhaseCard** | Componente actual de tarjeta de fase. Se modifica para incluir sub-cards |
| **SubStepCard** | Nuevo componente de tarjeta de sub-step anidada dentro de PhaseCard |
| **Tone** | Color temático de la fase (purple, blue, green, amber, slate) que se hereda a los sub-steps |
| **subStepOrder** | Índice numérico del sub-step actual en la fase (0-based) |
| **subStep** | ID string del sub-step actual (ej. "voice", "quiz", "compare") |
| **subStepArtifact** | Contenido/artefacto generado por el agente para el sub-step actual |
| **subStepChoice** | Elección del usuario en el sub-step (ej. nombre elegido, variante A/B/C) |
| **PhaseSubstepModal** | Modal existente para revisar artefactos de sub-step y confirmar/avanzar |

---

> **Documento generado por UIDesigner (subagente) para el pipeline de Brew Validator.**  
> **Próximo paso:** CoderBot lee este documento e implementa los componentes `SubStepCard` y modifica `PhaseCard` según la especificación.
