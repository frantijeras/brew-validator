# 🧪 Checklist de verificación manual — Brew Validator

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
- [ ] Verificar que tiene 7 fases (0 a 6):
  - [ ] Fase 0: Validación
  - [ ] Fase 1: Análisis de Mercado
  - [ ] Fase 2: Identidad de Marca
  - [ ] Fase 3: Estrategia de Distribución
  - [ ] Fase 4: Landing Page
  - [ ] Fase 5: Estrategia de Negocio
  - [ ] Fase 6: Roadmap 30/60/90
- [ ] Verificar que Fase 0 muestra "Ver" y "Descargar PDF" (datos de validación)
- [ ] Verificar que Fase 1 está en estado AVAILABLE

### 4. Ejecutar todas las fases

#### Fase 1 — Análisis de Mercado

- [ ] Clic en "Ejecutar" → esperar preguntas del wizard
- [ ] Responder todas las preguntas
- [ ] Esperar informe final (estado COMPLETED)
- [ ] "Ver" → HTML se abre en nueva pestaña con el informe completo
- [ ] "Descargar PDF" → PDF válido con el análisis

#### Fase 2 — Identidad de Marca (4 sub-pasos)

- [ ] Verificar que muestra sub-progreso "Paso 1 de 4 — Nombre"
- [ ] **Naming:** Ejecutar → elegir nombre (A/B/C o custom)
- [ ] Verificar que el nombre se propaga a informes previos (Fase 1 y validación)
- [ ] **Voz y Tono:** Ejecutar → elegir tono
- [ ] **Estilo Visual:** Ejecutar → verificar preview A/B/C en tabs
- [ ] Elegir un estilo → continuar
- [ ] **Brand Book final:** Verificar que se genera con 9 secciones
- [ ] "Ver" → HTML con índice y contenido completo
- [ ] "Descargar PDF" → PDF válido

#### Fase 3 — Estrategia de Distribución

- [ ] Ejecutar → responder preguntas del wizard
- [ ] Verificar que NO pregunta sobre "landing" o "blog" (eso es Fase 4)
- [ ] "Ver" → HTML con estrategia de canales
- [ ] "Descargar PDF" → PDF válido

#### Fase 4 — Landing Page

- [ ] Ejecutar → responder preguntas sobre diseño y estructura
- [ ] "Ver" → HTML con especificación de landing
- [ ] "Descargar PDF" → PDF válido

#### Fase 5 — Estrategia de Negocio

- [ ] Ejecutar → responder preguntas
- [ ] "Ver" → HTML con plan de negocio
- [ ] "Descargar PDF" → PDF válido

#### Fase 6 — Roadmap 30/60/90

- [ ] Ejecutar → responder preguntas
- [ ] "Ver" → HTML con roadmap
- [ ] "Descargar PDF" → PDF válido

### 5. Project Memory

- [ ] Abrir el banner "📌 Decisiones vigentes" (debe aparecer tras completar ≥1 fase)
- [ ] Verificar que muestra decisiones de fases previas (target, tono, canales, etc.)
- [ ] Editar un campo manualmente → verificar que el cambio se guarda
- [ ] Verificar que las ediciones del usuario prevalecen sobre decisiones de fases posteriores

### 6. Handoff Package

- [ ] Verificar que aparece el botón "Descargar Handoff ZIP" al completar ≥4 fases
- [ ] Descargar ZIP → extraer en local
- [ ] Verificar estructura del ZIP:
  - [ ] `mi-proyecto/README.md` — resumen del proyecto
  - [ ] `mi-proyecto/01-validacion.md` — informe de validación
  - [ ] `mi-proyecto/02-analisis-mercado.md` — análisis de mercado
  - [ ] `mi-proyecto/03-identidad/brand-book.md` — brand book consolidado
  - [ ] `mi-proyecto/04-estrategia-distribucion.md` — canales
  - [ ] `mi-proyecto/05-landing-page.md` — especificación landing
  - [ ] `mi-proyecto/06-plan-negocio.md` — plan de negocio
  - [ ] `mi-proyecto/07-roadmap-30-60-90.md` — roadmap
  - [ ] `mi-proyecto/skills/landing-builder.md` — skill para agente AI
  - [ ] `mi-proyecto/skills/content-writer.md` — skill para contenido
  - [ ] `mi-proyecto/skills/social-strategy.md` — skill para redes
  - [ ] `mi-proyecto/skills/project-handoff.md` — meta-skill con contexto completo
- [ ] Verificar que el nombre del directorio está sanitizado (sin espacios, acentos ni emojis)

### 7. Casos extremos

- [ ] Cancelar una fase en estado PROCESSING → verificar que vuelve a AVAILABLE
- [ ] Iterar en un sub-paso de identidad (ej. "Iterar" en estilo visual)
- [ ] Cambiar nombre en naming → verificar que se propaga a informes previos
- [ ] Eliminar proyecto → confirmar que desaparece y no rompe la UI
- [ ] Crear segunda idea y proyecto → verificar que no interfiere con el primero

### 8. Verificaciones de sistema

- [ ] `npm run build` compila sin errores
- [ ] `npm run smoke` pasa todos los tests (174/174)
- [ ] `npm run lint` no tiene errores
- [ ] La app carga en mobile (responsive)
- [ ] Los PDFs se ven bien en mobile y desktop
- [ ] No hay errores en consola del navegador

---

## Resultado

| Área | Estado |
|------|--------|
| Smoke tests (174 assertions) | ✅ Todos pasan |
| Build (tsc + next build) | ⬜ Pendiente |
| Crear idea | ⬜ Pendiente |
| Validar idea | ⬜ Pendiente |
| Crear proyecto | ⬜ Pendiente |
| Fase 1 — Análisis | ⬜ Pendiente |
| Fase 2 — Identidad (4 sub-pasos) | ⬜ Pendiente |
| Fase 3 — Distribución | ⬜ Pendiente |
| Fase 4 — Landing | ⬜ Pendiente |
| Fase 5 — Negocio | ⬜ Pendiente |
| Fase 6 — Roadmap | ⬜ Pendiente |
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
