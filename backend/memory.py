"""
J.A.R.V.I.S. OS Memory and Preferences Store
Provides lightweight persistent local storage for user preferences, notes, and memory keys.
"""

import json
import time
import uuid
from pathlib import Path
from backend.config import DATA_DIR

MEMORY_FILE = DATA_DIR / "jarvis_memory.json"
NOTES_FILE = DATA_DIR / "jarvis_notes.txt"

def load_memory() -> dict:
    """Loads stored memory from disk."""
    if not MEMORY_FILE.exists():
        initial = {
            "user_name": "sir",
            "preferences": {
                "theme": "stealth",
                "voice_enabled": False,
                "preferred_model": "meta/llama-3.2-11b-vision-instruct"
            },
            "saved_facts": {},
            "recent_projects": []
        }
        save_memory(initial)
        return initial

    try:
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def save_memory(data: dict):
    """Saves memory to disk."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def set_fact(key: str, value: str):
    """Saves a fact or note in memory."""
    mem = load_memory()
    if "saved_facts" not in mem:
        mem["saved_facts"] = {}
    mem["saved_facts"][key] = {
        "value": value,
        "updated_at": time.time()
    }
    save_memory(mem)
    return {"success": True, "key": key, "value": value}

def get_fact(key: str):
    """Retrieves a stored fact."""
    mem = load_memory()
    facts = mem.get("saved_facts", {})
    return facts.get(key, {}).get("value")

def get_all_facts():
    """Returns all stored facts."""
    mem = load_memory()
    return mem.get("saved_facts", {})

def clear_all_memory():
    """Clears all stored memory facts."""
    mem = load_memory()
    mem["saved_facts"] = {}
    mem["recent_projects"] = []
    save_memory(mem)
    return {"success": True, "message": "All saved memory has been cleared, sir."}

# Notes handling
def get_notes() -> str:
    if not NOTES_FILE.exists():
        return ""
    try:
        with open(NOTES_FILE, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""

def save_notes(content: str):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(NOTES_FILE, "w", encoding="utf-8") as f:
        f.write(content)
    return {"success": True, "notes": content}

def append_to_notes(line: str):
    current = get_notes()
    new_content = current + ("\n" if current else "") + line.strip()
    save_notes(new_content)
    return {"success": True, "notes": new_content}
