#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Deploy de prompts de skills al VPS (Servidor privado virtual) de producción
vía SSH (Protocolo de shell seguro) usando paramiko.

SEGURIDAD: lee VPS_HOST / VPS_USER / VPS_PASSWORD de .env.local. NUNCA imprime
secretos. No hardcodea credenciales.

Flujo:
  1. Backup de las skills VIVAS del VPS → docs/skills-vps-backup/<fecha>/ (rollback).
  2. Sube las versiones fusionadas de docs/skills-backup/*.md a
     /root/.openclaw/workspace/skills/<skill>/SKILL.md, stripeando el header
     "BACKUP — solo lectura" para dejar el SKILL.md limpio.

Uso:  python scripts/deploy_skills_vps.py
"""
import os
import sys
import datetime
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("ERROR: falta paramiko (pip install paramiko)", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
REMOTE_SKILLS = "/root/.openclaw/workspace/skills"

# Mapa: archivo local (docs/skills-backup) -> carpeta de skill en el VPS
MAP = {
    "project-analyst.md": "project-analyst",
    "project-business.md": "project-business",
    "project-branding.md": "project-branding",
    # Fase 3 separada en 4 sub-skills independientes (naming/voice/logo/template).
    # project-branding.md se mantiene como fallback durante la transición.
    "project-naming.md": "project-naming",
    "project-voice.md": "project-voice",
    "project-logo.md": "project-logo",
    "project-template.md": "project-template",
    "project-content.md": "project-content",
    "project-execution.md": "project-execution",
    "project-skills.md": "project-skills",
    "phase-substep-protocol.md": "phase-substep-protocol",
}


def load_env(path: Path) -> dict:
    """Lee KEY=VALUE de .env.local (tolera comillas y espacios)."""
    env = {}
    if not path.exists():
        print(f"ERROR: no existe {path}", file=sys.stderr)
        sys.exit(1)
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def strip_backup_header(text: str) -> str:
    """Elimina el bloque de cabecera de backup hasta el primer separador '---'.

    Los archivos en docs/skills-backup empiezan con un bloque
    '# <name> — Backup ... ---' y luego el contenido real. La skill viva en el
    VPS NO debe llevar ese header. Si no hay header, devuelve el texto íntegro.
    """
    lines = text.splitlines(keepends=True)
    for i, ln in enumerate(lines):
        if ln.strip() == "---":
            rest = "".join(lines[i + 1:]).lstrip("\n")
            return rest if rest.strip() else text
    return text


def main() -> int:
    env = load_env(ROOT / ".env.local")
    host = env.get("VPS_HOST", "").strip()
    user = env.get("VPS_USER", "").strip()
    password = env.get("VPS_PASSWORD", "").strip()
    if not host or not user or not password:
        print("ERROR: faltan VPS_HOST/VPS_USER/VPS_PASSWORD en .env.local", file=sys.stderr)
        return 1

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    local_backup = ROOT / "docs" / "skills-vps-backup" / stamp
    local_backup.mkdir(parents=True, exist_ok=True)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"==> Conectando a {user}@{host} ...")
    client.connect(hostname=host, username=user, password=password, timeout=20, look_for_keys=False, allow_agent=False)
    sftp = client.open_sftp()
    try:
        # 1) Backup de skills vivas
        print(f"==> Backup de skills vivas en {local_backup.relative_to(ROOT)}")
        for folder in MAP.values():
            remote = f"{REMOTE_SKILLS}/{folder}/SKILL.md"
            dest = local_backup / f"{folder}.SKILL.md"
            try:
                sftp.get(remote, str(dest))
                print(f"   ok  {folder}")
            except IOError:
                print(f"   --  {folder} (no existía en el VPS, se omite)")

        # 2) Deploy de versiones fusionadas
        print("==> Desplegando versiones fusionadas")
        for fname, folder in MAP.items():
            src = ROOT / "docs" / "skills-backup" / fname
            if not src.exists():
                print(f"   !!  falta {src.name}, se omite")
                continue
            content = strip_backup_header(src.read_text(encoding="utf-8"))
            remote_dir = f"{REMOTE_SKILLS}/{folder}"
            client.exec_command(f"mkdir -p '{remote_dir}'")
            remote_file = f"{remote_dir}/SKILL.md"
            with sftp.open(remote_file, "w") as fh:
                fh.write(content)
            print(f"   ->  {folder} desplegado ({len(content)} chars)")
    finally:
        sftp.close()
        client.close()

    print(f"==> Deploy completado. Backup de rollback en docs/skills-vps-backup/{stamp}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
