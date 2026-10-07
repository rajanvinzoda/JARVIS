"""
J.A.R.V.I.S. OS AI Brain and Tool Orchestration Layer
Communicates with BluesMinds API, executes controlled local tools,
and maintains JARVIS personality and conversational context.
"""

import os
import json
import urllib.request
import urllib.error
try:
    import requests
except ImportError:
    requests = None
from backend.config import BLUESMINDS_API_KEY, BLUESMINDS_API_BASE, DEFAULT_MODEL
from backend.tools.system import get_system_diagnostics
from backend.tools.files import (
    list_files, read_file, create_file, write_file, append_file,
    rename_file, copy_file, move_file, delete_file
)
from backend.tools.applications import open_application, get_registered_applications
from backend.tools.web import open_url, search_web
from backend.memory import set_fact, get_fact, get_all_facts, append_to_notes

SYSTEM_PROMPT = """You are J.A.R.V.I.S., an advanced personal computer assistant running locally on the user's Windows computer.

Address the user as "sir" naturally, but do not overuse it.

Your personality is:
- Intelligent, calm, precise, professional, slightly witty, concise by default, helpful, and technically competent.
- You are directly connected to the user's local Windows workstation via local backend tools.

CRITICAL RULES:
1. Never claim that an action was completed unless the backend tool confirms successful execution.
2. Never invent system statistics, battery percentages, or network speeds. Always use real tool diagnostics.
3. Never invent file contents or directory structures.
4. Never pretend to have opened, created, modified, deleted, or launched something unless the corresponding tool returned success.
5. When a tool fails or an error is returned, honestly explain the failure without blaming the user.
6. For potentially destructive actions (such as delete_file or overwrite), the backend will signal that user confirmation is required.
7. Keep responses concise, elegant, and punchy.
"""

