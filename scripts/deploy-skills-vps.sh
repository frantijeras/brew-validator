#!/usr/bin/env bash
# =============================================================================
# Deploy de prompts de skills al VPS (Servidor privado virtual) de producción.
#
# SEGURIDAD: lee VPS_HOST / VPS_USER / VPS_PASSWORD de .env.local. NUNCA
# hardcodea ni imprime secretos. No lo comitees con credenciales.
#
# Flujo:
#   1. Descarga (backup) las skills VIVAS del VPS a docs/skills-vps-backup/<fecha>/
#      → red de seguridad para rollback.
#   2. Sube las versiones fusionadas de docs/skills-backup/*.md a
#      /root/.openclaw/workspace/skills/<skill>/SKILL.md (stripeando el header
#      de "BACKUP — solo lectura" para dejar el SKILL.md limpio).
#
# Requisitos de auth (elige uno):
#   - sshpass instalado  → auth por contraseña no interactiva (lee VPS_PASSWORD).
#   - clave SSH en agente → exporta USE_SSH_KEY=1 y NO se usa la contraseña.
#   - ejecución interactiva → si no hay sshpass ni clave, ssh pedirá la
#     contraseña por terminal (se reusa una sola conexión con ControlMaster).
#
# Uso:  bash scripts/deploy-skills-vps.sh
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── Cargar credenciales de .env.local (sin imprimirlas) ──
if [[ ! -f .env.local ]]; then
  echo "ERROR: no existe .env.local con VPS_HOST/VPS_USER/VPS_PASSWORD" >&2
  exit 1
fi
VPS_HOST="$(grep -E '^VPS_HOST=' .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')"
VPS_USER="$(grep -E '^VPS_USER=' .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')"
VPS_PASSWORD="$(grep -E '^VPS_PASSWORD=' .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')"
: "${VPS_HOST:?falta VPS_HOST}" "${VPS_USER:?falta VPS_USER}"

REMOTE_SKILLS="/root/.openclaw/workspace/skills"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOCAL_BACKUP="docs/skills-vps-backup/$STAMP"

# Mapa: archivo local (docs/skills-backup) → carpeta de skill en el VPS
declare -A MAP=(
  ["project-analyst.md"]="project-analyst"
  ["project-business.md"]="project-business"
  ["project-branding.md"]="project-branding"
  ["project-content.md"]="project-content"
  ["project-execution.md"]="project-execution"
  ["phase-substep-protocol.md"]="phase-substep-protocol"
)

# ── Helpers SSH/SCP (auth por sshpass, clave o interactiva) ──
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
if command -v sshpass >/dev/null 2>&1 && [[ -n "${VPS_PASSWORD:-}" && "${USE_SSH_KEY:-0}" != "1" ]]; then
  RUN_SSH=(sshpass -p "$VPS_PASSWORD" ssh "${SSH_OPTS[@]}")
  RUN_SCP=(sshpass -p "$VPS_PASSWORD" scp "${SSH_OPTS[@]}")
else
  echo "INFO: sin sshpass — se usará clave/agente o se pedirá la contraseña por terminal." >&2
  RUN_SSH=(ssh "${SSH_OPTS[@]}")
  RUN_SCP=(scp "${SSH_OPTS[@]}")
fi

# ── 1) Backup de las skills vivas ──
echo "==> Backup de skills vivas en $LOCAL_BACKUP"
mkdir -p "$LOCAL_BACKUP"
for skill in "${MAP[@]}"; do
  "${RUN_SCP[@]}" "$VPS_USER@$VPS_HOST:$REMOTE_SKILLS/$skill/SKILL.md" \
    "$LOCAL_BACKUP/$skill.SKILL.md" 2>/dev/null \
    && echo "   ok  $skill" || echo "   --  $skill (no existía en VPS, se omite)"
done

# ── 2) Subir versiones fusionadas (stripeando el header de backup) ──
echo "==> Desplegando versiones fusionadas"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
for file in "${!MAP[@]}"; do
  skill="${MAP[$file]}"
  src="docs/skills-backup/$file"
  [[ -f "$src" ]] || { echo "   !!  falta $src, se omite"; continue; }
  # Strip del bloque de cabecera "BACKUP — solo lectura": elimina todo hasta el
  # primer separador '---' que precede al título real "# <skill>".
  awk 'BEGIN{done=0} done==0 && /^---[[:space:]]*$/ {done=1; next} done==1 {print}' "$src" > "$TMP/SKILL.md"
  # Si el archivo no tenía header, el awk dejaría vacío → usa el original.
  [[ -s "$TMP/SKILL.md" ]] || cp "$src" "$TMP/SKILL.md"
  "${RUN_SSH[@]}" "$VPS_USER@$VPS_HOST" "mkdir -p '$REMOTE_SKILLS/$skill'"
  "${RUN_SCP[@]}" "$TMP/SKILL.md" "$VPS_USER@$VPS_HOST:$REMOTE_SKILLS/$skill/SKILL.md"
  echo "   ✓  $skill desplegado"
done

echo "==> Deploy completado. Backup de rollback en $LOCAL_BACKUP"
echo "    Rollback: subir de vuelta los .SKILL.md de esa carpeta a sus rutas."
