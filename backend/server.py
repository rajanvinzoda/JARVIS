"""
J.A.R.V.I.S. OS Local Python Server
Flask API running on http://127.0.0.1:5000 with strict localhost binding.
Provides full Windows workstation integration, file sandboxing, and security controls.
"""

import sys
import os
from pathlib import Path

# Ensure root directory is on PYTHONPATH
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from backend.config import SERVER_HOST, SERVER_PORT, BLUESMINDS_API_KEY, ALLOWED_DIRECTORIES
from backend.security import consume_confirmation, generate_operation_id
from backend.tools.system import get_system_diagnostics, list_processes, get_time, get_date
from backend.tools.files import (
    list_files, search_files, read_file, create_file, write_file,
    append_file, rename_file, copy_file, move_file, delete_file,
    permanent_delete, execute_confirmed_file_action
)
from backend.tools.apps import (
    open_application, close_application, get_registered_applications,
    execute_confirmed_app_action
)
from backend.tools.windows import (
    lock_computer, shutdown_computer, restart_computer, sleep_computer,
    get_clipboard, set_clipboard, execute_confirmed_windows_action
)
from backend.tools.web import open_url, search_web
from backend.memory import (
    set_fact, get_all_facts, clear_all_memory, get_notes,
    save_notes, get_action_logs
)
from backend.ai import process_chat_message

# Serve standalone frontend directory if present
FRONTEND_DIR = ROOT_DIR / "frontend"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
# Localhost-only CORS policy
CORS(app, resources={r"/api/*": {"origins": ["http://127.0.0.1:5000", "http://localhost:5000", "http://localhost:3000"]}})

print("\n" + "="*56)
print("       J.A.R.V.I.S. OS — LOCAL WINDOWS KERNEL")
print("="*56)
print(" [CORE] Loading AI interface...             OK")
print(" [CORE] Loading system diagnostics...       OK")
print(" [CORE] Loading filesystem sandbox...       OK")
print(" [CORE] Loading application registry...     OK")
print(f" [CORE] Neural uplink status:               {'ONLINE' if BLUESMINDS_API_KEY else 'OFFLINE (Key missing)'}")
print(" [CORE] Security boundaries:                ENFORCED (Desktop, Documents, Downloads)")
print("="*56)
print(f" Listening on: http://{SERVER_HOST}:{SERVER_PORT}")
print(" All systems nominal, sir.\n")

# Serve Frontend HUD
@app.route("/")
def index():
    if (FRONTEND_DIR / "index.html").exists():
        return send_from_directory(str(FRONTEND_DIR), "index.html")
    return jsonify({"status": "online", "message": "J.A.R.V.I.S. Kernel is running. Open frontend HUD."})

@app.route("/<path:path>")
def static_proxy(path):
    if (FRONTEND_DIR / path).exists():
        return send_from_directory(str(FRONTEND_DIR), path)
    return "Resource not found", 404

# Health Check (Section 28)
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "name": "J.A.R.V.I.S. OS",
        "version": "1.0.0",
        "ai": bool(BLUESMINDS_API_KEY),
        "tools": True,
        "database": True,
        "allowed_directories": list(ALLOWED_DIRECTORIES.keys())
    })

# Primary Chat & Orchestration Endpoint
@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    message = data.get("message", "").strip()
    history = data.get("history", [])
    model = data.get("model")

    if not message:
        return jsonify({"response": "Awaiting your command, sir.", "action": None})

    result = process_chat_message(message, history=history, model=model)
    return jsonify(result)

# Real System Diagnostics & Process Monitoring
@app.route("/api/system", methods=["GET"])
def system_diagnostics():
    return jsonify(get_system_diagnostics())

@app.route("/api/processes", methods=["GET"])
def api_processes():
    limit = int(request.args.get("limit", 12))
    return jsonify(list_processes(limit=limit))

# Filesystem Operations
@app.route("/api/files", methods=["GET"])
def api_list_files():
    folder = request.args.get("folder", "desktop")
    return jsonify(list_files(folder))

@app.route("/api/files/search", methods=["GET"])
def api_search_files():
    folder = request.args.get("folder", "desktop")
    query = request.args.get("q", "")
    return jsonify(search_files(folder, query))

@app.route("/api/files/read", methods=["POST"])
def api_read_file():
    data = request.get_json() or {}
    return jsonify(read_file(data.get("path", "")))

@app.route("/api/files/create", methods=["POST"])
def api_create_file():
    data = request.get_json() or {}
    return jsonify(create_file(data.get("path", ""), data.get("content", "")))

@app.route("/api/files/write", methods=["POST"])
def api_write_file():
    data = request.get_json() or {}
    return jsonify(write_file(data.get("path", ""), data.get("content", "")))

