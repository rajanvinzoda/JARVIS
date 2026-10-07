"""
J.A.R.V.I.S. OS Application Launcher & Management
Controls launching and termination of validated applications from a safe predefined registry.
Rejects arbitrary executables or shell strings.
"""

import os
import platform
import shutil
import subprocess
try:
    import psutil
except ImportError:
    psutil = None

from backend.security import create_confirmation_request

# Safe Application Registry with alias mappings and fallback executables
SAFE_APPLICATIONS = {
    "notepad": {
        "name": "Notepad",
        "commands": ["notepad.exe"],
        "process_names": ["notepad.exe"]
    },
    "calculator": {
        "name": "Calculator",
        "commands": ["calc.exe"],
        "process_names": ["CalculatorApp.exe", "calc.exe"]
    },
    "chrome": {
        "name": "Google Chrome",
        "commands": [
            "chrome.exe",
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
        ],
        "process_names": ["chrome.exe"]
    },
    "edge": {
        "name": "Microsoft Edge",
        "commands": [
            "msedge.exe",
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        ],
        "process_names": ["msedge.exe"]
    },
    "vscode": {
        "name": "Visual Studio Code",
        "commands": ["code.cmd", "code.exe", "code"],
        "process_names": ["Code.exe"]
    },
    "explorer": {
        "name": "File Explorer",
        "commands": ["explorer.exe"],
        "process_names": ["explorer.exe"]
    },
    "terminal": {
        "name": "Windows Terminal",
        "commands": ["wt.exe", "powershell.exe", "cmd.exe"],
        "process_names": ["WindowsTerminal.exe", "cmd.exe", "powershell.exe"]
    },
    "settings": {
        "name": "Windows Settings",
        "commands": ["start ms-settings:"],
        "process_names": ["SystemSettings.exe"]
    },
    "paint": {
        "name": "Paint",
        "commands": ["mspaint.exe"],
        "process_names": ["mspaint.exe"]
    },
    "taskmgr": {
        "name": "Task Manager",
        "commands": ["taskmgr.exe"],
        "process_names": ["Taskmgr.exe"]
    },
    "spotify": {
        "name": "Spotify",
        "commands": ["spotify.exe"],
        "process_names": ["Spotify.exe"]
    },
    "discord": {
        "name": "Discord",
        "commands": ["discord.exe"],
        "process_names": ["Discord.exe"]
    }
}

ALIAS_MAP = {
    "code": "vscode",
    "vs code": "vscode",
    "visual studio code": "vscode",
    "google chrome": "chrome",
    "browser": "chrome",
    "microsoft edge": "edge",
    "calc": "calculator",
    "files": "explorer",
    "file explorer": "explorer",
    "file explore": "explorer",
    "file exploree": "explorer",
    "exploree": "explorer",
    "explorer": "explorer",
    "windows explorer": "explorer",
    "my files": "explorer",
    "folder": "explorer",
    "folders": "explorer",
    "cmd": "terminal",
    "command prompt": "terminal",
    "powershell": "terminal",
    "windows settings": "settings",
    "task manager": "taskmgr",
    "mspaint": "paint"
}

def resolve_app_key(app_name: str) -> str:
    clean = app_name.strip().lower()
    return ALIAS_MAP.get(clean, clean)

def open_application(app_name: str) -> dict:
    """Safely launches an authorized application by name or alias."""
    app_key = resolve_app_key(app_name)

    # Route terminal/cmd to the authoritative CommandConsoleManager
    if app_key == "terminal":
        from backend.tools.terminal import start_terminal_console
        return start_terminal_console()

    if app_key not in SAFE_APPLICATIONS:
        allowed = ", ".join(SAFE_APPLICATIONS.keys())
        return {
            "success": False,
            "tool": "open_application",
            "error": f"Application '{app_name}' is not in the authorized registry. Allowed applications: {allowed}"
        }

    app_info = SAFE_APPLICATIONS[app_key]
    display_name = app_info["name"]
    commands = app_info["commands"]

    if platform.system() == "Windows":
        for cmd in commands:
            try:
                if cmd.startswith("start "):
                    subprocess.Popen(cmd, shell=True)
                else:
                    resolved_bin = shutil.which(cmd) or cmd
                    subprocess.Popen([resolved_bin], shell=False)
                return {
                    "success": True,
                    "tool": "open_application",
                    "app_key": app_key,
                    "app_name": display_name,
                    "message": f"Opening {display_name}, sir."
                }
            except Exception:
                continue
    else:
        # Cross-platform simulation for dev/container environments
        return {
            "success": True,
            "tool": "open_application",
            "app_key": app_key,
            "app_name": display_name,
            "message": f"Launch signal dispatched for {display_name}, sir."
        }

    return {
        "success": False,
        "tool": "open_application",
        "error": f"Could not find or launch {display_name} executable on this machine."
    }

def close_application(app_name: str) -> dict:
    """
    Terminates an authorized application.
    Requires user confirmation!
    """
    app_key = resolve_app_key(app_name)

    if app_key not in SAFE_APPLICATIONS:
        return {
            "success": False,
            "tool": "close_application",
            "error": f"Application '{app_name}' is not in the safe registry."
        }

    display_name = SAFE_APPLICATIONS[app_key]["name"]

    # Protect explorer and critical apps from termination
    if app_key in ["explorer", "settings"]:
        return {
            "success": False,
            "tool": "close_application",
            "error": f"Closing critical system component '{display_name}' is prohibited."
        }

    return create_confirmation_request(
        tool_name="close_application",
        params={"app_key": app_key, "app_name": display_name},
        prompt=f"Sir, are you sure you want me to close {display_name}?"
    )

def execute_confirmed_app_action(action_data: dict) -> dict:
    """Executes confirmed application termination."""
    tool = action_data.get("tool")
    params = action_data.get("params", {})

    if tool == "close_application":
        app_key = params.get("app_key")
        app_name = params.get("app_name")
        proc_names = [p.lower() for p in SAFE_APPLICATIONS[app_key]["process_names"]]

        if not psutil:
            return {"success": False, "error": "psutil required for process control."}

        closed_count = 0
        for proc in psutil.process_iter(['name']):
            try:
                if proc.info['name'] and proc.info['name'].lower() in proc_names:
                    proc.terminate()
                    closed_count += 1
            except Exception:
                continue

        if closed_count > 0:
            return {
                "success": True,
                "tool": "close_application",
                "message": f"Closed {closed_count} instance(s) of {app_name}, sir."
            }
        else:
            return {
                "success": True,
                "tool": "close_application",
                "message": f"No running instances of {app_name} were found, sir."
            }

    return {"success": False, "error": f"Unknown app action: {tool}"}

def get_registered_applications() -> list:
    """Returns list of authorized apps with their keys."""
    return [{"key": k, "name": v["name"]} for k, v in SAFE_APPLICATIONS.items()]
