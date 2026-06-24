#!/usr/bin/env python3
"""
Brew Validator — Bridge Daemon
================================
Conecta los jobs PENDING de Brew con los agentes de OpenClaw.
También expone un endpoint HTTP en localhost:9090 para que la web
(Vercel) pueda actualizar la configuración de modelos.

Procesa:
  - Validación: skeptic, advocate, judge (3 agentes en secuencia)
  - Generación de ideas: idea-generator (standalone)
  - API local: POST /api/update-models, GET /api/health, GET /health

Heartbeat: en cada poll (cada 10s) hace POST /api/bridge/heartbeat a Vercel
para que la web pueda detectar si el bridge está vivo. Si el último
heartbeat tiene > 60s, la UI muestra un banner de error.
"""

import json
import os
import re
import signal
import subprocess
import sys
import time
import threading
import urllib.request
import urllib.error
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler

BREW_API = "http://127.0.0.1:3000"
POLL_INTERVAL = 10
POLL_SETTINGS_INTERVAL = 30
HEARTBEAT_INTERVAL = 20  # Must be < staleAfterSeconds (60) on the Vercel side
BRIDGE_PORT = 9090
BRIDGE_STARTED_AT = time.time()
BRIDGE_LAST_JOB_AT = None  # set when a job is picked up

# ── Live state tracker ────────────────────────────────────────────────
# Updated by execute_agent() and process_jobs() so the heartbeat can
# report *what* the bridge is doing right now, and *why* it might be
# slow or failing.
BRIDGE_STATE = "idle"            # idle | processing | error
BRIDGE_STATE_DETAIL = ""          # e.g. "Running judge with big-pickle" or "Model 401: promotion ended"
BRIDGE_CURRENT_AGENT = ""         # e.g. "skeptic", "idea-generator"
BRIDGE_CURRENT_MODEL = ""         # e.g. "opencode-zen-free/big-pickle"
BRIDGE_LAST_ERROR = ""            # last error message (cleared on success)
BRIDGE_LAST_ERROR_AT = None       # timestamp of last error
BRIDGE_JOBS_COMPLETED = 0         # total jobs completed this session
BRIDGE_JOBS_FAILED = 0            # total jobs failed this session

def _set_error(msg: str):
    """Update the live state tracker with an error message."""
    global BRIDGE_STATE, BRIDGE_STATE_DETAIL, BRIDGE_LAST_ERROR, BRIDGE_LAST_ERROR_AT, BRIDGE_JOBS_FAILED
    BRIDGE_STATE = "error"
    BRIDGE_STATE_DETAIL = msg
    BRIDGE_LAST_ERROR = msg
    BRIDGE_LAST_ERROR_AT = time.time()
    BRIDGE_JOBS_FAILED += 1
SKILLS_DIR = os.path.expanduser("~/.openclaw/workspace/skills")
CREDENTIALS_DIR = os.path.expanduser("~/.openclaw/credentials")
BRIDGE_SECRET_PATH = os.path.join(CREDENTIALS_DIR, "brew-validator-bridge-secret.txt")

def _load_bridge_secret():
    """Load BRIDGE_SECRET from credentials file. Returns empty string if not found."""
    try:
        if os.path.exists(BRIDGE_SECRET_PATH):
            with open(BRIDGE_SECRET_PATH) as f:
                return f.read().strip()
    except Exception:
        pass
    return ""

BRIDGE_SECRET = _load_bridge_secret()
CONFIG_PATH = os.path.join(SKILLS_DIR, "bridge-daemon", "agent-models.json")
AVAILABLE_MODELS_PATH = os.path.join(CREDENTIALS_DIR, "available-models.json")
DEFAULT_MODEL = "opencode-go/deepseek-v4-flash"
AGENT_MAP = {
    "skeptic": "skeptic-agent",
    "advocate": "advocate-agent",
    "judge": "judge-agent",
    "idea-generator": "idea-generator",
    "project-analyst": "project-analyst",
    "project-branding": "project-branding",
    "project-content": "project-content",
    "project-dev": "project-dev",
    "project-dossier": "project-dossier",
    "project-business": "project-business",
    "project-execution": "project-execution",
    "project-naming": "project-naming",
    "project-voice": "project-voice",
    "project-logo": "project-logo",
    "project-template": "project-template",
}
VALIDATION_AGENTS = ["skeptic", "advocate", "judge"]
GENERATOR_AGENTS = ["idea-generator"]
PROJECT_AGENTS =["project-analyst", "project-branding", "project-naming", "project-voice", "project-logo", "project-template", "project-content", "project-dev", "project-dossier", "project-business", "project-execution"]

# Agent ID in the bridge → settings key
AGENT_SETTINGS_KEY = {
    "idea-generator": "generator",
    "skeptic": "skeptic",
    "advocate": "defender",
    "judge": "judge",
    "project-analyst": "project-analyst",
    "project-branding": "project-branding",
    "project-content": "project-content",
    "project-dev": "project-dev",
    "project-dossier": "project-dossier",
    "project-business": "project-business",
    "project-execution": "project-execution",
    "project-naming": "project-naming",
    "project-voice": "project-voice",
    "project-logo": "project-logo",
    "project-template": "project-template",
}

BUSINESS_MODEL_DEFS = {
    "SaaS": "Software como servicio, suscripción mensual. Ej: Gestor de facturas online",
    "Marketplace": "Plataforma que conecta oferta y demanda. Ej: Wallapop, Airbnb",
    "E-commerce": "Tienda online, venta directa de productos. Ej: Tienda de zapatillas online",
    "App móvil": "Aplicación para dispositivos móviles. Ej: App de entrenamiento personal",
    "Plataforma": "Plataforma digital que ofrece un servicio. Ej: Comparador de seguros",
    "Negocio local": "Negocio físico con presencia online. Ej: Panadería con pedidos online",
    "Servicios": "Prestación de servicios profesionales. Ej: Plataforma de consultoría freelance",
    "Contenido/Media": "Creación y distribución de contenido. Ej: Newsletter de análisis tech",
    "Hardware/IoT": "Producto físico con conectividad. Ej: Sensor inteligente para hogar",
    "API/Infra": "Infraestructura tecnológica como producto. Ej: API de pagos para developers",
    "Impacto social": "Negocio con propósito social o ambiental. Ej: App de consumo responsable",
}


def log(msg):
    print(f"[bridge] {msg}", flush=True)


def clean_judge_report(markdown):
    """Post-procesa el reportMarkdown del juez para eliminar tablas duplicadas,
    repeticiones de puntuaciones, emojis decorativos y secciones redundantes.
    Los modelos pequeños tienden a ignorar la skill y generan 3+ tablas."""
    if not markdown:
        return markdown

    lines = markdown.split('\n')
    cleaned = []
    scorecard_table_found = False
    in_scorecard_table = False
    scorecard_header_seen = False
    last_table_row = -1
    header_row_idx = -1
    separator_row_idx = -1
    scorecard_section_seen = False

    for i, line in enumerate(lines):
        stripped = line.strip()

        # ── Detect and handle scorecard table ──
        is_table_sep = '|---' in stripped
        is_table_row = stripped.startswith('|') and '|' in stripped[1:]

        if is_table_sep or is_table_row:
            # Is this the scorecard table?
            is_scorecard = (
                'Dimensión' in stripped or 'Dimension' in stripped or
                'dimensión' in stripped or 'dimensio' in stripped or
                'Problema' in stripped or 'Puntuación' in stripped or
                'Justificación' in stripped or 'Total' in stripped
            )

            if is_scorecard and not scorecard_table_found:
                scorecard_table_found = True
                in_scorecard_table = True
                if is_table_sep:
                    separator_row_idx = i
                elif not scorecard_header_seen:
                    header_row_idx = i
                    scorecard_header_seen = True
                last_table_row = i
                cleaned.append(line)
            elif is_scorecard and scorecard_table_found and in_scorecard_table:
                # Still in the scorecard table
                last_table_row = i
                cleaned.append(line)
            elif in_scorecard_table and (i - last_table_row) <= 2:
                # Might still be the scorecard table (next rows)
                # Check if we're past the table
                if stripped == '' or (not is_table_sep and not is_table_row):
                    in_scorecard_table = False
                    cleaned.append(line)
                else:
                    last_table_row = i
                    cleaned.append(line)
            elif is_table_row and in_scorecard_table and (i - last_table_row) == 1:
                # Continuation row
                last_table_row = i
                cleaned.append(line)
            elif in_scorecard_table:
                # Empty line or another section after the table
                in_scorecard_table = False
                cleaned.append(line)
            else:
                # Another table (not scorecard) — SKIP
                continue
            continue

        # ── End of scorecard table detection (empty line after table) ──
        if in_scorecard_table and stripped == '':
            in_scorecard_table = False
            cleaned.append(line)
            continue

        # ── Remove duplicate scorecard section headers ──
        if re.match(r'^##\s+Scorecard', stripped, re.IGNORECASE):
            if scorecard_section_seen:
                continue
            scorecard_section_seen = True
            cleaned.append(line)
            continue

        # ── Remove standalone score lines (Problem: X/10, Market: Y/10) ──
        if re.match(r'^\s*(Problema|Mercado|Timing|Diferenciación|Diferenciacion|Ejecución|Ejecucion|Monetización|Monetizacion|Defendibilidad|Riesgo|Total)\s*:\s*\d', stripped):
            continue

        # ── Remove emoji-decorated lines (keep only if inside normal text) ──
        # Remove lines that are ONLY emojis or start with decorative emojis
        if re.match(r'^[\U0001F300-\U0001F9FF\u2600-\u27BF\u2B50\U0001F600-\U0001F64F\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\u2702-\u27B0\u24C2-\U0001F251\u200D\uFE0F\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF]+\s*$', stripped):
            continue

        # ── Remove lines with standalone scores like "7.0/10" or "5/10 - Good" ──
        if re.match(r'^\s*\d+\.?\d*/10\s*$', stripped):
            continue

        cleaned.append(line)

    result = '\n'.join(cleaned)

    # ── Normalize scores to 1 decimal (in the scorecard table) ──
    def normalize_score(m):
        num = float(m.group(1))
        return f"| {num:.1f} |"

    # Match patterns like "| 7 |" or "| 7.5 |" in table cells, normalize to 1 decimal
    result = re.sub(r'\|\s*(\d+(?:\.\d+)?)\s*\|', normalize_score, result)

    # Remove multiple blank lines
    result = re.sub(r'\n{3,}', '\n\n', result)

    return result.strip()


