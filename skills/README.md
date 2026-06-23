# Skills (agentes de IA)

Estas skills son los prompts/contratos que ejecuta el **bridge daemon** de
OpenClaw en el VPS. En el VPS viven en `/root/.openclaw/workspace/skills/`
(fuera del repo). Aquí se versionan para que **repo y VPS estén siempre
sincronizados**: el repo es la fuente de verdad.

## Contenido

- `skeptic-agent/` — investiga riesgos y objeciones de la idea.
- `advocate-agent/` — investiga oportunidades; refuta al escéptico.
- `judge-agent/` — sintetiza el debate y emite veredicto + score.
- `idea-generator/` — detecta oportunidades / estructura la idea del usuario.
- `bridge-daemon/` — el daemon (`bridge.py`) + su `SKILL.md`. Poll-ea los jobs
  de la app, ejecuta el agente que toca y devuelve el resultado por callback.

> La opción "Refinar/Pulir idea" (`brew-qa-refiner`) y `idea-renamer` se
> retiraron del producto: ya no existen aquí ni en el VPS.

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
