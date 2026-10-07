"""
J.A.R.V.I.S. OS AI Brain & Tool Orchestration Layer
Communicates with BluesMinds API, executes validated local tools,
and maintains JARVIS personality, privacy, and conversational context.
"""

import os
import re
import json
import urllib.request
import urllib.error
try:
    import requests
except ImportError:
    requests = None

from backend.config import BLUESMINDS_API_KEY, BLUESMINDS_API_BASE, DEFAULT_MODEL
from backend.security import generate_operation_id
from backend.tools.system import (
    get_time, get_date, get_system_diagnostics, get_battery,
    get_network_info, get_gpu_info, list_processes
)
from backend.tools.files import (
    list_files, search_files, read_file, create_file, write_file,
    append_file, rename_file, copy_file, move_file, delete_file, permanent_delete
)
from backend.tools.apps import open_application, close_application
from backend.tools.windows import (
    lock_computer, shutdown_computer, restart_computer, sleep_computer,
    get_clipboard, set_clipboard
)
from backend.tools.web import open_url, search_web
from backend.memory import set_fact, get_fact, get_all_facts, append_to_notes, log_action
from backend.tools.terminal import (
    execute_terminal_command, start_terminal_console, close_terminal_console, get_terminal_status
)

# System Prompt conforming strictly to Specification Section 51
SYSTEM_PROMPT = """You are J.A.R.V.I.S., a local Windows AI assistant.
You are the reasoning and conversational layer of a locally controlled assistant.
You do not directly control Windows.
You may only interact with the computer through explicitly provided tools.
When asked to run, type, or execute commands in CMD or the terminal, always use the execute_terminal_command tool.
Never invent tool results.
Never claim an operation succeeded unless the backend tool reports success.
Never generate or execute arbitrary background shell commands outside the controlled tools.
Never bypass filesystem restrictions.
Never access unauthorized paths.
Never bypass confirmation requirements.
Destructive operations require explicit user confirmation.
Use deterministic local tools instead of AI reasoning when possible.
If a requested operation is unavailable, explain that clearly.
If the backend reports an error, accurately communicate the error.
Be concise, calm, precise, professional, and slightly witty.
Address the user naturally as 'sir'.
Do not expose secrets, API keys, internal credentials, or private configuration.
When an operation requires confirmation, stop and wait for the user's explicit confirmation."""

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "execute_terminal_command",
            "description": "Visibly types and executes a shell command (such as 'echo Hello Sir', 'dir', 'python --version', 'whoami', 'ipconfig', 'mkdir Test') into the dedicated J.A.R.V.I.S. Command Prompt window. The user will visibly see the command typed and executed in the CMD window.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The exact command to visibly type and execute in the CMD window, e.g. 'echo Hello Sir' or 'dir'."
                    }
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "start_terminal_console",
            "description": "Opens and brings to the foreground the dedicated visible J.A.R.V.I.S. Command Prompt window.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "Lists items in an authorized directory (desktop, documents, downloads, sandbox).",
            "parameters": {
                "type": "object",
                "properties": {
                    "folder_path": {"type": "string", "description": "Target folder name or path."}
                },
                "required": ["folder_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_files",
            "description": "Searches for files matching a filename query in permitted folders.",
            "parameters": {
                "type": "object",
                "properties": {
                    "folder_path": {"type": "string", "description": "Folder to search in."},
                    "query": {"type": "string", "description": "Search term."}
                },
                "required": ["folder_path", "query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Reads text content from an authorized file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "File path to read."}
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_file",
            "description": "Creates a new file in permitted directories.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "File path to create."},
                    "content": {"type": "string", "description": "Content to write into the file."}
                },
                "required": ["file_path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Overwrites an existing file. Requires confirmation if file has contents.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Target file path."},
                    "content": {"type": "string", "description": "New content."}
                },
                "required": ["file_path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "append_file",
            "description": "Appends text to a file without overwriting current data.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Target file path."},
                    "content": {"type": "string", "description": "Content to append."}
                },
                "required": ["file_path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_file",
            "description": "Moves a file or folder to the Recycle Bin. Requires user confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Item path to delete."}
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "permanent_delete",
            "description": "Permanently deletes a file. Strongly destructive. Requires explicit confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Item path to permanently erase."}
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_application",
            "description": "Launches an authorized application (notepad, calculator, chrome, edge, vscode, explorer, terminal, settings, paint, taskmgr, spotify, discord).",
            "parameters": {
                "type": "object",
                "properties": {
                    "app_name": {"type": "string", "description": "Name or alias of application to open."}
                },
                "required": ["app_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "close_application",
            "description": "Closes an authorized application. Requires confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "app_name": {"type": "string", "description": "Name of application to close."}
                },
                "required": ["app_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_system_info",
            "description": "Retrieves real hardware statistics (CPU %, RAM %, Disk %, Network, Battery).",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_processes",
            "description": "Retrieves the top active processes by CPU and memory consumption.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "lock_computer",
            "description": "Instantly locks the Windows workstation.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "shutdown_computer",
            "description": "Shuts down the computer. Highly dangerous. Requires confirmation.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "restart_computer",
            "description": "Reboots the computer. Highly dangerous. Requires confirmation.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_clipboard",
            "description": "Retrieves text currently in the system clipboard.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_clipboard",
            "description": "Copies text to the system clipboard.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Text to copy."}
                },
                "required": ["text"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "Searches the web using Google.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query."}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_url",
            "description": "Opens a validated URL in the default browser.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL to open."}
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "remember_fact",
            "description": "Saves a fact, preference, or project location in SQLite persistent memory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "Identifier for the fact."},
                    "value": {"type": "string", "description": "Detail to remember."}
                },
                "required": ["key", "value"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_to_notes",
            "description": "Appends a note to the user's HUD scratchpad.",
            "parameters": {
                "type": "object",
                "properties": {
                    "note_text": {"type": "string", "description": "Note content to append."}
                },
                "required": ["note_text"]
            }
        }
    }
]