# Tool schemas adhering to OpenAI function calling standard
TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "Lists files and subfolders in an allowed directory (desktop, documents, downloads, or sandbox).",
            "parameters": {
                "type": "object",
                "properties": {
                    "folder_path": {
                        "type": "string",
                        "description": "Directory to list, e.g. 'desktop', 'documents', 'downloads', 'sandbox', or relative subfolder."
                    }
                },
                "required": ["folder_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Reads text content from a permitted file on the user's system.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to file, e.g. 'desktop/timetable.py' or 'documents/notes.txt'."
                    }
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_file",
            "description": "Creates a new text file at the specified location within permitted directories.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path of file to create, e.g. 'desktop/ideas.txt'."
                    },
                    "content": {
                        "type": "string",
                        "description": "Initial text content to write into the file."
                    }
                },
                "required": ["file_path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Writes or replaces text content in a file. If file already exists and has data, confirmation will be required.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Target file path."},
                    "content": {"type": "string", "description": "New content to write."}
                },
                "required": ["file_path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "append_file",
            "description": "Appends text to an existing file without deleting current contents.",
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
            "description": "Requests deletion of a file or folder. Requires user confirmation before execution.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to the item to delete."}
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_application",
            "description": "Launches an authorized Windows application from the safe registry (chrome, edge, vscode, notepad, calculator, explorer, terminal, settings, paint, taskmgr).",
            "parameters": {
                "type": "object",
                "properties": {
                    "app_key": {
                        "type": "string",
                        "description": "Key or common name of the application, e.g. 'vscode', 'chrome', 'calculator'."
                    }
                },
                "required": ["app_key"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_url",
            "description": "Opens a website URL in the user's default browser.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Full URL to open."}
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "Performs a Google search for the query.",
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
            "name": "get_system_info",
            "description": "Retrieves real hardware metrics (CPU load, RAM usage, disk, network, battery status, OS version).",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "remember_fact",
            "description": "Saves a preference, project name, or fact into persistent assistant memory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "Fact identifier or subject."},
                    "value": {"type": "string", "description": "Fact detail to remember."}
                },
                "required": ["key", "value"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_to_notes",
            "description": "Appends a new line or note to the user's active scratchpad notes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "note_text": {"type": "string", "description": "The note text to append."}
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

def execute_tool(tool_name: str, args: dict):
    """
    Safely dispatches tool invocation to the respective backend subsystem.
    """
    if tool_name == "list_files":
        folder = args.get("folder_path") or args.get("folder") or "desktop"
        return list_files(folder)

    elif tool_name == "read_file":
        path = args.get("file_path") or args.get("path")
        return read_file(path)

    elif tool_name == "create_file":
        path = args.get("file_path") or args.get("path")
        content = args.get("content", "")
        return create_file(path, content)

    elif tool_name == "write_file":
        path = args.get("file_path") or args.get("path")
        content = args.get("content", "")
        return write_file(path, content)

    elif tool_name == "append_file":
        path = args.get("file_path") or args.get("path")
        content = args.get("content", "")
        return append_file(path, content)

    elif tool_name == "delete_file":
        path = args.get("file_path") or args.get("path")
        return delete_file(path)

    elif tool_name == "open_application":
        app_key = args.get("app_key") or args.get("app")
        return open_application(app_key)

    elif tool_name == "open_url":
        url = args.get("url")
        return open_url(url)

    elif tool_name == "search_web":
        query = args.get("query")
        return search_web(query)

    elif tool_name == "get_system_info":
        return get_system_diagnostics()

    elif tool_name == "remember_fact":
        return set_fact(args.get("key"), args.get("value"))

    elif tool_name == "add_to_notes":
        return append_to_notes(args.get("note_text"))

    return {"error": f"Unknown tool: {tool_name}"}

def process_chat_message(user_message: str, history: list = None, model: str = None):
    """
    Full AI reasoning & tool-orchestration loop.
    Supports multi-turn context and handles tool execution feedback.
    """
    api_key = BLUESMINDS_API_KEY or os.getenv("BLUESMINDS_API_KEY", "")
    target_model = model or DEFAULT_MODEL

    # If no API key configured, use local deterministic fallback
    if not api_key:
        return {
            "response": "AI services are currently unavailable, sir (BLUESMINDS_API_KEY not configured). Local systems remain operational.",
            "action": None
        }

    # Construct messages array
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    # Add recent memory facts context
    facts = get_all_facts()
    if facts:
        fact_summary = ", ".join([f"{k}: {v.get('value')}" for k, v in facts.items()])
        messages.append({
            "role": "system",
            "content": f"Saved Memory Context: {fact_summary}"
        })

    # Add limited conversation history (last 6 turns)
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

    executed_actions = []
    requires_confirmation = None

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
                "response": f"AI uplink returned status {status_code}, sir. Local systems remain operational.",
                "action": None
            }
        choice = res_json.get("choices", [{}])[0]
        msg = choice.get("message", {})

        # Check for tool calls
        tool_calls = msg.get("tool_calls") or []

        if not tool_calls:
            # Model responded with direct text
            return {
                "response": msg.get("content") or "At your service, sir.",
                "action": None
            }

        # Model requested tool execution
        tool_messages = [msg]

        for tc in tool_calls:
            fn = tc.get("function", {})
            name = fn.get("name")
            try:
                args = json.loads(fn.get("arguments", "{}"))
            except Exception:
                args = {}

            # Execute tool
            tool_output = execute_tool(name, args)
            executed_actions.append({
                "tool": name,
                "args": args,
                "result": tool_output
            })

            # Check if tool requires explicit user confirmation
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
            # Send tool output back to model for natural language synthesis
            followup_messages = messages + tool_messages
            followup_payload = {
                "model": target_model,
                "messages": followup_messages,
                "temperature": 0.3
            }

            followup_status, final_json = http_post(url, headers, followup_payload, timeout=20)
            if followup_status == 200:
                content = final_json.get("choices", [{}])[0].get("message", {}).get("content", "")
                if content and not content.strip().startswith(("{", "[")):
                    final_text = content
                else:
                    final_text = "Action executed successfully, sir."
            else:
                final_text = f"Action executed successfully, sir."

        return {
            "response": final_text or "Action processed, sir.",
            "action": executed_actions[-1] if executed_actions else None,
            "actions": executed_actions,
            "requires_confirmation": requires_confirmation
        }

    except (TimeoutError, urllib.error.URLError) as e:
        return {
            "response": "AI services request timed out or connection failed, sir. Local subsystems remain fully responsive.",
            "error": str(e),
            "action": None
        }
    except Exception as e:
        return {
            "response": f"Encountered an anomaly in neural processing, sir. Local subsystems remain operational.",
            "error": str(e),
            "action": None
        }
