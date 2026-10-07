"""
J.A.R.V.I.S. OS Configuration Module
Handles environment variables, permitted directory resolution, and application registry.
"""

import os
from pathlib import Path

# Load local .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # Basic fallback parser if python-dotenv is not yet installed
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k not in os.environ:
                        os.environ[k] = v

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# API Configurations
BLUESMINDS_API_KEY = os.getenv("BLUESMINDS_API_KEY", "")
BLUESMINDS_API_BASE = os.getenv("BLUESMINDS_API_BASE", "https://api.bluesminds.com/v1")
DEFAULT_MODEL = os.getenv("BLUESMINDS_MODEL", "meta/llama-3.2-11b-vision-instruct")

# Server configuration
SERVER_HOST = os.getenv("JARVIS_HOST", "127.0.0.1")
SERVER_PORT = int(os.getenv("JARVIS_PORT", "5000"))

# Dynamic Windows/User Directory Discovery
USER_HOME = Path.home()

def resolve_allowed_directories():
    """
    Dynamically discovers and configures permitted working folders.
    Resolves Desktop, Documents, Downloads, and local JARVIS sandbox.
    Prevents hardcoding usernames and ensures Windows compatibility.
    """
    dirs = {}
    
    # Standard user folders
    desktop = USER_HOME / "Desktop"
    documents = USER_HOME / "Documents"
    downloads = USER_HOME / "Downloads"
    sandbox = DATA_DIR / "sandbox"
    sandbox.mkdir(parents=True, exist_ok=True)

    if desktop.exists():
        dirs["desktop"] = desktop.resolve()
    else:
        alt_desktop = sandbox / "Desktop"
        alt_desktop.mkdir(parents=True, exist_ok=True)
        dirs["desktop"] = alt_desktop.resolve()

    if documents.exists():
        dirs["documents"] = documents.resolve()
    else:
        alt_docs = sandbox / "Documents"
        alt_docs.mkdir(parents=True, exist_ok=True)
        dirs["documents"] = alt_docs.resolve()

    if downloads.exists():
        dirs["downloads"] = downloads.resolve()
    else:
        alt_dl = sandbox / "Downloads"
        alt_dl.mkdir(parents=True, exist_ok=True)
        dirs["downloads"] = alt_dl.resolve()
    
    dirs["sandbox"] = sandbox.resolve()
    
    return dirs

ALLOWED_DIRECTORIES = resolve_allowed_directories()

# Safe Application Registry (Predefined launch targets - no arbitrary shell commands)
WINDOWS_APP_REGISTRY = {
    "chrome": {
        "name": "Google Chrome",
        "commands": ["chrome.exe", "start chrome", r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"]
    },
    "edge": {
        "name": "Microsoft Edge",
        "commands": ["msedge.exe", "start msedge"]
    },
    "vscode": {
        "name": "Visual Studio Code",
        "commands": ["code.cmd", "code.exe", "code"]
    },
    "notepad": {
        "name": "Notepad",
        "commands": ["notepad.exe"]
    },
    "calculator": {
        "name": "Calculator",
        "commands": ["calc.exe"]
    },
    "explorer": {
        "name": "File Explorer",
        "commands": ["explorer.exe"]
    },
    "terminal": {
        "name": "Windows Terminal",
        "commands": ["wt.exe", "cmd.exe /c start cmd.exe"]
    },
    "settings": {
        "name": "Windows Settings",
        "commands": ["start ms-settings:"]
    },
    "taskmgr": {
        "name": "Task Manager",
        "commands": ["taskmgr.exe"]
    },
    "paint": {
        "name": "Paint",
        "commands": ["mspaint.exe"]
    }
}
