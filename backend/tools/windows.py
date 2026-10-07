"""
J.A.R.V.I.S. OS Windows Power & System Subroutines
Handles workstation lock, power management, and clipboard operations.
Dangerous operations (shutdown, restart, sleep) strictly require confirmation.
"""

import subprocess
import platform
from backend.security import create_confirmation_request

# In-memory clipboard fallback if tkinter/pyperclip isn't available
_CLIPBOARD_BUFFER = ""

def get_clipboard() -> dict:
    """Reads current clipboard text."""
    global _CLIPBOARD_BUFFER
    if platform.system() == "Windows":
        try:
            res = subprocess.run(["powershell", "-command", "Get-Clipboard"], capture_output=True, text=True, timeout=2)
            if res.returncode == 0:
                return {"success": True, "tool": "get_clipboard", "text": res.stdout.strip()}
        except Exception:
            pass
    return {"success": True, "tool": "get_clipboard", "text": _CLIPBOARD_BUFFER}

def set_clipboard(text: str) -> dict:
    """Copies text to the system clipboard."""
    global _CLIPBOARD_BUFFER
    _CLIPBOARD_BUFFER = text
    if platform.system() == "Windows":
        try:
            p = subprocess.Popen(["clip"], stdin=subprocess.PIPE, text=True)
            p.communicate(input=text)
            return {"success": True, "tool": "set_clipboard", "message": "Text copied to clipboard, sir."}
        except Exception:
            pass
    return {"success": True, "tool": "set_clipboard", "message": "Text stored in clipboard buffer, sir."}

def lock_computer() -> dict:
    """Locks the Windows workstation instantly."""
    if platform.system() == "Windows":
        try:
            subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"], check=True)
            return {"success": True, "tool": "lock_computer", "message": "Workstation locked, sir."}
        except Exception as e:
            return {"success": False, "tool": "lock_computer", "error": f"Failed to lock workstation: {e}"}
    return {"success": True, "tool": "lock_computer", "message": "Simulated workstation lock on non-Windows environment."}

def shutdown_computer() -> dict:
    """Requests Windows shutdown. Requires user confirmation."""
    return create_confirmation_request(
        tool_name="shutdown_computer",
        params={},
        prompt="WARNING: Shutting down the computer will terminate all active programs. Shall I proceed, sir?"
    )

def restart_computer() -> dict:
    """Requests Windows restart. Requires user confirmation."""
    return create_confirmation_request(
        tool_name="restart_computer",
        params={},
        prompt="WARNING: Restarting the computer will reboot your system. Shall I proceed, sir?"
    )

def sleep_computer() -> dict:
    """Requests Windows sleep mode. Requires user confirmation."""
    return create_confirmation_request(
        tool_name="sleep_computer",
        params={},
        prompt="Sir, would you like me to put the computer to sleep now?"
    )

def execute_confirmed_windows_action(action_data: dict) -> dict:
    """Executes confirmed Windows power operations."""
    tool = action_data.get("tool")

    if platform.system() != "Windows":
        return {"success": True, "tool": tool, "message": f"Simulated {tool} on non-Windows host, sir."}

    try:
        if tool == "shutdown_computer":
            subprocess.run(["shutdown", "/s", "/t", "10", "/c", "J.A.R.V.I.S. initiated shutdown"], check=True)
            return {"success": True, "tool": "shutdown_computer", "message": "System shutdown initiated in 10 seconds, sir."}

        elif tool == "restart_computer":
            subprocess.run(["shutdown", "/r", "/t", "10", "/c", "J.A.R.V.I.S. initiated restart"], check=True)
            return {"success": True, "tool": "restart_computer", "message": "System restart initiated in 10 seconds, sir."}

        elif tool == "sleep_computer":
            subprocess.run(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"], check=True)
            return {"success": True, "tool": "sleep_computer", "message": "Putting system to sleep, sir."}

        return {"success": False, "error": f"Unknown Windows action: {tool}"}
    except Exception as e:
        return {"success": False, "error": f"Execution failed: {str(e)}"}