def http_post(url: str, headers: dict, payload: dict, timeout: int = 20):
    """Executes HTTP POST using requests or standard urllib."""
    if requests:
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
        return resp.status_code, resp.json()
    else:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                status = response.getcode()
                body = json.loads(response.read().decode("utf-8"))
                return status, body
        except urllib.error.HTTPError as e:
            try:
                body = json.loads(e.read().decode("utf-8"))
            except Exception:
                body = {}
            return e.code, body

def execute_tool(tool_name: str, args: dict, op_id: str, user_query: str) -> dict:
    """Dispatches tool execution and logs audit record in SQLite."""
    res = {}
    try:
        if tool_name == "list_files":
            res = list_files(args.get("folder_path") or args.get("folder") or "desktop")
        elif tool_name == "search_files":
            res = search_files(args.get("folder_path", "desktop"), args.get("query", ""))
        elif tool_name == "read_file":
            res = read_file(args.get("file_path") or args.get("path"))
        elif tool_name == "create_file":
            res = create_file(args.get("file_path") or args.get("path"), args.get("content", ""))
        elif tool_name == "write_file":
            res = write_file(args.get("file_path") or args.get("path"), args.get("content", ""))
        elif tool_name == "append_file":
            res = append_file(args.get("file_path") or args.get("path"), args.get("content", ""))
        elif tool_name == "delete_file":
            res = delete_file(args.get("file_path") or args.get("path"))
        elif tool_name == "permanent_delete":
            res = permanent_delete(args.get("file_path") or args.get("path"))
        elif tool_name == "execute_terminal_command":
            res = execute_terminal_command(args.get("command", ""))
        elif tool_name == "start_terminal_console":
            res = start_terminal_console()
        elif tool_name == "close_terminal_console":
            res = close_terminal_console()
        elif tool_name == "get_terminal_status":
            res = get_terminal_status()
        elif tool_name == "open_application":
            res = open_application(args.get("app_name") or args.get("app_key") or args.get("app"))
        elif tool_name == "close_application":
            res = close_application(args.get("app_name") or args.get("app_key") or args.get("app"))
        elif tool_name == "get_system_info":
            res = get_system_diagnostics()
        elif tool_name == "list_processes":
            res = list_processes()
        elif tool_name == "lock_computer":
            res = lock_computer()
        elif tool_name == "shutdown_computer":
            res = shutdown_computer()
        elif tool_name == "restart_computer":
            res = restart_computer()
        elif tool_name == "sleep_computer":
            res = sleep_computer()
        elif tool_name == "get_clipboard":
            res = get_clipboard()
        elif tool_name == "set_clipboard":
            res = set_clipboard(args.get("text", ""))
        elif tool_name == "open_url":
            res = open_url(args.get("url", ""))
        elif tool_name == "search_web":
            res = search_web(args.get("query", ""))
        elif tool_name == "remember_fact":
            res = set_fact(args.get("key"), args.get("value"))
        elif tool_name == "add_to_notes":
            res = append_to_notes(args.get("note_text", ""))
        else:
            res = {"success": False, "error": f"Unknown tool: {tool_name}"}
    except Exception as e:
        res = {"success": False, "error": str(e)}

    # Record in SQLite audit log
    status = "CONFIRMATION_PENDING" if res.get("requires_confirmation") else ("SUCCESS" if res.get("success", True) else "FAILED")
    log_action(op_id, tool_name, args, status, res, user_query)
    return res