@app.route("/api/files/append", methods=["POST"])
def api_append_file():
    data = request.get_json() or {}
    return jsonify(append_file(data.get("path", ""), data.get("content", "")))

@app.route("/api/files/rename", methods=["POST"])
def api_rename_file():
    data = request.get_json() or {}
    return jsonify(rename_file(data.get("old_path", ""), data.get("new_path", "")))

@app.route("/api/files/copy", methods=["POST"])
def api_copy_file():
    data = request.get_json() or {}
    return jsonify(copy_file(data.get("source", ""), data.get("destination", "")))

@app.route("/api/files/move", methods=["POST"])
def api_move_file():
    data = request.get_json() or {}
    return jsonify(move_file(data.get("source", ""), data.get("destination", "")))

@app.route("/api/files/delete", methods=["POST"])
def api_delete_file():
    data = request.get_json() or {}
    return jsonify(delete_file(data.get("path", "")))

@app.route("/api/files/permanent_delete", methods=["POST"])
def api_perm_delete():
    data = request.get_json() or {}
    return jsonify(permanent_delete(data.get("path", "")))

# Application Operations
@app.route("/api/apps", methods=["GET"])
def api_apps_list():
    return jsonify({"applications": get_registered_applications()})

@app.route("/api/apps/open", methods=["POST"])
def api_apps_open():
    data = request.get_json() or {}
    return jsonify(open_application(data.get("app", "")))

@app.route("/api/apps/close", methods=["POST"])
def api_apps_close():
    data = request.get_json() or {}
    return jsonify(close_application(data.get("app", "")))

# Windows System Subroutines
@app.route("/api/windows/lock", methods=["POST"])
def api_win_lock():
    return jsonify(lock_computer())

@app.route("/api/windows/shutdown", methods=["POST"])
def api_win_shutdown():
    return jsonify(shutdown_computer())

@app.route("/api/windows/restart", methods=["POST"])
def api_win_restart():
    return jsonify(restart_computer())

@app.route("/api/windows/sleep", methods=["POST"])
def api_win_sleep():
    return jsonify(sleep_computer())

@app.route("/api/clipboard", methods=["GET"])
def api_get_clip():
    return jsonify(get_clipboard())

@app.route("/api/clipboard", methods=["POST"])
def api_set_clip():
    data = request.get_json() or {}
    return jsonify(set_clipboard(data.get("text", "")))

# Web Tools
@app.route("/api/web/open", methods=["POST"])
def api_web_open():
    data = request.get_json() or {}
    return jsonify(open_url(data.get("url", "")))

@app.route("/api/web/search", methods=["POST"])
def api_web_search():
    data = request.get_json() or {}
    return jsonify(search_web(data.get("query", "")))

# Memory & Notes
@app.route("/api/memory", methods=["GET"])
def api_get_memory():
    return jsonify(get_all_facts())

@app.route("/api/memory", methods=["POST"])
def api_set_memory():
    data = request.get_json() or {}
    return jsonify(set_fact(data.get("key", ""), data.get("value", ""), data.get("category", "general")))

@app.route("/api/memory/clear", methods=["POST"])
def api_clear_memory():
    return jsonify(clear_all_memory())

@app.route("/api/notes", methods=["GET"])
def api_get_notes():
    return jsonify({"notes": get_notes()})

@app.route("/api/notes", methods=["POST"])
def api_save_notes():
    data = request.get_json() or {}
    return jsonify(save_notes(data.get("notes", "")))

# Action Confirmation Protocol (Section 16)
@app.route("/api/confirm", methods=["POST"])
def api_confirm():
    data = request.get_json() or {}
    token = data.get("confirmation_id", "")
    approved = bool(data.get("approved", False))

    valid, action_request = consume_confirmation(token, approved)
    if not valid:
        return jsonify(action_request)

    tool = action_request["tool"]

    if tool in ["delete_file", "permanent_delete", "write_file"]:
        res = execute_confirmed_file_action(action_request)
    elif tool in ["close_application"]:
        res = execute_confirmed_app_action(action_request)
    elif tool in ["shutdown_computer", "restart_computer", "sleep_computer"]:
        res = execute_confirmed_windows_action(action_request)
    else:
        res = {"success": False, "error": f"Unknown confirmation type: {tool}"}

    return jsonify(res)

# Action Audit Logs (Section 33)
@app.route("/api/logs", methods=["GET"])
def api_logs():
    limit = int(request.args.get("limit", 40))
    return jsonify({"logs": get_action_logs(limit=limit)})

if __name__ == "__main__":
    app.run(host=SERVER_HOST, port=SERVER_PORT, debug=False)
