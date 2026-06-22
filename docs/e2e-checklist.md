# 🧪 Checklist de verificación manual — BrewIdea

> **Versión:** Fase 10 — Refactor IDENTITY  
> **Fecha:** 2026-06-07  
> **Smoke test automático:** `npm run smoke` (174 assertions, todos pasan ✅)

---

## Requisitos previos

- [ ] App desplegada en Vercel (último commit de `main`)
- [ ] Bridge corriendo en el VPS (`systemctl status brew-bridge`)
- [ ] Modelo configurado en Ajustes → Modelos de Agente
- [ ] Base de datos sincronizada (`npx prisma db push`)

---

## Flujo completo

### 1. Crear idea

- [ ] Ir a `/ideas` → clic en "Nueva idea"
- [ ] Completar formulario con idea de prueba (nombre, descripción, problema, propuesta de valor, target, monetización, modelo de negocio)
- [ ] Verificar que se crea y aparece en la lista de ideas
- [ ] Verificar que el estado inicial es `DRAFT`

### 2. Validar idea

- [ ] Desde la idea, hacer clic en "Validar"
- [ ] Verificar que aparece el modal de progreso (3 pasos: escéptico → defensor → juez)
- [ ] Esperar a que el bridge procese los 3 agentes
- [ ] Verificar que el veredicto y score aparecen al finalizar
- [ ] Verificar que los botones "Ver informe" y "Descargar PDF" están presentes
- [ ] Abrir "Ver informe" → comprobar que el HTML se abre en nueva pestaña y se ve correctamente
- [ ] Descargar PDF → comprobar que se descarga un archivo .pdf válido y legible

### 3. Crear proyecto desde idea

- [ ] Ir a la idea validada → clic en "Crear proyecto"
- [ ] Verificar que el proyecto aparece en `/proyectos`
- [ ] Verificar que tiene 5 fases (1 a 5), más la Validación de idea como paso 0 (read-only):
  - [ ] Fase 1: Análisis de Mercado (ANALYSIS)
  - [ ] Fase 2: Estrategia de Negocio (BUSINESS)
  - [ ] Fase 3: Identidad de Marca (IDENTITY)
  - [ ] Fase 4: Estrategia de Distribución (CONTENT)
  - [ ] Fase 5: Roadmap 30/60/90 (EXECUTION)
- [ ] Verificar que la card de Validación enlaza a /ideas/[id] (no es una ProjectPhase)
- [ ] Verificar que Fase 1 está en estado AVAILABLE y el resto LOCKED

### 4. Ejecutar todas las fases

#### Fase 1 — Análisis de Mercado

- [ ] Clic en "Ejecutar" → esperar preguntas del wizard
- [ ] Responder todas las preguntas
- [ ] Esperar informe final (estado COMPLETED)
- [ ] "Ver" → HTML se abre en nueva pestaña con el informe completo
- [ ] "Descargar PDF" → PDF válido con el análisis

#### Fase 2 — Estrategia de Negocio

- [ ] Ejecutar → responder preguntas del wizard
- [ ] "Ver" → HTML con Lean Canvas / modelo de negocio
- [ ] "Descargar PDF" → PDF válido

#### Fase 3 — Identidad de Marca (3 sub-pasos: naming → voice → visual)

- [ ] Verificar que muestra los sub-pasos 3A Naming, 3B Voz y Tono, 3C Estilo Visual
- [ ] **Naming:** Ejecutar → elegir nombre (opción o custom)
- [ ] Verificar que el nombre se propaga a informes previos (fases anteriores y validación)
- [ ] **Voz y Tono:** Ejecutar → elegir tono
- [ ] **Estilo Visual:** Ejecutar → verificar preview A/B/C en tabs → elegir un estilo
- [ ] **Brand Book final:** al completar visual se genera automáticamente
- [ ] Verificar que el Brand Book contiene el NOMBRE elegido (no "A"), la voz y el estilo
- [ ] "Ver" / "Descargar PDF" del Brand Book

#### Fase 4 — Estrategia de Distribución

- [ ] Ejecutar → responder preguntas del wizard
- [ ] "Ver" → HTML con estrategia de canales (matriz Bullseye, calendario)
- [ ] "Descargar PDF" → PDF válido

#### Fase 5 — Roadmap 30/60/90

- [ ] Ejecutar → sub-paso plan_30_60_90 (OKRs) y simulación económica
- [ ] "Ver" → HTML con roadmap y unit economics
- [ ] "Descargar PDF" → PDF válido

### 5. Project Memory

- [ ] Abrir el banner "📌 Decisiones vigentes" (debe aparecer tras completar ≥1 fase)
- [ ] Verificar que muestra decisiones de fases previas (target, tono, canales, etc.)
- [ ] Editar un campo manualmente → verificar que el cambio se guarda
- [ ] Verificar que las ediciones del usuario prevalecen sobre decisiones de fases posteriores

### 6. Handoff Package

- [ ] Verificar que la pestaña Hand-off se desbloquea al completar las 5 fases (+ skills)
- [ ] Descargar ZIP → extraer en local
- [ ] Verificar estructura del ZIP (un documento por fase, en orden 1-5, más
      validación, brand book consolidado y skills seleccionadas)
- [ ] Verificar que el nombre del directorio está sanitizado (sin espacios, acentos ni emojis)
- [ ] Verificar que el AGENT.md de hand-off incluye las decisiones de las fases

### 7. Casos extremos

- [ ] Cancelar una fase en estado PROCESSING → verificar que vuelve a AVAILABLE
- [ ] Iterar en un sub-paso de identidad (ej. "Iterar" en estilo visual)
- [ ] Cambiar nombre en naming → verificar que se propaga a informes previos
- [ ] Eliminar proyecto → confirmar que desaparece y no rompe la UI
- [ ] Crear segunda idea y proyecto → verificar que no interfiere con el primero

### 8. Verificaciones de sistema

- [ ] `npm run build` compila sin errores
- [ ] `npm run smoke` pasa los tests de lógica (nota: en Windows los 10 tests de
      extracción del ZIP de hand-off fallan por usar comandos Unix — rm/unzip/find)
- [ ] `npm run lint` no tiene errores
- [ ] La app carga en mobile (responsive)
- [ ] Los PDFs se ven bien en mobile y desktop
- [ ] No hay errores en consola del navegador

---

## Resultado

| Área | Estado |
|------|--------|
| Smoke tests (lógica) | ⬜ Pendiente |
| Build (tsc + next build) | ⬜ Pendiente |
| Crear idea | ⬜ Pendiente |
| Validar idea | ⬜ Pendiente |
| Crear proyecto | ⬜ Pendiente |
| Fase 1 — Análisis | ⬜ Pendiente |
| Fase 2 — Negocio | ⬜ Pendiente |
| Fase 3 — Identidad (3 sub-pasos) | ⬜ Pendiente |
| Fase 4 — Distribución | ⬜ Pendiente |
| Fase 5 — Roadmap | ⬜ Pendiente |
| Project Memory | ⬜ Pendiente |
| Handoff ZIP | ⬜ Pendiente |
| Casos extremos | ⬜ Pendiente |
| Mobile / responsive | ⬜ Pendiente |
| Lint | ⬜ Pendiente |

---

> **Nota:** Esta checklist cubre la verificación manual completa.  
> Los smoke tests (`npm run smoke`) validan automáticamente toda la lógica offline  
> de los módulos del refactor (identity-substeps, rename-propagate, identity-visual,  
> report-renderer, pdf-export, validation-report, identity-brandbook,  
> project-memory, agent-context-rules, handoff-builder).