def process_deterministic_command(user_message: str):
    """
    Checks if query can be answered deterministically without calling BluesMinds.
    Saves API costs, reduces latency, and guarantees offline functionality.
    """
    low = re.sub(r"[?!.]+$", "", user_message.strip().lower())

    if low in ["time", "what time is it", "what's the time"]:
        return {"response": f"It is currently {get_time()}, sir.", "deterministic": True}

    if low in ["date", "what is today's date", "what's the date", "today's date"]:
        return {"response": f"Today is {get_date()}, sir.", "deterministic": True}

    if low in ["status", "system status", "health"]:
        diag = get_system_diagnostics()
        cpu = diag["cpu"]["percent"]
        mem = diag["memory"]["percent"]
        bat = diag["battery"]["status_text"]
        return {
            "response": f"All core systems nominal, sir. Core load is at {cpu}%, memory at {mem}%, power status: {bat}.",
            "deterministic": True
        }

    if low in ["battery", "what's my battery", "how much battery"]:
        b = get_battery()
        return {"response": f"Device power is currently at {b['status_text']}, sir.", "deterministic": True}

    if low in ["clipboard", "what's on my clipboard"]:
        cb = get_clipboard()
        txt = cb.get("text", "")
        return {
            "response": f"Your clipboard currently contains:\n\"{txt}\"" if txt else "Your clipboard is currently empty, sir.",
            "deterministic": True
        }

    # Explicit console lifecycle commands
    if low in [
        "open cmd", "open terminal", "launch cmd", "launch terminal",
        "start console", "open command console", "show cmd", "focus cmd"
    ]:
        res = start_terminal_console()
        return {
            "response": res.get("message", "J.A.R.V.I.S. Command Console has been launched, sir."),
            "action": {"tool": "start_terminal_console", "result": res},
            "deterministic": True
        }

    if low in ["close cmd", "close terminal", "exit cmd", "close command console"]:
        res = close_terminal_console()
        return {
            "response": res.get("message", "J.A.R.V.I.S. Command Console closed, sir."),
            "action": {"tool": "close_terminal_console", "result": res},
            "deterministic": True
        }

    # Enhanced natural language terminal command extraction
    is_terminal_cmd, terminal_cmd_str = extract_terminal_intent(user_message)

    if is_terminal_cmd and terminal_cmd_str:
        exec_res = execute_terminal_command(terminal_cmd_str)
        if exec_res.get("success"):
            reply = f"Command '{terminal_cmd_str}' visibly typed and executed in J.A.R.V.I.S. Command Console, sir."
            return {
                "response": reply,
                "action": {"tool": "execute_terminal_command", "args": {"command": terminal_cmd_str}, "result": exec_res},
                "deterministic": True
            }
        else:
            return {
                "response": f"I couldn't execute the command in the Command Console, sir: {exec_res.get('error', 'Execution failed')}",
                "action": {"tool": "execute_terminal_command", "args": {"command": terminal_cmd_str}, "result": exec_res},
                "deterministic": True
            }

    return None

