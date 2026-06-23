---
name: project-pipeline
description: |
  Pipeline completo de desarrollo de proyectos. Flujo: Validador → Arquitecto → Diseñador → CodeBot → Verificación → Deploy.
  Arquity es el orquestador de todo el proceso. Los subagentes NO mandan mensajes al canal,
  solo avisan a Arquity cuando terminan.
---

# 🏗️ Pipeline de Desarrollo de Proyectos

## 🎯 Objetivo
Pipeline profesional para crear apps completas desde una idea de Fran.

## 👥 Equipo

| Rol | Agente | Modelo | Skill |
|-----|--------|--------|-------|
| **Orquestador** | Arquity (yo) | deepseek-v4-flash | project-pipeline |
| **Validador** | validador-proyectos | kimi-k2.6 | validador-proyectos/SKILL.md |
| **Arquitecto** | arch-master | deepseek-v4-pro | arch-master/SKILL.md |
| **Diseñador UX** | ui-designer | kimi-k2.6 | ui-designer/SKILL.md |
| **Desarrollador** | codebot | deepseek-v4-pro | codebot/SKILL.md |

> **Nota:** CodeBot ya NO es un agente independiente en `openclaw.json`. Es un subagente técnico que Arquity invoca vía `sessions_spawn(agentId="codebot", ...)`. Su workspace es el principal.

## 📂 Estructura

```
/root/.openclaw/workspace/project-specs/[proyecto]/
├── 01-research.md       ← Validador
├── 02-architecture.md   ← Arquitecto
├── 03-ui-design.md      ← Diseñador
└── 04-verification.md   ← Arquity (issues encontrados)

/root/proyectos/[proyecto]/  ← Código (CodeBot)
```

### 🧠 Workspace compartido

Todos los subagentes técnicos (ArchMaster, UIDesigner, **CodeBot**)
comparten el workspace principal: `/root/.openclaw/workspace`

CodeBot ya NO es un agente independiente con workspace propio.
Sus sesiones históricas se preservan en:
`/root/.openclaw/workspace/sessions-codebot/`

## 🔄 Flujo

### ESPECIFICACIÓN INICIAL
```
Fran: "Quiero una app para..."
  ↓
Arquity: Coordina y lanza el pipeline
```

### PASO 1 — VALIDADOR
```
Arquity → validador: "Valida [idea]"
  ↓
Validador: Investiga mercado, competencia, DAFO, preguntas a Fran
  ↓
Validador → Arquity: "Terminado ✅"
  ├── Notion: documento ejecutivo
  └── /project-specs/[proyecto]/01-research.md
  ↓
Arquity → Fran: "Validación completada. ¿Continuamos con el arquitecto?"
```

### PASO 2 — ARQUITECTO
```
Fran: "Sí, adelante"
  ↓
Arquity → arch-master: "Diseña arquitectura para [proyecto]"
  └── Lee: 01-research.md
  ↓
ArchMaster: Define stack, estructura, schema DB, endpoints, roadmap
  ↓
ArchMaster → Arquity: "Terminado ✅"
  └── /project-specs/[proyecto]/02-architecture.md
  ↓
Arquity → Fran: "Arquitectura lista. ¿Continuamos con el diseño UI/UX?"
```

### PASO 3 — DISEÑADOR UI/UX
```
Fran: "Sí"
  ↓
Arquity → ui-designer: "Diseña UI para [proyecto]"
  └── Lee: 01-research.md + 02-architecture.md
  ↓
UIDesigner: Sistema de diseño, pantallas, componentes, flujos, responsive
  ↓
UIDesigner → Arquity: "Terminado ✅"
  └── /project-specs/[proyecto]/03-ui-design.md
  ↓
Arquity → Fran: "Diseño UI/UX completado. ¿Lanzamos desarrollo?"
```

### PASO 4 — CODEBOT (DESARROLLO)
```
Fran: "Sí, desarrolla"
  ↓
Arquity → codebot: "Desarrolla [proyecto]"
  └── Lee: 01-research.md + 02-architecture.md + 03-ui-design.md
  ↓
CodeBot: Genera/Modifica código en /root/proyectos/[proyecto]/
  ↓
CodeBot → Arquity: "Terminado ✅ / ❌ Errores"
  └── Commit + Push a GitHub
  ↓
Arquity: Verifica
```

### PASO 5 — VERIFICACIÓN (Arquity)
```
Arquity:
  1. npx tsc --noEmit → ¿compila?
  2. npm run build → ¿build exitoso?
  3. Deploy en Vercel → ¿responde 200?
  4. Cambiar a modelo kimi-k2.6 para ver imágenes
  5. agent-browser: screenshots + interactuar
  6. Verificar layout, responsive, funcionalidad
  
  Si ❌:
    → Lista de issues en 04-verification.md
    → Volver a PASO 4 (CodeBot corrige)
  
  Si ✅:
    → PASO 6
```

### PASO 6 — DEPLOY
```
Arquity → CodeBot (si faltan fixes finales)
  ↓
Arquity: git push + vercel deploy
  ↓
Arquity → Fran: "✅ Proyecto desplegado en [URL]"
  └── Resumen de lo implementado
```

## ⚠️ REGLAS IMPORTANTES

### Sobre los subagentes
1. **Los subagentes NUNCA mandan mensajes al canal de Telegram**
2. Solo responden a Arquity con "✅ Terminado" o "❌ Error: [detalle]"
3. Los resultados se guardan en archivos MD, no en el chat
4. Si un subagente necesita preguntar algo, se lo dice a Arquity y Arquity pregunta a Fran

### Sobre las skills
1. Todas las skills en `/root/.openclaw/workspace/skills/`
2. Cada skill tiene su SKILL.md con el flujo detallado
3. Las credenciales en `/root/.openclaw/credentials/`

### Sobre la verificación visual
1. Para ver imágenes: cambiar modelo a kimi-k2.6
2. Usar agent-browser para capturas y tests
3. Probar en desktop (1440px), tablet (768px), mobile (375px)
4. Verificar que no hay overflow, solapamientos, elementos cortados

### Sobre CodeBot
1. SIEMPRE trabaja en `/root/proyectos/`
2. SIEMPRE ejecuta `npx tsc --noEmit` antes de avisar
3. SIEMPRE hace commit y push a GitHub
4. Si el proyecto ya existe, MODIFICA, no recrea desde cero

## 🔧 Comandos útiles

```bash
# Lanzar subagente
sessions_spawn agentId=arch-master task="Diseña arquitectura para [proyecto]"

# Verificar proyecto
cd /root/proyectos/[proyecto] && npx tsc --noEmit && npm run build

# Deploy
cd /root/proyectos/[proyecto] && git push && vercel --prod

# Test visual  
agent-browser open https://[proyecto].vercel.app
agent-browser screenshot /tmp/test.png
# Cambiar a kimi-k2.6 para ver la imagen
```
