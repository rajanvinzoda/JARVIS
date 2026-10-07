"""
J.A.R.V.I.S. OS Local Python Server
Flask API running on http://127.0.0.1:5000 with CORS and local tools.
Provides full Windows workstation integration.
"""

import sys
import os
from pathlib import Path

# Ensure root directory is on PYTHONPATH
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from flask import Flask, request, jsonify
from flask_cors import CORS
from backend.config import SERVER_HOST, SERVER_PORT, BLUESMINDS_API_KEY, ALLOWED_DIRECTORIES
from backend.tools.system import get_system_diagnostics
from backend.tools.files import (
    list_files, read_file, create_file, write_file, append_file,
    rename_file, copy_file, move_file, delete_file, confirm_action
)
from backend.tools.applications import open_application, get_registered_applications
from backend.tools.web import open_url, search_web
from backend.memory import (
    load_memory, set_fact, clear_all_memory, get_notes, save_notes
)
from backend.ai import process_chat_message

app = Flask(__name__)
CORS(app)

print("\n" + "="*50)
print(" J.A.R.V.I.S. OS KERNEL")
print(" Loading AI interface... OK")
print(" Loading system tools... OK")
print(" Loading filesystem interface... OK")
print(" Loading application interface... OK")
print(f" Establishing secure AI connection... {'OK' if BLUESMINDS_API_KEY else 'API_KEY_MISSING'}")
print(" Running system diagnostics... OK")
print("="*50)
print(f" J.A.R.V.I.S. Server listening on http://{SERVER_HOST}:{SERVER_PORT}")
print(" All systems are online, sir.\n")

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "name": "J.A.R.V.I.S. OS",
        "version": "1.0.0",
        "ai_connected": bool(BLUESMINDS_API_KEY),
        "allowed_directories": list(ALLOWED_DIRECTORIES.keys())
    })

@app.route("/api/system", methods=["GET"])
def system_diagnostics():
    """Returns genuine hardware metrics."""
    return jsonify(get_system_diagnostics())

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    message = data.get("message", "").strip()
    history = data.get("history", [])
    model = data.get("model")

    if not message:
        return jsonify({"response": "I didn't catch that, sir.", "action": None})

    result = process_chat_message(message, history=history, model=model)
    return jsonify(result)

@app.route("/api/files", methods=["GET"])
def api_list_files():
    folder = request.args.get("folder", "desktop")
    return jsonify(list_files(folder))

@app.route("/api/files/read", methods=["POST"])
def api_read_file():
    data = request.get_json() or {}
    path = data.get("path", "")
    return jsonify(read_file(path))

@app.route("/api/files/create", methods=["POST"])
def api_create_file():
    data = request.get_json() or {}
    path = data.get("path", "")
    content = data.get("content", "")
    return jsonify(create_file(path, content))

@app.route("/api/files/write", methods=["POST"])
def api_write_file():
    data = request.get_json() or {}
    path = data.get("path", "")
    content = data.get("content", "")
    return jsonify(write_file(path, content))

@app.route("/api/files/append", methods=["POST"])
def api_append_file():
    data = request.get_json() or {}
    path = data.get("path", "")
    content = data.get("content", "")
    return jsonify(append_file(path, content))

@app.route("/api/files/rename", methods=["POST"])
def api_rename_file():
    data = request.get_json() or {}
    old_p = data.get("old_path", "")
    new_p = data.get("new_path", "")
    return jsonify(rename_file(old_p, new_p))

@app.route("/api/files/copy", methods=["POST"])
def api_copy_file():
    data = request.get_json() or {}
    src = data.get("source", "")
    dst = data.get("destination", "")
    return jsonify(copy_file(src, dst))

@app.route("/api/files/move", methods=["POST"])
def api_move_file():
    data = request.get_json() or {}
    src = data.get("source", "")
    dst = data.get("destination", "")
    return jsonify(move_file(src, dst))

@app.route("/api/files/delete", methods=["POST"])
def api_delete_file():
    data = request.get_json() or {}
    path = data.get("path", "")
    return jsonify(delete_file(path))

@app.route("/api/confirm", methods=["POST"])
def api_confirm():
    data = request.get_json() or {}
    cid = data.get("confirmation_id", "")
    approved = bool(data.get("approved", False))
    return jsonify(confirm_action(cid, approved))

@app.route("/api/apps", methods=["GET"])
def api_apps_list():
    return jsonify({"applications": get_registered_applications()})

@app.route("/api/apps/open", methods=["POST"])
def api_apps_open():
    data = request.get_json() or {}
    app_key = data.get("app", "")
    return jsonify(open_application(app_key))

@app.route("/api/web/open", methods=["POST"])
def api_web_open():
    data = request.get_json() or {}
    url = data.get("url", "")
    return jsonify(open_url(url))

@app.route("/api/web/search", methods=["POST"])
def api_web_search():
    data = request.get_json() or {}
    query = data.get("query", "")
    return jsonify(search_web(query))

@app.route("/api/memory", methods=["GET"])
def api_get_memory():
    return jsonify(load_memory())

@app.route("/api/memory", methods=["POST"])
def api_save_memory():
    data = request.get_json() or {}
    key = data.get("key", "")
    val = data.get("value", "")
    return jsonify(set_fact(key, val))

@app.route("/api/memory/clear", methods=["POST"])
def api_clear_memory():
    return jsonify(clear_all_memory())

@app.route("/api/notes", methods=["GET"])
def api_get_notes():
    return jsonify({"notes": get_notes()})

@app.route("/api/notes", methods=["POST"])
def api_save_notes():
    data = request.get_json() or {}
    content = data.get("notes", "")
    return jsonify(save_notes(content))

if __name__ == "__main__":
    app.run(host=SERVER_HOST, port=SERVER_PORT, debug=False)
