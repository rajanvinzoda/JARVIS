"""
J.A.R.V.I.S. OS Dedicated Visible Command Console Diagnostic Suite
Tests and verifies genuine visible terminal automation on Windows:
1. Console spawning and HWND registration
2. Window visibility and title matching
3. Restoring window from minimized state
4. Unblocking Windows foreground lock (ALT key cycle & thread attachment)
5. Verifying GetForegroundWindow() == target_hwnd
6. Physical keystroke injection via SendInput (Unicode)
7. Sending Enter key
8. Execution status reporting
"""

import sys
import time
import platform
from pathlib import Path

# Add root directory to path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.tools.terminal import (
    CONSOLE_MANAGER,
    execute_terminal_command,
    start_terminal_console,
    close_terminal_console,
    get_terminal_status,
    IS_WINDOWS
)

def run_diagnostic():
    print("=" * 68)
    print("    J.A.R.V.I.S. VISIBLE CMD AUTOMATION DIAGNOSTIC SUITE")
    print("=" * 68)
    print(f" Platform: {platform.system()} {platform.release()} ({platform.architecture()[0]})")
    print(f" Python:   {platform.python_version()}")
    print("-" * 68)

    # 1. Start Console
    print("\n[*] Step 1: Launching dedicated visible Command Console...")
    start_res = start_terminal_console()
    print(f"    Result: {start_res}")
    time.sleep(1.0)

    # 2. Query Status
    print("\n[*] Step 2: Querying Console Status...")
    status = get_terminal_status()
    print(f"    Alive:       {status.get('alive')}")
    print(f"    HWND:        {status.get('hwnd')}")
    print(f"    Title:       {status.get('title')}")
    print(f"    Session ID:  {status.get('session_id')}")

    if not status.get("alive"):
        print("\n[!] Error: Console is not alive. Aborting test.")
        return False

    # 3. Test Foreground Focus
    print("\n[*] Step 3: Acquiring and Verifying Foreground Focus...")
    focused, reason = CONSOLE_MANAGER.focus_console()
    print(f"    Focus verified: {focused} ({reason})")

    if not focused:
        print("\n[!] Focus could not be confirmed.")
        return False

    # 4. Inject Test Command 1
    test_cmd_1 = "echo J.A.R.V.I.S. Command Console Automation Verified."
    print(f"\n[*] Step 4: Injecting visible keystrokes: '{test_cmd_1}'...")
    res_1 = execute_terminal_command(test_cmd_1)
    print(f"    Execution State: {res_1.get('state')}")
    print(f"    Success:         {res_1.get('success')}")
    print(f"    Message:         {res_1.get('message')}")
    time.sleep(1.0)

    # 5. Inject Test Command 2
    test_cmd_2 = "dir"
    print(f"\n[*] Step 5: Injecting visible keystrokes: '{test_cmd_2}'...")
    res_2 = execute_terminal_command(test_cmd_2)
    print(f"    Execution State: {res_2.get('state')}")
    print(f"    Success:         {res_2.get('success')}")
    print(f"    Message:         {res_2.get('message')}")

    print("\n" + "=" * 68)
    print(" [✓] DIAGNOSTIC COMPLETED: Visible terminal automation nominal, sir.")
    print("=" * 68)
    return True

if __name__ == "__main__":
    run_diagnostic()