def clean_scorecard_json(scorecard_str):
    """Normaliza las puntuaciones del scorecard JSON a 1 decimal.

    Soporta los tres formatos:
      1. Array de objetos k/v/d: [{"k": "Problema", "v": 6.0, "d": "..."}, ...]  (nuevo, judge v4)
      2. Array de objetos key/value/description (legacy): [{"key": "Problema", "value": 6.0, ...}, ...]
      3. Objeto plano (legacy): {"Problema": 6.0, "Total": 5.6, ...}
    """
    if not scorecard_str:
        return scorecard_str
    try:
        sc = json.loads(scorecard_str)
        if isinstance(sc, list):
            for item in sc:
                if isinstance(item, dict):
                    # New format: k/v/d
                    if "v" in item:
                        val = item["v"]
                        if isinstance(val, (int, float)):
                            item["v"] = round(float(val), 1)
                    # Legacy array format: key/value/description
                    elif "value" in item:
                        val = item["value"]
                        if isinstance(val, (int, float)):
                            item["value"] = round(float(val), 1)
        elif isinstance(sc, dict):
            for k in list(sc.keys()):
                if isinstance(sc[k], (int, float)):
                    sc[k] = round(float(sc[k]), 1)
        return json.dumps(sc, ensure_ascii=False)
    except (json.JSONDecodeError, TypeError, ValueError):
        return scorecard_str


def load_available_models():
    """Load available models list from credentials. Falls back to built-in list."""
    fallback = [
        {"value": "opencode-go/deepseek-v4-flash", "label": "DeepSeek V4 Flash"},
        {"value": "opencode-go/deepseek-v4-pro", "label": "DeepSeek V4 Pro"},
        {"value": "opencode-go/minimax-m3-free", "label": "MiniMax M3 Free"},
        {"value": "opencode-go/kimi-k2.6", "label": "Kimi K2.6"},
        {"value": "opencode-go/mimo-v2.5-free", "label": "Mimo V2.5 Free"},
        {"value": "opencode-go/qwen3.6-plus-free", "label": "Qwen 3.6 Plus Free"},
        {"value": "opencode-go/nemotron-3-super-free", "label": "Nemotron 3 Super Free"},
        {"value": "opencode-go/big-pickle", "label": "Big Pickle"},
    ]
    try:
        if os.path.exists(AVAILABLE_MODELS_PATH):
            with open(AVAILABLE_MODELS_PATH, "r") as f:
                models = json.load(f)
                if isinstance(models, list) and len(models) > 0:
                    return models
    except Exception as e:
        log(f"⚠ Could not load available models: {e}")
    return fallback


def load_model_config():
    """Load agent model config from JSON file. Falls back to defaults."""
    defaults = {
        "generator": "opencode-zen-free/deepseek-v4-flash-free",
        "skeptic": "opencode-zen-free/deepseek-v4-flash-free",
        "defender": "opencode-zen-free/deepseek-v4-flash-free",
        "judge": "opencode-zen-free/minimax-m3-free",
        "refiner": "opencode-zen-free/deepseek-v4-flash-free",
    }
    try:
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, "r") as f:
                saved = json.load(f)
                if isinstance(saved, dict):
                    return {**defaults, **saved}
    except Exception as e:
        log(f"⚠ Could not load model config: {e}")
    return defaults


def get_agent_model(agent_name):
    """Get the configured model for a specific agent."""
    config = load_model_config()
    settings_key = AGENT_SETTINGS_KEY.get(agent_name)
    if settings_key:
        return config.get(settings_key, DEFAULT_MODEL)
    return DEFAULT_MODEL


def _auth_headers():
    """Return Authorization header if BRIDGE_SECRET is configured."""
    if BRIDGE_SECRET:
        return {"Authorization": f"Bearer {BRIDGE_SECRET}"}
    return {}