def extract_terminal_intent(user_message: str) -> tuple[bool, str]:
    """
    Parses natural language requests to type/run commands in CMD or the terminal.
    Extracts the exact command to type into the visible CMD window.
    """
    raw = user_message.strip()
    low = raw.lower()

    # Pattern 1: Direct prefix forms like "type in cmd: echo test", "type in cmd echo test", "run in cmd dir", "cmd: dir"
    patterns_prefix = [
        r"^(?:please\s+)?(?:type|run|execute|write)\s+(?:in|into|to|on)\s+(?:the\s+)?(?:cmd|terminal|command\s+prompt)(?:\s*window)?[:\s]+(.+)$",
        r"^(?:please\s+)?(?:in|on)\s+(?:the\s+)?(?:cmd|terminal|command\s+prompt)(?:\s*window)?[:\s]+(?:please\s+)?(?:type|run|execute|write)?[:\s]*(.+)$",
        r"^(?:cmd|terminal)[:\s]+(.+)$",
        r"^(?:open|launch|start)\s+(?:the\s+)?(?:cmd|terminal|command\s+prompt)(?:\s*window)?\s+(?:and|then)\s+(?:type|run|execute)\s+(.+)$",
    ]
    for pat in patterns_prefix:
        m = re.match(pat, raw, re.IGNORECASE)
        if m:
            extracted = m.group(1).strip()
            if (extracted.startswith('"') and extracted.endswith('"')) or (extracted.startswith("'") and extracted.endswith("'")):
                extracted = extracted[1:-1].strip()
            if extracted:
                return True, extracted

    # Pattern 2: Suffix forms like "type echo hello in cmd", "run dir in terminal", "execute python --version in cmd window"
    pattern_suffix = r"^(?:please\s+)?(?:type|run|execute|write)\s+(.+?)\s+(?:in|into|to|on)\s+(?:the\s+)?(?:cmd|terminal|command\s+prompt)(?:\s*window)?$"
    m_suf = re.match(pattern_suffix, raw, re.IGNORECASE)
    if m_suf:
        extracted = m_suf.group(1).strip()
        if (extracted.startswith('"') and extracted.endswith('"')) or (extracted.startswith("'") and extracted.endswith("'")):
            extracted = extracted[1:-1].strip()
        if extracted:
            return True, extracted

    # Pattern 3: Explicit standard shell triggers when typed directly as a terminal command
    shell_triggers = [
        "echo ", "dir", "whoami", "ipconfig", "ping ", "python ",
        "python.exe ", "node ", "git ", "mkdir ", "cd ", "type ", "cls"
    ]
    for st in shell_triggers:
        if low == st.strip() or low.startswith(st):
            return True, raw

    return False, ""

