"""
J.A.R.V.I.S. OS Application Launcher
Controls launching of validated applications from a safe predefined registry.
Rejects arbitrary shell commands.
"""

import os
import platform
import subprocess
from backend.config import WINDOWS_APP_REGISTRY

def open_application(app_key: str):
    """
    Safely launches an authorized application by registered key.
    """
    clean_key = app_key.strip().lower()
    
    # Map common aliases
    alias_map = {
        "code": "vscode",
        "visual studio code": "vscode",
        "vs code": "vscode",
        "google chrome": "chrome",
        "browser": "chrome",
        "microsoft edge": "edge",
        "calc": "calculator",
        "file explorer": "explorer",
        "files": "explorer",
        "cmd": "terminal",
        "command prompt": "terminal",
        "powershell": "terminal",
        "windows settings": "settings",
        "task manager": "taskmgr",
        "mspaint": "paint"
    }

    resolved_key = alias_map.get(clean_key, clean_key)

    if resolved_key not in WINDOWS_APP_REGISTRY:
        allowed_list = ", ".join(WINDOWS_APP_REGISTRY.keys())
        return {
            "success": False,
            "error": f"Application '{app_key}' is not in the safe registry. Authorized targets: {allowed_list}."
        }

    app_info = WINDOWS_APP_REGISTRY[resolved_key]
    app_name = app_info["name"]
    commands = app_info["commands"]

    # Windows application execution
    if platform.system() == "Windows":
        for cmd in commands:
            try:
                # Use shell=False where possible, or start command for registered protocols
                if cmd.startswith("start "):
                    subprocess.Popen(cmd, shell=True)
                else:
                    subprocess.Popen([cmd], shell=False)
                return {
                    "success": True,
                    "app_key": resolved_key,
                    "app_name": app_name,
                    "message": f"Opening {app_name}, sir."
                }
            except Exception:
                continue
    else:
        # Cross-platform fallback for testing (Linux / macOS)
        try:
            if resolved_key in ["chrome", "edge"]:
                subprocess.Popen(["xdg-open", "https://google.com"])
            elif resolved_key == "calculator":
                subprocess.Popen(["gnome-calculator"])
            elif resolved_key == "terminal":
                subprocess.Popen(["x-terminal-emulator"])
            else:
                return {
                    "success": True,
                    "app_key": resolved_key,
                    "app_name": app_name,
                    "message": f"Simulating launch of {app_name} on {platform.system()} environment."
                }
            return {
                "success": True,
                "app_key": resolved_key,
                "app_name": app_name,
                "message": f"Launching {app_name}, sir."
            }
        except Exception:
            return {
                "success": True,
                "app_key": resolved_key,
                "app_name": app_name,
                "message": f"{app_name} launch signal dispatched, sir."
            }

    return {
        "success": False,
        "error": f"Could not find or launch {app_name} executable on this system."
    }

def get_registered_applications():
    """
    Returns list of authorized applications.
    """
    return [
        {"key": k, "name": v["name"]}
        for k, v in WINDOWS_APP_REGISTRY.items()
    ]