def api_get(path):
    req = urllib.request.Request(f"{BREW_API}{path}", headers=_auth_headers())
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def api_post(path, body):
    data = json.dumps(body).encode()
    headers = {"Content-Type": "application/json"}
    headers.update(_auth_headers())
    req = urllib.request.Request(f"{BREW_API}{path}", data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def read_skill(name):
    path = os.path.join(SKILLS_DIR, name, "SKILL.md")
    if os.path.exists(path):
        with open(path) as f:
            return f.read()
    return None


def send_heartbeat():
    """Best-effort POST to Vercel to record the bridge's last-alive timestamp.

    Vercel cannot reach 127.0.0.1:9090 (the bridge runs in Fran's VPS, not in
    Vercel). So we POST *out* to Vercel on every poll, and Vercel stores the
    timestamp in its DB. The web app reads `/api/bridge/status` to know if
    the bridge is alive (last heartbeat < 60s old).

    Failures are intentionally swallowed: a broken heartbeat must NEVER
    prevent the bridge from processing jobs.
    """
    global BRIDGE_LAST_JOB_AT
    try:
        payload = {
            "timestamp": time.time(),
            "uptime": int(time.time() - BRIDGE_STARTED_AT),
            "lastJobAt": BRIDGE_LAST_JOB_AT,
            "state": BRIDGE_STATE,
            "stateDetail": BRIDGE_STATE_DETAIL,
            "currentAgent": BRIDGE_CURRENT_AGENT,
            "currentModel": BRIDGE_CURRENT_MODEL,
            "lastError": BRIDGE_LAST_ERROR,
            "lastErrorAt": BRIDGE_LAST_ERROR_AT,
            "jobsCompleted": BRIDGE_JOBS_COMPLETED,
            "jobsFailed": BRIDGE_JOBS_FAILED,
        }
        hb_headers = {"Content-Type": "application/json"}
        hb_headers.update(_auth_headers())
        req = urllib.request.Request(
            f"{BREW_API}/api/bridge/heartbeat",
            data=json.dumps(payload).encode(),
            headers=hb_headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            resp.read()  # drain
    except Exception as e:
        # Don't spam logs on every poll — only log first failure
        if not hasattr(send_heartbeat, "_warned"):
            log(f"⚠ Heartbeat not delivered (will keep trying silently): {e}")
            send_heartbeat._warned = True


def _iter_json_objects(text):
    """Genera todos los objetos {...} balanceados que parseen como dict JSON."""
    depth = 0
    start = -1
    for i, ch in enumerate(text):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            if depth > 0:
                depth -= 1
                if depth == 0 and start != -1:
                    cand = text[start:i + 1]
                    try:
                        obj = json.loads(cand)
                        if isinstance(obj, dict):
                            yield obj
                    except json.JSONDecodeError:
                        pass
                    start = -1


def _best_json_object(text):
    """Objeto JSON mas relevante del texto: prioriza 'questions', luego
    'reportMarkdown'/'mode'; si no hay clave conocida, el de mas claves."""
    if not isinstance(text, str) or not text:
        return None
    objs = list(_iter_json_objects(text))
    if not objs:
        return None
    for key in ("questions", "reportMarkdown", "mode"):
        for o in objs:
            if key in o:
                return o
    return max(objs, key=len)


def parse_agent_output(output):
    """Extrae el JSON limpio del output del agente, tolerando texto alrededor
    (los modelos free suelen envolver el JSON en mucho analisis)."""
    try:
        parsed = json.loads(output)
    except (json.JSONDecodeError, TypeError):
        return _best_json_object(output if isinstance(output, str) else "")

    if not isinstance(parsed, dict):
        return parsed

    payloads = parsed.get("payloads", [])
    if payloads:
        combined = "\n".join(p.get("text", "") for p in payloads if isinstance(p, dict))
        for m in re.finditer(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", combined):
            try:
                obj = json.loads(m.group(1))
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict) and ("questions" in obj or "reportMarkdown" in obj):
                return obj
        best = _best_json_object(combined)
        if best is not None:
            return best
        return None

    return parsed


def execute_agent(instruction, agent_name="main", timeout=180, model_override=None, idea_id=None):
    """Execute an OpenClaw agent via CLI.

    If model_override is provided, use it directly (from job._bridgeModel).
    Otherwise fall back to the file-based config via get_agent_model().

    Session strategy:
      - If `idea_id` is provided, the session is DETERMINISTIC per
        (idea_id, agent_name). This means the same idea's jobs (e.g.
        skeptic → advocate → judge, or the refiner across multiple
        rounds) SHARE the session — the agent retains context between
        jobs and can reference prior outputs without us re-pasting them.
      - If `idea_id` is not provided (health checks, ad-hoc), we fall
        back to a random session id to keep jobs isolated.

    The agent 'brew' is dedicated to this skill — it has no codebot
    or build triggers and loads its own auth-profiles.json.
    """
    if model_override:
        model = model_override
    else:
        model = get_agent_model(agent_name)
    if idea_id and False:  # disabled: per-idea sessions caused context contamination between jobs
        # Per-idea session: stable across re-runs and across agents
        # working on the same idea. Lets the model keep context.
        session_id = f"brew-idea-{idea_id}-{agent_name}"
    else:
        # Per-job session: every job is fully isolated. Avoids context
        # contamination from prior ideas/validations.
        session_id = f"brew-{agent_name}-{int(time.time() * 1000)}-{os.getpid()}-{uuid.uuid4().hex[:8]}"
    # Dedicated agent 'brew' — only sees 6 skills (no codebot, no build triggers).
    # Loads its own auth-profiles.json (separate API key for usage tracking).
    cmd = ["openclaw", "agent",
           "--agent", "brew",
           "--session-id", session_id,  # <-- isolate each job
           "--local",
           "--message", instruction,
           "--model", model,
           "--json",
           "--timeout", str(timeout)]
    log(f"  Running {agent_name} with model: {model} (session={session_id[:24]}...)")
    # Update live state tracker (reported in heartbeat to Vercel)
    global BRIDGE_STATE, BRIDGE_STATE_DETAIL, BRIDGE_CURRENT_AGENT, BRIDGE_CURRENT_MODEL
    BRIDGE_STATE = "processing"
    BRIDGE_CURRENT_AGENT = agent_name
    BRIDGE_CURRENT_MODEL = model
    # User-friendly Spanish messages (what the UI shows)
    _AGENT_LABELS = {
        "idea-generator": "Creando idea",
        "skeptic": "Generando informe escéptico",
        "advocate": "Generando informe defensor",
        "judge": "Generando veredicto",
        "brew-qa-refiner": "Puliendo idea",
        "idea-renamer": "Buscando nombres",
        "project-analyst": "Analizando mercado",
        "project-branding": "Creando identidad de marca",
        "project-content": "Generando estrategia de distribución",
        "project-dev": "Creando landing page",
        "project-dossier": "Compilando dossier completo",
        "project-business": "Analizando modelo de negocio",
        "project-execution": "Generando roadmap 30/60/90",
    }
    BRIDGE_STATE_DETAIL = _AGENT_LABELS.get(agent_name, "Procesando")
    # Spawn the subprocess in its own process group (Popen + start_new_session)
    # so that on timeout we can SIGKILL the entire group — child node processes
    # launched by the CLI often ignore SIGTERM and Python's default TimeoutExpired
    # only sends SIGTERM, which leaves the node process alive and the bridge
    # blocked forever.
    env = os.environ.copy()
    brew_key_path = os.path.join(CREDENTIALS_DIR, "brew-opencode-key.txt")
    if os.path.exists(brew_key_path):
        with open(brew_key_path) as _kf:
            env["OPENCODE_API_KEY"] = _kf.read().strip()
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=os.path.expanduser("~/.openclaw/workspace"),
            env=env,
            start_new_session=True,  # own process group
        )
        try:
            stdout, stderr = proc.communicate(timeout=timeout + 20)
        except subprocess.TimeoutExpired:
            # Kill the whole process group: the openclaw CLI + any node child
            # it spawned. SIGKILL is the only signal that works reliably here.
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            proc.wait(timeout=5)
            log(f"  ⚠ Timeout — killed process group for {agent_name}")
            _set_error(f"Timeout after {timeout}s — {agent_name} with {model.split('/')[-1]}")
            return None
        if proc.returncode != 0:
            err_msg = (stderr or "").strip()[:300]
            log(f"  ⚠ CLI exit {proc.returncode}: {err_msg[:200]}")
            # Detect specific errors for user-friendly messages (Spanish)
            _model_short = model.split('/')[-1]
            if "401" in err_msg and "promotion has ended" in err_msg:
                _set_error(f"El modelo {_model_short} ya no es gratuito. Cámbialo en Ajustes.")
            elif "401" in err_msg:
                _set_error(f"Error de autenticación con el modelo {_model_short}.")
            elif "timeout" in err_msg.lower() or "timed out" in err_msg.lower():
                _set_error(f"Tiempo de espera agotado en {_AGENT_LABELS.get(agent_name, 'el agente')}.")
            else:
                _set_error(f"Error en {_AGENT_LABELS.get(agent_name, agent_name)}.")
            return None
        output = (stdout or "").strip()
        log(f"  Output: {len(output)} chars")
        try:
            open("/tmp/last_agent_output.txt", "w").write(output)
        except Exception:
            pass
        # Success — clear error state
        global BRIDGE_JOBS_COMPLETED
        BRIDGE_STATE = "idle"
        BRIDGE_STATE_DETAIL = ""
        BRIDGE_CURRENT_AGENT = ""
        BRIDGE_LAST_ERROR = ""
        BRIDGE_JOBS_COMPLETED += 1
        return parse_agent_output(output)
    except FileNotFoundError:
        log(f"  ❌ openclaw CLI not found in PATH")
        _set_error("openclaw CLI no encontrado en el servidor")
        return None
    except Exception as e:
        log(f"  ⚠ Error: {e}")
        _set_error(f"Error ejecutando {agent_name}: {str(e)[:150]}")
        return None
def execute_agent_with_retry(instruction, agent_name="main", timeout=180, model_override=None, idea_id=None, required_keys=None):
    """execute_agent + 1 reintento si el modelo no devuelve JSON válido.

    Los modelos gratuitos a veces responden con prosa o JSON roto. En vez de
    fallar el job, reintentamos UNA vez con un recordatorio estricto de "solo
    JSON". Devuelve el dict parseado, o None si ambos intentos fallan.
    """
    result = execute_agent(instruction, agent_name=agent_name, timeout=timeout, model_override=model_override, idea_id=idea_id)
    ok = isinstance(result, dict) and (not required_keys or all(result.get(k) for k in required_keys))
    if ok:
        return result
    log(f"  ↻ {agent_name}: salida no válida, reintento con recordatorio JSON")
    retry_instruction = instruction + (
        "\n\nIMPORTANTE: tu respuesta anterior no fue JSON válido. Devuelve "
        "ÚNICAMENTE el objeto JSON pedido, sin texto antes ni después y sin ```."
    )
    result2 = execute_agent(retry_instruction, agent_name=agent_name, timeout=timeout, model_override=model_override, idea_id=idea_id)
    if isinstance(result2, dict) and (not required_keys or all(result2.get(k) for k in required_keys)):
        return result2
    return result if isinstance(result, dict) else result2


def process_idea_generator(job, idea):
    """Process a single idea-generator job.
    
    The job input contains: { rawIdea, sector?, targetUser?, hints? }
    The skill output is: { title, description, targetUser, monetization }
    """
    job_id = job["id"]
    idea_id = job["ideaId"]
    agent_name = job["agentName"]
    skill_name = AGENT_MAP[agent_name]
    skill_content = read_skill(skill_name)
    job_input = json.loads(job.get("input", "{}"))
    bridge_model = job_input.pop("_bridgeModel", None)

    raw_idea = job_input.get("rawIdea", "")
    sector = job_input.get("sector", "")
    target = job_input.get("targetUser", "")
    hints = job_input.get("hints", "")
    is_random = (raw_idea == "random")

    # Año dinámico (lo pasa la app en el job input). Evita fechas fijas en el
    # prompt que envejecen.
    cur_year = job_input.get("_currentYear")
    prev_year = job_input.get("_previousYear")
    year_ctx = (
        f"\nCONTEXTO TEMPORAL: año actual {cur_year}, año anterior {prev_year}. "
        f"Investiga tendencias recientes (últimos 6-12 meses) usando estos años, "
        f"no fechas fijas.\n"
        if cur_year else ""
    )

    mode_label = "random" if is_random else "custom"
    log(f"▶ {agent_name} ({job_id[:12]}) — mode={mode_label}")

    # Mark as RUNNING
    try:
        api_post(f"/api/jobs/{job_id}/status", {"status": "RUNNING"})
    except Exception as e:
        log(f"  ⚠ Failed to mark job {job_id[:12]} as RUNNING: {e}")

    instruction = f"""
INSTRUCCIÓN: Eres un generador de ideas de negocio. Usa web_search para investigar y genera una propuesta estructurada.

SKILL:
{skill_content}
{year_ctx}
"""

    if is_random:
        bm_raw = job_input.get('businessModel', '')
        bm_full = ""
        if bm_raw and bm_raw in BUSINESS_MODEL_DEFS:
            bm_full = f"\nMODELO DE NEGOCIO: {bm_raw} — {BUSINESS_MODEL_DEFS[bm_raw]}"

        instruction += f"""
MODO: Aleatorio — genera 1 idea viable basada en tendencias de mercado actuales.
Busca datos reales con web_search sobre tendencias de negocio, startups y oportunidades.{bm_full}

⚠️ REGLA OBLIGATORIA SOBRE EL TIPO DE NEGOCIO:
EL TIPO DE NEGOCIO INDICADO ES VINCULANTE. La idea generada debe corresponder EXACTAMENTE a ese tipo de negocio.
Por ejemplo: si el tipo es "Impacto social", la idea DEBE ser un negocio con propósito social o ambiental medible, NO una app genérica de productividad, marketplace, ni SaaS sin componente social.
No cambies el tipo de negocio bajo ninguna circunstancia. La definición del modelo incluye su descripción y ejemplo; úsalos como guía estricta.
"""
    else:
        bm_raw = job_input.get('businessModel', '')
        bm_full = bm_raw or "No especificado"
        bm_def = ""
        if bm_raw and bm_raw in BUSINESS_MODEL_DEFS:
            bm_full = f"{bm_raw} — {BUSINESS_MODEL_DEFS[bm_raw]}"
            bm_def = f"\nDEFINICIÓN DEL MODELO: {BUSINESS_MODEL_DEFS[bm_raw]}"

        instruction += f"""
MODO: Personalizado — reformula y estructura la siguiente idea en bruto del usuario.

IDEA EN BRUTO DEL USUARIO:
"{raw_idea}"

SECTOR: {sector if sector else "No especificado"}
PÚBLICO OBJETIVO: {target if target else "No especificado"}
PISTAS/ENFOQUE: {hints if hints else "No especificado"}
MODELO DE NEGOCIO: {bm_full}{bm_def}

⚠️ REGLA OBLIGATORIA SOBRE EL TIPO DE NEGOCIO:
EL TIPO DE NEGOCIO INDICADO ES VINCULANTE. La idea reformulada debe corresponder EXACTAMENTE a ese tipo de negocio.
Por ejemplo: si el tipo es "Impacto social", la idea DEBE ser un negocio con propósito social o ambiental medible, NO una app genérica de productividad, marketplace, ni SaaS sin componente social.
Si la idea en bruto del usuario contradice el tipo de negocio seleccionado, REFORMULA la idea para que se ajuste al tipo, NO cambies el tipo.
La definición del modelo incluye su descripción y ejemplo; úsalos como guía estricta.

Investiga el sector y mercado con web_search para enriquecer la idea con datos reales.
Mantén la esencia de la idea del usuario pero mejórala con contexto de mercado.
"""

    instruction += '\n\nRESPONDE SOLO CON JSON EXACTO:\n{"title": "NombreCorto", "description": "Descripción estructurada", "problem": "Problema específico que resuelve", "valueProposition": "Propuesta de valor única", "targetUser": "Público objetivo específico", "monetization": "Modelo de monetización concreto"}\n\nIMPORTANTE: title debe ser SOLO el nombre de la idea, sin descripción, sin guiones, sin coletilla. Ej: "BarApp" no "BarApp — Comandas para bares". Los campos problem y valueProposition son obligatorios.'

    result = execute_agent_with_retry(instruction, agent_name="idea-generator", timeout=300, model_override=bridge_model, idea_id=idea_id, required_keys=["title", "description"])
    if result and "title" in result and "description" in result:
        callback = {
            "jobId": job_id,
            "status": "COMPLETED",
            "output": {
                "title": result.get("title", ""),
                "description": result.get("description", ""),
                "problem": result.get("problem", ""),
                "valueProposition": result.get("valueProposition", ""),
                "targetUser": result.get("targetUser", ""),
                "monetization": result.get("monetization", ""),
            },
            "cost": 0.05,
        }
        try:
            api_post("/api/webhooks/agent-callback", callback)
            log(f"  ✅ {agent_name} submitted — title={result.get('title', '')[:40]}")
        except Exception as e:
            log(f"  ❌ Callback fail: {e}")
    else:
        log(f"  ❌ {agent_name} no valid result (missing title/description)")
        try:
            api_post("/api/webhooks/agent-callback", {"jobId": job_id, "status": "FAILED", "error": "idea-generator: no se pudo generar una idea válida"})
        except Exception:
            pass


def process_qa_refiner(job, idea):
    """Process a brew-qa-refiner job — quiz or chat mode.
    
    Quiz mode (two-phase):
      Phase 1 — input has NO answers → agent generates ALL questions → QUESTIONS_READY
      Phase 2 — input HAS answers → agent generates refined idea → DONE
    
    Chat mode input: { idea, conversationHistory, mode: "chat" }
    """
    job_id = job["id"]
    idea_id = job["ideaId"]
    agent_name = job["agentName"]
    skill_name = AGENT_MAP[agent_name]
    skill_content = read_skill(skill_name)
    job_input = json.loads(job.get("input", "{}"))
    bridge_model = job_input.pop("_bridgeModel", None)

    log(f"▶ {agent_name} ({job_id[:12]})")

    # Mark as RUNNING
    try:
        api_post(f"/api/jobs/{job_id}/status", {"status": "RUNNING"})
    except Exception as e:
        log(f"  ⚠ Failed to mark job {job_id[:12]} as RUNNING: {e}")

    mode = job_input.get("mode", "chat")

    if mode == "quiz":
        process_quiz_mode(job_id, job_input, skill_content, bridge_model, idea_id=idea_id)
    elif mode == "manual":
        process_manual_text_mode(job_id, job_input, skill_content, bridge_model, idea_id=idea_id)
    else:
        process_chat_mode(job_id, job_input, skill_content, bridge_model, idea_id=idea_id)


def process_quiz_mode(job_id, job_input, skill_content, bridge_model=None, idea_id=None):
    """Process a quiz-mode refinement job (two-phase).
    
    Phase 1 (no answers): Agent generates ALL questions at once.
    Phase 2 (with answers): Agent generates refined idea DONE.
    """
    idea_data = job_input.get("idea", {})
    answers = job_input.get("answers", [])

    has_answers = len(answers) > 0
    phase = "Fase 2 (con respuestas)" if has_answers else "Fase 1 (sin respuestas)"
    log(f"  Quiz mode — {phase}")

    instruction = f"""
INSTRUCCIÓN: Eres un consultor de negocio refinando una idea mediante preguntas.

SKILL:
{skill_content}

IDEA ACTUAL:
- Título: {idea_data.get('title', '')}
- Descripción: {idea_data.get('description', '')}
- Usuario objetivo: {idea_data.get('targetUser', '')}
- Monetización: {idea_data.get('monetization', '')}
"""

    if idea_data.get('problem'):
        instruction += f"- Problema: {idea_data.get('problem')}\n"
    if idea_data.get('valueProposition'):
        instruction += f"- Propuesta de valor: {idea_data.get('valueProposition')}\n"

    if has_answers:
        # ── Phase 2: Generate refined idea from answers ──
        instruction += f"""
MODO: Quiz — Fase 2 (refinamiento con respuestas)

RESPUESTAS DEL EMPRENDEDOR:
"""
        for a in answers:
            instruction += f"\n- Pregunta: {a.get('questionText', a.get('question', ''))}"
            instruction += f"\n  Respuesta: {a.get('answer', '')}"

        instruction += """

Todas las preguntas han sido respondidas. Genera la VERSIÓN REFINADA FINAL.
Usa web_search para enriquecer las sugerencias con datos reales de mercado.

Analiza las respuestas del emprendedor e incorpora los insights en la idea refinada.

Si la idea ha evolucionado significativamente, puedes sugerir un cambio de modelo
de negocio más adecuado en el campo suggestedBusinessModel.

Responde SOLO con JSON:
{"status": "DONE", "title": "Título actual (sin cambios)", "description": "Descripción mejorada", "problem": "Problema refinado", "valueProposition": "Propuesta de valor mejorada", "targetUser": "Público objetivo refinado", "monetization": "Modelo de monetización refinado", "summary": "Resumen amigable para el usuario explicando los cambios realizados y por qué", "suggestedBusinessModel": "SaaS, Marketplace, etc. (solo si la idea ha evolucionado mucho, si no, omite este campo)"}
"""
    else:
        # ── Phase 1: Generate ALL questions at once ──
        instruction += """
MODO: Quiz — Fase 1 (generación de preguntas)

Genera TODAS las preguntas de UNA SOLA VEZ. Mínimo 5, máximo 8 según el contexto.

Cada pregunta debe tener:
- id: identificador único (q1, q2, q3...)
- questionText: la pregunta en español
- options: exactamente 3 opciones sugeridas por IA

Usa web_search para investigar el sector y mercado antes de generar las preguntas.

Responde SOLO con JSON:
{"status": "QUESTIONS_READY", "questions": [{"id": "q1", "questionText": "...", "options": ["opcion1", "opcion2", "opcion3"]}]}
"""

    result = execute_agent(instruction, agent_name="brew-qa-refiner", timeout=240, model_override=bridge_model, idea_id=idea_id or "")
    if result and "status" in result:
        agent_status = result.get("status", "?")

        if agent_status == "QUESTIONS_READY":
            # Questions generated — leave job COMPLETED so UI can poll the output
            callback = {
                "jobId": job_id,
                "status": "COMPLETED",
                "output": result,
                "cost": 0.03,
            }
            n_q = len(result.get("questions", []))
            log(f"  ✅ qa-refiner submitted — QUESTIONS_READY ({n_q} preguntas)")
        elif agent_status == "DONE":
            # Refined idea generated — COMPLETED
            callback = {
                "jobId": job_id,
                "status": "COMPLETED",
                "output": result,
                "cost": 0.03,
            }
            log(f"  ✅ qa-refiner submitted — DONE title={result.get('title', '')[:40]}")
        else:
            # Unknown status, still submit
            callback = {
                "jobId": job_id,
                "status": "COMPLETED",
                "output": result,
                "cost": 0.03,
            }
            log(f"  ✅ qa-refiner submitted — status={agent_status}")

        try:
            api_post("/api/webhooks/agent-callback", callback)
        except Exception as e:
            log(f"  ❌ Callback fail: {e}")
    else:
        log(f"  ❌ qa-refiner (quiz) no valid result")
        try:
            api_post(f"/api/jobs/{job_id}/status", {"status": "FAILED", "error": "No valid result from agent"})
        except Exception:
            pass


def process_manual_text_mode(job_id, job_input, skill_content, bridge_model=None, idea_id=None):
    """Process a manual-text refinement job.

    The user pastes raw text describing their refined idea. The agent
    structures it into the standard fields and returns a DONE result.
    """
    idea_data = job_input.get("idea", {})
    raw_text = job_input.get("rawText", "")

    log(f"  Manual mode — raw text ({len(raw_text)} chars)")

    instruction = f"""
INSTRUCCIÓN: Eres un consultor de negocio refinando una idea emprendedora.

SKILL:
{skill_content}

IDEA ACTUAL (ANTES):
- Título: {idea_data.get('title', '')}
- Descripción: {idea_data.get('description', '')}
- Usuario objetivo: {idea_data.get('targetUser', '')}
- Monetización: {idea_data.get('monetization', '')}
"""

    if idea_data.get('problem'):
        instruction += f"- Problema: {idea_data.get('problem')}\n"
    if idea_data.get('valueProposition'):
        instruction += f"- Propuesta de valor: {idea_data.get('valueProposition')}\n"

    instruction += f"""

MODO: Manual — el usuario ha redactado una versión mejorada en texto libre.

TEXTO DEL EMPRENDEDOR:
{raw_text}

Estructura y organiza el texto del emprendedor en los campos estándar de la idea.
Usa web_search para enriquecer las sugerencias con datos reales de mercado.
Mejora cada campo basándote en el texto del usuario y tu investigación.

Si la idea ha evolucionado significativamente, puedes sugerir un cambio de modelo
de negocio más adecuado en el campo suggestedBusinessModel.

Responde SOLO con JSON:
{{"status": "DONE", "title": "Título actual (sin cambios)", "description": "Descripción mejorada", "problem": "Problema refinado", "valueProposition": "Propuesta de valor mejorada", "targetUser": "Público objetivo refinado", "monetization": "Modelo de monetización refinado", "summary": "Resumen amigable para el usuario explicando los cambios realizados y por qué", "suggestedBusinessModel": "SaaS, Marketplace, etc. (solo si la idea ha evolucionado mucho, si no, omite este campo)"}}
"""

    result = execute_agent(instruction, agent_name="brew-qa-refiner", timeout=240, model_override=bridge_model, idea_id=idea_id or "")
    if result and "status" in result:
        callback = {
            "jobId": job_id,
            "status": "COMPLETED",
            "output": result,
            "cost": 0.03,
        }
        status = result.get("status", "?")
        log(f"  ✅ qa-refiner (manual) submitted — status={status}")
        try:
            api_post("/api/webhooks/agent-callback", callback)
        except Exception as e:
            log(f"  ❌ Callback fail: {e}")
    else:
        log(f"  ❌ qa-refiner (manual) no valid result")
        try:
            api_post(f"/api/jobs/{job_id}/status", {"status": "FAILED", "error": "No valid result from agent"})
        except Exception:
            pass


def process_chat_mode(job_id, job_input, skill_content, bridge_model=None, idea_id=None):
    """Process a chat-mode refinement job (legacy)."""
    conversation_history = job_input.get("conversationHistory", [])
    idea_data = job_input.get("idea", {})

    log(f"  Chat mode — {len(conversation_history)} messages")

    message_count = len([m for m in conversation_history if m.get("role") == "user"])
    should_finish = (message_count >= 3)

    instruction = f"""
INSTRUCCIÓN: Eres un consultor de negocio refinando una idea emprendedora mediante conversación.

SKILL:
{skill_content}

IDEA ACTUAL:
- Título: {idea_data.get('title', '')}
- Descripción: {idea_data.get('description', '')}
- Usuario objetivo: {idea_data.get('targetUser', '')}
- Monetización: {idea_data.get('monetization', '')}

HISTORIAL DE CONVERSACIÓN:
"""

    for msg in conversation_history:
        role_label = "EMPRENDEDOR" if msg.get("role") == "user" else "CONSULTOR"
        instruction += f"\n{role_label}: {msg.get('content', '')}"

    if should_finish:
        instruction += """

La conversación ha tenido suficientes intercambios. Es hora de generar la VERSIÓN REFINADA FINAL.
Responde SOLO con JSON:
{"status": "DONE", "title": "Título refinado", "description": "Descripción mejorada", "targetUser": "Público objetivo refinado", "monetization": "Modelo de monetización refinado", "summary": "Resumen amigable para el usuario explicando los cambios"}
"""
    else:
        instruction += """

Haz UNA SOLA pregunta contextual relevante. Basa tu pregunta en el último mensaje del emprendedor.
NO hagas preguntas genéricas ya respondidas. Responde SOLO con JSON:
{"status": "RUNNING", "message": "Tu pregunta contextual aquí"}
"""

    result = execute_agent(instruction, agent_name="brew-qa-refiner", timeout=180, model_override=bridge_model, idea_id=idea_id or "")
    if result and "status" in result:
        callback = {
            "jobId": job_id,
            "status": "COMPLETED",
            "output": result,
            "cost": 0.03,
        }
        try:
            api_post("/api/webhooks/agent-callback", callback)
            status = result.get("status", "?")
            log(f"  ✅ qa-refiner (chat) submitted — status={status}")
        except Exception as e:
            log(f"  ❌ Callback fail: {e}")
    else:
        log(f"  ❌ qa-refiner (chat) no valid result")
        try:
            api_post(f"/api/jobs/{job_id}/status", {"status": "FAILED", "error": "No valid result from agent"})
        except Exception:
            pass


def process_idea_renamer(job, idea):
    """Process a idea-renamer job.
    
    Generates name suggestions for a business idea with domain checks.
    Input: { title, description, problem, targetUser, monetization, businessModel }
    Output: { suggestions: [{ name, available, reason }] }
    """
    job_id = job["id"]
    idea_id = job["ideaId"]
    agent_name = job["agentName"]
    skill_name = AGENT_MAP[agent_name]
    skill_content = read_skill(skill_name)
    job_input = json.loads(job.get("input", "{}"))
    bridge_model = job_input.pop("_bridgeModel", None)

    log(f"▶ {agent_name} ({job_id[:12]})")

    # Mark as RUNNING
    try:
        api_post(f"/api/jobs/{job_id}/status", {"status": "RUNNING"})
    except Exception as e:
        log(f"  ⚠ Failed to mark job {job_id[:12]} as RUNNING: {e}")

    instruction = f"""
INSTRUCCIÓN: Eres un experto en naming y branding de startups. Tu tarea es generar nombres creativos y originales para una idea de negocio.

SKILL:
{skill_content}

CONTEXTO DE LA IDEA:
- Título actual: {job_input.get('title', '')}
- Descripción: {job_input.get('description', '')}
- Problema: {job_input.get('problem', 'No especificado')}
- Usuario objetivo: {job_input.get('targetUser', 'No especificado')}
- Monetización: {job_input.get('monetization', 'No especificado')}
- Modelo de negocio: {job_input.get('businessModel', 'No especificado')}

Investiga con web_search nombres existentes en este sector, dominios .com disponibles, y posibles conflictos con marcas registradas.

Genera MÍNIMO 10 sugerencias de nombres originales.

RESPONDE SOLO CON JSON EXACTO:
{{"suggestions": [{{"name": "NombreSugerido", "available": true, "reason": "Por qué este nombre encaja bien con la idea"}}]}}
"""

    result = execute_agent(instruction, agent_name="idea-renamer", timeout=300, model_override=bridge_model, idea_id=idea_id)
    if result and isinstance(result, dict) and "suggestions" in result:
        suggestions = result["suggestions"]
        if isinstance(suggestions, list) and len(suggestions) > 0:
            callback = {
                "jobId": job_id,
                "status": "COMPLETED",
                "output": {
                    "suggestions": suggestions,
                },
                "cost": 0.04,
            }
            try:
                api_post("/api/webhooks/agent-callback", callback)
                log(f"  ✅ {agent_name} submitted — {len(suggestions)} suggestions")
            except Exception as e:
                log(f"  ❌ Callback fail: {e}")
            return

    log(f"  ❌ {agent_name} no valid suggestions")
    try:
        api_post(f"/api/jobs/{job_id}/status", {"status": "FAILED", "error": "No valid suggestions generated"})
    except Exception:
        pass


def process_project_phase(job):
    """Process a project-phase job (analyst, branding, content, dev, dossier).

    The job.input contains:
    {
      mode: "questions" | "report",
      subStep: "naming" | "voice" | "visual" | "plan_30_60_90" | "final" | null,
      subStepOrder: 0 | 1 | 2 | 3 | null,
      ideaContext: { ... full idea data ... },
      previousArtifacts: [ { title, content } ],
      projectMemory: { ... decisions from previous phases ... },
      contextRules: "..." (pre-formatted rules about what NOT to ask),
      answers: { q1: "...", q2: "..." } (only for mode "report"),
      subStepChoice: "..." (option chosen in previous sub-step, if any),
      previousSubStep: "..." (id of previous sub-step, if any),
      _bridgeModel: "..." (optional model override)
    }

    Two modes:
    - "questions": agent generates interactive questions for the user
    - "report": agent uses context + user answers to generate the report
    """
    job_id = job["id"]
    idea_id = job["ideaId"]
    agent_name = job["agentName"]
    skill_name = AGENT_MAP[agent_name]
    skill_content = read_skill(skill_name)
    job_input = json.loads(job.get("input", "{}"))
    bridge_model = job_input.pop("_bridgeModel", None)
    mode = job_input.get("mode", "report")

    sub_step = job_input.get("subStep", None)
    sub_step_order = job_input.get("subStepOrder", None)
    
    log_label = f"{agent_name} ({job_id[:12]}) mode={mode}"
    if sub_step:
        log_label += f" subStep={sub_step}"
    log(f"\u25b6 {log_label}")

    # Mark as RUNNING
    try:
        api_post(f"/api/jobs/{job_id}/status", {"status": "RUNNING"})
    except Exception as e:
        log(f"  ⚠ Failed to mark job {job_id[:12]} as RUNNING: {e}")

    # Build instruction from context
    idea_ctx = job_input.get("ideaContext", {})
    prev_artifacts = job_input.get("previousArtifacts", [])
    answers = job_input.get("answers", {})
    project_memory = job_input.get("projectMemory", {})
    context_rules = job_input.get("contextRules", "")
    sub_step_choice = job_input.get("subStepChoice", None)
    previous_sub_step = job_input.get("previousSubStep", None)

    context_parts = []
    context_parts.append(f"Mode: {mode}")
    if sub_step:
        context_parts.append(f"SubStep: {sub_step}")
    if sub_step_order is not None:
        context_parts.append(f"SubStepOrder: {sub_step_order}")
    context_parts.append(f"## Idea Context\n\nTítulo: {idea_ctx.get('title', 'N/A')}\nDescripción: {idea_ctx.get('description', 'N/A')}\nProblema: {idea_ctx.get('problem', 'N/A')}\nPropuesta de valor: {idea_ctx.get('valueProposition', 'N/A')}\nUsuario objetivo: {idea_ctx.get('targetUser', 'N/A')}\nMonetización: {idea_ctx.get('monetization', 'N/A')}\nModelo de negocio: {idea_ctx.get('businessModel', 'N/A')}")

    if prev_artifacts:
        context_parts.append(f"## Previous Phases")
        for a in prev_artifacts:
            title = a.get("title", "Artifact")
            content_preview = a.get("content", "")[:3000]
            context_parts.append(f"### {title}\n\n{content_preview}")

    if answers:
        context_parts.append("## User Answers")
        for q_id, ans in answers.items():
            context_parts.append(f"{q_id}: {ans}")

    # Pass projectMemory and contextRules if available
    if project_memory:
        context_parts.append(f"## Project Memory (Decisiones previas)\n\n{json.dumps(project_memory, ensure_ascii=False, indent=2)}")
    
    if context_rules:
        context_parts.append(f"## Context Rules\n\n{context_rules}")
    
    # Pass subStepChoice if available (user's choice in previous sub-step)
    if sub_step_choice:
        context_parts.append(f"## SubStep Choice (Elección del usuario en la subfase anterior)\n\n{sub_step_choice}")
    
    # Pass previousSubStep if available
    if previous_sub_step:
        context_parts.append(f"## Previous SubStep\n\n{previous_sub_step}")

    context_str = "\n\n".join(context_parts)

    # ── Construccion de la instruccion segun el modo ──
    if mode == "questions":
        # En modo preguntas NO mandamos el skill pesado: hace que el modelo se ponga
        # a investigar (web_search) y devuelva un informe en vez de preguntas.
        # Mandamos un prompt ENFOCADO que produce un JSON pequeno de preguntas,
        # rapido y fiable incluso con modelos free.
        _QHINTS = {
            "project-analyst": ("la viabilidad de mercado de la idea", "Cubre estos ejes: barreras competitivas ocultas, normativa legal del sector, canales de captacion iniciales y validacion de hipotesis clave."),
            "project-business": ("la viabilidad financiera del negocio", "Cubre estos ejes: costes fijos mensuales estimados, dedicacion economica inicial (capital propio), expectativas de precio frente a la competencia y pasarelas de pago."),
            "project-content": ("la estrategia de distribucion y contenido", "Cubre estos ejes: disponibilidad de tiempo semanal, experiencia del equipo en marketing y preferencias de canales."),
            "project-execution": ("el roadmap y la ejecucion 30/60/90", "Cubre estos ejes: fechas limite que condicionen el plan, tamano del equipo ejecutor y dependencias tecnicas criticas."),
            "project-branding": ("la identidad visual de la marca", "Cubre estos ejes: estilo visual deseado, paleta de colores, referencias o marcas que admira y tipografia."),
        }
        _topic, _axes = _QHINTS.get(agent_name, ("la idea", ""))
        _desc = (idea_ctx.get("description", "") or "")[:500]
        _idea_brief = (idea_ctx.get("title", "") + " - " + _desc).strip(" -")
        _mem = ""
        if project_memory:
            try:
                _mem = json.dumps(project_memory, ensure_ascii=False)[:800]
            except Exception:
                _mem = ""
        instruction = (
            "Eres un consultor de estrategia experto. Genera EXACTAMENTE 4-5 preguntas "
            "tipo choice para un breve cuestionario al fundador sobre " + _topic + ".\n\n"
            "IDEA: " + _idea_brief + "\n\n"
            + (("DECISIONES PREVIAS (no preguntes sobre esto): " + _mem + "\n\n") if _mem else "")
            + (_axes + "\n\n" if _axes else "")
            + "REGLAS ESTRICTAS:\n"
            "- NO investigues, NO uses web_search ni web_fetch, NO generes ningun informe ni analisis.\n"
            "- Preguntas de DECISION estrategica, no de descubrimiento.\n"
            "- Cada pregunta: id corto en snake_case, label claro en espanol, type \"choice\", y 3-4 options especificas y personalizadas a ESTE proyecto.\n"
            "- Aplica la regla linguistica: cada sigla o tecnicismo lleva su significado en espanol entre parentesis la primera vez.\n"
            "- Responde UNICAMENTE con este JSON, sin texto antes ni despues ni fences de markdown:\n"
            "{\"mode\":\"questions\",\"questions\":[{\"id\":\"q1\",\"label\":\"...\",\"type\":\"choice\",\"options\":[\"A\",\"B\",\"C\"]}]}"
        )
    else:
        instruction = (
            "Eres el agente " + agent_name + ". Sigue las instrucciones de la skill al pie de la letra.\n\n"
            + skill_content + "\n\n--- CONTEXTO ---\n\n" + context_str
        )

    # Determine model
    if bridge_model:
        model = bridge_model
    else:
        model = get_agent_model(agent_name)

    timeout = 300 if mode == "report" else 120
    # Reintento tolerante: el informe de fase (sobre todo Estrategia/Distribución)
    # puede ser enorme y el parser falla de forma intermitente por el escapado del
    # markdown dentro del JSON; si el 1er intento no parsea, reintenta pidiendo SOLO JSON.
    result = execute_agent_with_retry(instruction, agent_name=agent_name, timeout=timeout, model_override=model, idea_id=idea_id)

    if result is None:
        log(f"  \u26a0 {agent_name} returned None — marking FAILED")
        # Post to BOTH the job status endpoint AND the webhook.
        # The job-status endpoint only updates the Job row; the webhook
        # also resets the phase status back to AVAILABLE so the user
        # can retry instead of seeing an infinite "processing" state.
        try:
            api_post(f"/api/jobs/{job_id}/status", {"status": "FAILED", "error": "Agent returned no output"})
        except Exception:
            pass
        try:
            api_post("/api/webhooks/project-phase-callback", {"jobId": job_id, "status": "FAILED", "error": "Agent returned no output"})
        except Exception:
            pass
        return

    # Include mode in callback so the webhook knows how to process it
    callback = {
        "jobId": job_id,
        "status": "COMPLETED",
        "output": result,
        "mode": mode,
        "cost": 0.0,
    }
    log(f"  \u2705 Posting callback for {job_id[:12]} mode={mode} ({len(result)} chars)")

    try:
        api_post("/api/webhooks/project-phase-callback", callback)
    except Exception as e:
        log(f"  \u26a0 Callback failed: {e}")
        # Post to BOTH endpoints so the phase gets reset
        try:
            api_post(f"/api/jobs/{job_id}/status", {"status": "FAILED", "error": f"Callback failed: {str(e)[:100]}"})
        except Exception:
            pass
        try:
            api_post("/api/webhooks/project-phase-callback", {"jobId": job_id, "status": "FAILED", "error": f"Callback failed: {str(e)[:100]}"})
        except Exception:
            pass


def process_validation_jobs(idea):
    """Process skeptic/advocate/judge jobs for a validating idea."""
    idea_id = idea["id"]
    log(f"📦 Validating: {idea['title']} ({idea_id[:12]})")

    jobs = api_get(f"/api/jobs/pending?ideaId={idea_id}")
    if not jobs:
        return

    # Filter to only validation agents
    jobs = [j for j in jobs if j.get("agentName") in VALIDATION_AGENTS]
    if not jobs:
        return

    reports = {}
    for agent_name in ["skeptic", "advocate", "judge"]:
        job = next((j for j in jobs if j.get("agentName") == agent_name), None)
        if not job:
            continue

        job_id = job["id"]
        skill_name = AGENT_MAP[agent_name]
        skill_content = read_skill(skill_name)
        job_input = json.loads(job.get("input", "{}"))
        bridge_model = job_input.pop("_bridgeModel", None)

        log(f"▶ {agent_name} ({job_id[:12]})")
        try:
            api_post(f"/api/jobs/{job_id}/status", {"status": "RUNNING"})
        except Exception as e:
            log(f"  ⚠ Failed to mark job {job_id[:12]} as RUNNING: {e}")

        instruction = f"""
INSTRUCCIÓN: Eres un agente de validación de ideas de negocio.

SKILL:
{skill_content}

CONTEXTO:
{json.dumps(job_input, ensure_ascii=False, indent=2)}
"""
        if agent_name == "advocate" and "skeptic" in reports:
            instruction += f"\n\nREPORTE ESCÉPTICO A REFUTAR:\n{reports['skeptic'][:3000]}"
        elif agent_name == "judge":
            for name, r in reports.items():
                instruction += f"\n\nREPORTE {name.upper()}:\n{r[:5000]}"

        # Skeptic and advocate: no verdict (they present facts, the judge decides)
        if agent_name in ("skeptic", "advocate"):
            instruction += '\n\nRESPONDE SOLO CON JSON EXACTO:\n{"reportMarkdown": "..."}'
        else:
            instruction += '\n\nRESPONDE SOLO CON JSON EXACTO:\n{"reportMarkdown": "...", "verdict": "Adelante|Pulir idea|Revisar|No viable"'
        if agent_name == "judge":
            instruction += ', "scorecard": "[{\\"k\\":\\"Problema\\",\\"v\\":6.0,\\"d\\":\\"Necesidad real validada pero con competencia.\\"},{\\"k\\":\\"Mercado\\",\\"v\\":7.0,\\"d\\":\\"CAGR 10.9%, mercado desatendido.\\"},{\\"k\\":\\"Timing\\",\\"v\\":5.0,\\"d\\":\\"IA en auge pero mercado prematuro.\\"},{\\"k\\":\\"Diferenciación\\",\\"v\\":4.0,\\"d\\":\\"Segmentación novedosa pero replicable.\\"},{\\"k\\":\\"Ejecución\\",\\"v\\":3.5,\\"d\\":\\"Plan por fases bien estructurado.\\"},{\\"k\\":\\"Monetización\\",\\"v\\":4.5,\\"d\\":\\"Freemium viable pero requiere escala.\\"},{\\"k\\":\\"Defendibilidad\\",\\"v\\":3.0,\\"d\\":\\"Sin barreras técnicas ni de red.\\"},{\\"k\\":\\"Riesgo\\",\\"v\\":3.0,\\"d\\":\\"Alto por saturación y cambios regulatorios.\\"},{\\"k\\":\\"Total\\",\\"v\\":4.5,\\"d\\":\\"\\"}]"'
        instruction += "}"

        judge_timeout = 300 if agent_name == "judge" else 180
        result = execute_agent_with_retry(instruction, agent_name=agent_name, timeout=judge_timeout, model_override=bridge_model, idea_id=idea_id, required_keys=["reportMarkdown"])
        if result:
            report_md = result.get("reportMarkdown", json.dumps(result))

            # ── Post-procesado para el juez: limpiar tablas duplicadas y repeticiones ──
            if agent_name == "judge":
                # [DIAG] Log del scorecard crudo que emite el LLM, antes de normalizar
                raw_scorecard_for_diag = result.get("scorecard", "<NONE>")
                log(f"🔍 JUDGE raw scorecard: {str(raw_scorecard_for_diag)[:500]}")
                original_len = len(report_md)
                report_md = clean_judge_report(report_md)
                scorecard_raw = result.get("scorecard", "")
                result["scorecard"] = clean_scorecard_json(scorecard_raw)
                log(f"  🧹 Judge report cleaned: {original_len} → {len(report_md)} chars")

            reports[agent_name] = report_md

            callback = {
                "jobId": job_id,
                "status": "COMPLETED",
                "output": {
                    "reportMarkdown": report_md,
                    "verdict": result.get("verdict", ""),
                    "scorecard": result.get("scorecard", ""),
                    "score": result.get("score", None),
                },
                "cost": 0.03,
            }
            try:
                api_post("/api/webhooks/agent-callback", callback)
                log(f"  ✅ {agent_name} submitted")
            except Exception as e:
                log(f"  ❌ Callback fail: {e}")
        else:
            log(f"  ❌ {agent_name} no result")
            # Falla la idea YA (vía agent-callback) en vez de dejar el job
            # RUNNING y la idea girando hasta que el reaper la corte a los 10
            # min. El webhook marca validationStatus=FAILED para que el usuario
            # vea el error y pueda reintentar al instante.
            try:
                api_post("/api/webhooks/agent-callback", {"jobId": job_id, "status": "FAILED", "error": f"{agent_name}: el modelo no devolvió resultado tras reintento"})
            except Exception:
                pass
            break
        time.sleep(2)


# (eliminado) process_project_skill: la opción "Mejorar skill con IA" se retiró;
# las skills del handoff se generan solo desde plantilla determinista en la app.


def process_jobs():
    global BRIDGE_LAST_JOB_AT
    log("🔍 Checking for pending jobs...")

    # ── 0. Heartbeat: tell Vercel we're alive ──
    # Done FIRST so even idle bridges (no jobs) keep the heartbeat fresh.
    send_heartbeat()

    # Track if we actually picked up any job this cycle
    picked_up_jobs = False

    try:
        # ── 1. Process idea-generator jobs ──
        try:
            gen_data = api_get("/api/jobs/pending")
            gen_jobs = [j for j in gen_data if j.get("agentName") in GENERATOR_AGENTS]
            for job in gen_jobs:
                picked_up_jobs = True
                try:
                    idea = api_get(f"/api/ideas/{job['ideaId']}")
                    process_idea_generator(job, idea)
                except NameError as e:
                    job_id = job.get("id", "?")
                    idea_id = job.get("ideaId", "?")
                    log(f"⚠ Generator NameError on job={job_id} idea={idea_id}: {e}")
                    try:
                        api_post(f"/api/jobs/{job_id}/status", {"status": "FAILED", "error": f"NameError: {str(e)[:180]}"})
                    except Exception:
                        pass
                    continue
                except Exception as e:
                    job_id = job.get("id", "?")
                    idea_id = job.get("ideaId", "?")
                    log(f"⚠ Generator error on job={job_id} idea={idea_id}: {e}")
                    try:
                        api_post(f"/api/jobs/{job_id}/status", {"status": "FAILED", "error": str(e)[:200]})
                    except Exception:
                        pass
                    continue
                time.sleep(2)
        except urllib.error.HTTPError as e:
            if e.code != 404:
                log(f"⚠ HTTP {e.code} checking generator jobs")
        except Exception as e:
            log(f"⚠ Generator check: {e}")

        # (Eliminado) qa-refiner e idea-renamer: la opción "Pulir/Refinar idea"
        # se retiró del producto. No se despachan esos agentes.

        # ── 1d. Process project-phase jobs ──
        try:
            proj_data = api_get("/api/jobs/pending")
            proj_jobs = [j for j in proj_data if j.get("agentName") in PROJECT_AGENTS]
            for job in proj_jobs:
                picked_up_jobs = True
                try:
                    process_project_phase(job)
                except Exception as e:
                    job_id = job.get("id", "?")
                    log(f"⚠ Project phase error on job={job_id}: {e}")
                    try:
                        api_post(f"/api/jobs/{job_id}/status", {"status": "FAILED", "error": str(e)[:200]})
                    except Exception:
                        pass
                    continue
                time.sleep(2)
        except urllib.error.HTTPError as e:
            if e.code != 404:
                log(f"⚠ HTTP {e.code} checking project jobs")
        except Exception as e:
            log(f"⚠ Project check: {e}")

        # (eliminado) 1e. project-skills: la mejora de skills con IA se retiró.

        # ── 2. Process validation jobs ──
        try:
            data = api_get("/api/ideas")
            ideas = [i for i in data if i.get("validationStatus") == "RUNNING"]
            for idea in ideas:
                picked_up_jobs = True
                process_validation_jobs(idea)
        except urllib.error.HTTPError as e:
            if e.code != 404:
                log(f"⚠ HTTP {e.code}")
        except Exception as e:
            log(f"⚠ Error: {e}")

        # ── Mark last job pickup time if any job was processed ──
        if picked_up_jobs:
            BRIDGE_LAST_JOB_AT = time.time()

    except KeyboardInterrupt:
        raise
    except Exception as e:
        log(f"⚠ Main loop: {e}")


# ──────────────────────────────────────────────
#  Local HTTP server — bridge API endpoint
# ──────────────────────────────────────────────

class BridgeHandler(BaseHTTPRequestHandler):
    """Lightweight HTTP handler for the bridge API.
    
    POST /api/update-models — receives model config and writes to agent-models.json
    GET  /api/health         — health-check endpoint
    """

    def _send_json(self, status_code: int, data: dict):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/health" or self.path == "/health":
            self._send_json(200, {
                "status": "ok",
                "service": "bridge-daemon",
                "uptime": int(time.time() - BRIDGE_STARTED_AT),
                "lastJobAt": BRIDGE_LAST_JOB_AT,
                "version": "1.0",
            })
        else:
            self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        if self.path == "/api/update-models":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(length)
                config = json.loads(raw.decode("utf-8"))

                if not isinstance(config, dict):
                    self._send_json(400, {"error": "Expected a JSON object"})
                    return

                # Validate model values — only allow known provider prefixes
                for key, value in config.items():
                    if not isinstance(value, str) or "/" not in value:
                        self._send_json(400, {"error": f"Invalid model value for '{key}': {value}"})
                        return

                # Write to agent-models.json
                os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
                with open(CONFIG_PATH, "w") as f:
                    json.dump(config, f, indent=2, ensure_ascii=False)
                    f.write("\n")

                log(f"📝 Model config updated via API: {list(config.keys())}")
                self._send_json(200, {"success": True, "models": list(config.keys())})

            except json.JSONDecodeError:
                self._send_json(400, {"error": "Invalid JSON"})
            except Exception as e:
                log(f"❌ Error updating models: {e}")
                self._send_json(500, {"error": str(e)})
        else:
            self._send_json(404, {"error": "Not found"})

    def log_message(self, format, *args):
        # Quiet HTTP logging — only log on errors
        if args[1] not in ("200", "204"):
            log(f"[http] {args[0]} {args[1]}")


def start_http_server():
    """Start the bridge HTTP server on localhost:BRIDGE_PORT."""
    server = HTTPServer(("127.0.0.1", BRIDGE_PORT), BridgeHandler)
    log(f"🌐 Bridge API listening on http://127.0.0.1:{BRIDGE_PORT}")
    server.serve_forever()


def sync_model_settings():
    """Poll Vercel for the latest agent-models config and update local file if changed.

    Esto resuelve el problema de que el usuario cambia el modelo en Ajustes,
    hace POST a Vercel, pero Vercel (serverless) no puede conectar al bridge
    en localhost. El bridge sondea la DB de Vercel para sincronizar.
    """
    try:
        req = urllib.request.Request(f"{BREW_API}/api/settings/agent-models", headers=_auth_headers())
        with urllib.request.urlopen(req, timeout=10) as resp:
            remote_config = json.loads(resp.read().decode())
    except Exception as e:
        log(f"⚠ Settings sync: could not fetch from Vercel: {e}")
        return

    if not isinstance(remote_config, dict):
        log(f"⚠ Settings sync: unexpected response type: {type(remote_config)}")
        return

    # Load current local config
    local_config = {}
    try:
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, "r") as f:
                local_config = json.load(f)
    except Exception as e:
        log(f"⚠ Settings sync: could not read local config: {e}")

    # Compare: detect additions, changes, and removals
    all_keys = set(list(remote_config.keys()) + list(local_config.keys()))
    changed = []
    for key in sorted(all_keys):
        old_val = local_config.get(key)
        new_val = remote_config.get(key)
        if old_val != new_val:
            if old_val is None:
                changed.append(f"+ {key}: (none) → {new_val}")
            elif new_val is None:
                changed.append(f"- {key}: {old_val} → (none)")
            else:
                changed.append(f"~ {key}: {old_val} → {new_val}")

    if not changed:
        return  # No changes, nothing to do

    # MERGE: keep local-only keys (like project agents) that remote doesn't have
    merged_config = {**remote_config}
    for key in local_config:
        if key not in remote_config:
            merged_config[key] = local_config[key]
    
    # Write the updated config
    try:
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        with open(CONFIG_PATH, "w") as f:
            json.dump(merged_config, f, indent=2, ensure_ascii=False)
            f.write("\n")
        log(f"📝 Settings synced from Vercel ({len(changed)} changes):")
        for line in changed:
            log(f"    {line}")
    except Exception as e:
        log(f"❌ Settings sync: could not write config: {e}")


