#!/usr/bin/env python3
"""
Test script: verify bridge model configuration loading.

Usage: python3 test-model-config.py
"""
import json
import os
import sys

SKILLS_DIR = os.path.expanduser("~/.openclaw/workspace/skills")
CONFIG_PATH = os.path.join(SKILLS_DIR, "bridge-daemon", "agent-models.json")
CREDENTIALS_DIR = os.path.expanduser("~/.openclaw/credentials")
AVAILABLE_MODELS_PATH = os.path.join(CREDENTIALS_DIR, "available-models.json")

AGENT_SETTINGS_KEY = {
    "idea-generator": "generator",
    "skeptic": "skeptic",
    "advocate": "defender",
    "judge": "judge",
    "brew-qa-refiner": "refiner",
    "idea-renamer": "generator",
}

DEFAULTS = {
    "generator": "opencode-go/deepseek-v4-flash",
    "skeptic": "opencode-go/deepseek-v4-flash",
    "defender": "opencode-go/deepseek-v4-flash",
    "judge": "opencode-go/deepseek-v4-pro",
    "refiner": "opencode-go/deepseek-v4-flash",
}

def load_model_config():
    """Replicates bridge load_model_config logic."""
    try:
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, "r") as f:
                saved = json.load(f)
                if isinstance(saved, dict):
                    return {**DEFAULTS, **saved}
    except Exception as e:
        print(f"ERROR loading config: {e}")
    return DEFAULTS


def load_available_models():
    """Replicates bridge load_available_models logic."""
    try:
        if os.path.exists(AVAILABLE_MODELS_PATH):
            with open(AVAILABLE_MODELS_PATH, "r") as f:
                models = json.load(f)
                if isinstance(models, list) and len(models) > 0:
                    return models
    except Exception as e:
        print(f"ERROR loading available models: {e}")
    return []


def main():
    print("=" * 60)
    print("Bridge Model Config Verification")
    print("=" * 60)

    # 1. Check if config file exists
    print(f"\n[1] Config path: {CONFIG_PATH}")
    if os.path.exists(CONFIG_PATH):
        print(f"    EXISTS")
        with open(CONFIG_PATH, "r") as f:
            print(f"    Content: {f.read()}")
    else:
        print(f"    NOT FOUND (will use defaults)")

    # 2. Load config
    config = load_model_config()
    print(f"\n[2] Effective model config:")
    for key, val in config.items():
        print(f"    {key:12s} -> {val}")

    # 3. Check available models
    print(f"\n[3] Available models path: {AVAILABLE_MODELS_PATH}")
    if os.path.exists(AVAILABLE_MODELS_PATH):
        models = load_available_models()
        print(f"    EXISTS ({len(models)} models)")
        for m in models[:5]:
            print(f"    - {m.get('id', '?')} ({m.get('owned_by', '?')})")
        if len(models) > 5:
            print(f"    ... and {len(models) - 5} more")
    else:
        print(f"    NOT FOUND (will use fallback)")

    # 4. Map each agent to model
    print(f"\n[4] Agent -> Model mapping:")
    for agent_name, settings_key in AGENT_SETTINGS_KEY.items():
        model = config.get(settings_key, DEFAULTS.get(settings_key, "UNKNOWN"))
        print(f"    {agent_name:20s} ({settings_key:10s}) -> {model}")

    print(f"\n[5] Verification complete.")

    # Validate all required agents have models
    all_ok = True
    for settings_key in ["generator", "skeptic", "defender", "judge", "refiner"]:
        if settings_key not in config:
            print(f"    ERROR: missing config for {settings_key}")
            all_ok = False
    if all_ok:
        print(f"    All required agents have models configured.")

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