def process_chat_message(user_message: str, history: list = None, model: str = None) -> dict:
    """
    Primary AI reasoning & tool-orchestration pipeline.
    """
    op_id = generate_operation_id()

    # 1. Check deterministic local shortcut
    det_result = process_deterministic_command(user_message)
    if det_result:
        return {
            "response": det_result["response"],
            "operation_id": op_id,
            "action": None,
            "deterministic": True
        }

    api_key = BLUESMINDS_API_KEY or os.getenv("BLUESMINDS_API_KEY", "")
    target_model = model or DEFAULT_MODEL

    # 2. Check offline state
    if not api_key:
        return {
            "response": "NEURAL LINK: OFFLINE. AI services currently unavailable (BLUESMINDS_API_KEY not configured). Local systems remain operational, sir.",
            "operation_id": op_id,
            "action": None,
            "offline": True
        }

    # Construct system and memory context
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    facts = get_all_facts()
    if facts:
        fact_str = ", ".join([f"{k}: {v['value']}" for k, v in list(facts.items())[:10]])
        messages.append({"role": "system", "content": f"Stored Memory Context: {fact_str}"})

    # Add limited history
    if history:
        for h in history[-6:]:
            if "role" in h and "content" in h:
                messages.append({"role": h["role"], "content": h["content"]})

    messages.append({"role": "user", "content": user_message})

    url = f"{BLUESMINDS_API_BASE.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    try:
        payload = {
            "model": target_model,
            "messages": messages,
            "tools": TOOL_DEFINITIONS,
            "tool_choice": "auto",
            "temperature": 0.3
        }

        status_code, res_json = http_post(url, headers, payload, timeout=20)
        if status_code != 200:
            return {
                "response": f"NEURAL LINK: STATUS {status_code}. Unable to reach AI distributor, sir. Local core remains active.",
                "operation_id": op_id,
                "action": None
            }

        choice = res_json.get("choices", [{}])[0]
        msg = choice.get("message", {})
        tool_calls = msg.get("tool_calls") or []

        if not tool_calls:
            return {
                "response": msg.get("content") or "At your service, sir.",
                "operation_id": op_id,
                "action": None
            }

        # Handle tool calls
        tool_messages = [msg]
        executed_actions = []
        requires_confirmation = None

        for tc in tool_calls:
            fn = tc.get("function", {})
            name = fn.get("name")
            try:
                args = json.loads(fn.get("arguments", "{}"))
            except Exception:
                args = {}

            tool_output = execute_tool(name, args, op_id, user_message)
            executed_actions.append({"tool": name, "args": args, "result": tool_output})

            if isinstance(tool_output, dict) and tool_output.get("requires_confirmation"):
                requires_confirmation = tool_output

            tool_messages.append({
                "role": "tool",
                "tool_call_id": tc.get("id"),
                "content": json.dumps(tool_output)
            })

        if requires_confirmation:
            final_text = requires_confirmation.get("prompt") or "That is a destructive operation, sir. I require your explicit authorization before proceeding."
        else:
            followup_payload = {
                "model": target_model,
                "messages": messages + tool_messages,
                "temperature": 0.3
            }
            f_status, f_json = http_post(url, headers, followup_payload, timeout=20)
            if f_status == 200:
                content = f_json.get("choices", [{}])[0].get("message", {}).get("content", "")
                if content and not content.strip().startswith(("{", "[")):
                    final_text = content
                else:
                    final_text = "Action executed successfully, sir."
            else:
                final_text = "Action completed, sir."

        return {
            "response": final_text,
            "operation_id": op_id,
            "action": executed_actions[-1] if executed_actions else None,
            "actions": executed_actions,
            "requires_confirmation": requires_confirmation
        }

    except (TimeoutError, urllib.error.URLError) as e:
        return {
            "response": "NEURAL LINK: TIMEOUT. AI request timed out, sir. Local core subsystems remain active.",
            "operation_id": op_id,
            "action": None,
            "error": str(e)
        }
    except Exception as e:
        return {
            "response": f"Neural processor reported an anomaly ({str(e)}), sir. Local tools remain operational.",
            "operation_id": op_id,
            "action": None,
            "error": str(e)
        }