def heartbeat_loop():
    """Background loop that POSTs /api/bridge/heartbeat to Vercel every
    HEARTBEAT_INTERVAL seconds.

    This runs on its own daemon thread so the bridge stays 'alive' in
    Vercel's view even when the main loop is busy executing a long-running
    agent (the old inline heartbeat was blocked for the full duration of
    the agent, which is exactly when Vercel needs to see fresh timestamps).
    """
    # Slight stagger so the heartbeat and the main poll don't fire at the
    # exact same instant.
    time.sleep(2)
    while True:
        try:
            send_heartbeat()
        except Exception as e:
            if not hasattr(heartbeat_loop, "_warned"):
                log(f"⚠ Heartbeat loop: {e}")
                heartbeat_loop._warned = True
        time.sleep(HEARTBEAT_INTERVAL)


def settings_sync_loop():
    """Background loop that polls Vercel for model config changes every POLL_SETTINGS_INTERVAL seconds."""
    while True:
        try:
            sync_model_settings()
        except Exception as e:
            log(f"⚠ Settings sync loop: {e}")
        time.sleep(POLL_SETTINGS_INTERVAL)


def main():
    log(f"🚀 Bridge started — polling {BREW_API} every {POLL_INTERVAL}s")

    # Start HTTP server in a daemon thread
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()

    # Heartbeat thread: posts /api/bridge/heartbeat to Vercel every
    # HEARTBEAT_INTERVAL seconds, INDEPENDENTLY of agent execution.
    # This is what keeps the "IA disponible" banner green while the
    # main loop is busy running a 200s agent subprocess.
    heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
    heartbeat_thread.start()

    # Settings sync thread: re-reads the user's current config from Vercel
    # every POLL_SETTINGS_INTERVAL seconds. The model is ALSO carried in each
    # job's _bridgeModel field (snapshot at job creation), so the bridge
    # never uses a stale config for a job whose model was set at queue time.
    # But this thread ensures the agent-models.json file (used for fallback
    # when _bridgeModel is missing) stays in sync with the DB.
    sync_thread = threading.Thread(target=settings_sync_loop, daemon=True)
    sync_thread.start()

    available = load_available_models()
    model_values = [m.get("value", "") for m in available if m.get("value")]
    log(f"📋 {len(model_values)} available models: {', '.join(model_values[:5])}{'...' if len(model_values) > 5 else ''}")
    config = load_model_config()
    for key, val in config.items():
        log(f"  🤖 {key} → {val}")
    while True:
        try:
            process_jobs()
        except KeyboardInterrupt:
            log("👋 Done"); sys.exit(0)
        except Exception as e:
            log(f"⚠ Loop: {e}")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
