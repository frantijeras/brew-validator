# Skills (agentes de IA)

Estas skills son los prompts/contratos que ejecuta el **bridge daemon** de
OpenClaw en el VPS. En el VPS viven en `/root/.openclaw/workspace/skills/`
(fuera del repo). Aquí se versionan para que **repo y VPS estén siempre
sincronizados**: el repo es la fuente de verdad.

## Contenido

### Validación (debate en 3 fases)

- `skeptic-agent/` — investiga riesgos y objeciones de la idea.
- `advocate-agent/` — investiga oportunidades; refuta al escéptico.
- `judge-agent/` — sintetiza el debate y emite veredicto + scorecard.

### Idea (creación y edición)

- `idea-generator/` — detecta oportunidades / estructura la idea del usuario.
- `idea-refiner/` — refina un subconjunto de campos de la idea según una
  instrucción del usuario, dejando el resto intacto.
- `idea-improver/` — mejora la idea a partir del veredicto del juez mediante
  un cuestionario corto (modos `questions` y `report`).

### Proyecto / handoff (fases del plan)

- `project-analyst/` — análisis de viabilidad de mercado.
- `project-business/` — análisis del modelo de negocio y viabilidad financiera.
- `project-content/` — estrategia de distribución y contenido.
- `project-execution/` — roadmap de ejecución 30/60/90.
- `project-naming/` — naming de marca.
- `project-voice/` — tono y voz de marca.
- `project-logo/` — identidad visual / logo.
- `project-template/` — plantilla / landing.

> Las fases de identidad (IDENTITY) se componen de las 4 sub-skills
> `project-naming`, `project-voice`, `project-logo` y `project-template`.

### Infraestructura

- `bridge-daemon/` — el daemon (`bridge.py`) + su `SKILL.md`. Poll-ea los jobs
  de la app, ejecuta el agente que toca y devuelve el resultado por callback.

> Agentes retirados (ya no existen aquí ni en el VPS, ni se despachan):
> `brew-qa-refiner` (Refinar/Pulir idea), `idea-renamer`, `project-branding`,
> `project-dev` y `project-dossier`.

## Sincronizar repo ↔ VPS

Bajar del VPS al repo (p. ej. tras un hotfix manual en el servidor):

```bash
python deploy/_download.py \
  /root/.openclaw/workspace/skills/<skill>/SKILL.md skills/<skill>/SKILL.md
```

Subir del repo al VPS tras editar aquí:

```bash
python deploy/_scp.py skills/<skill>/SKILL.md \
  /root/.openclaw/workspace/skills/<skill>/SKILL.md
```

Tras tocar `bridge.py`: validar y reiniciar en el VPS
(`python3 -m py_compile bridge.py && systemctl restart brew-bridge`).
