"""
J.A.R.V.I.S. OS Persistent Memory & Action Audit Store
Backed by local SQLite (data/jarvis.db).
Manages long-term facts, notes scratchpad, and operation audit trails.
"""

import sqlite3
import json
import time
from pathlib import Path
from backend.config import DATA_DIR

DB_PATH = DATA_DIR / "jarvis.db"

def get_connection():
    """Returns a SQLite connection with dict-like row access."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes tables if not already present."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Memory table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS memory (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                category TEXT DEFAULT 'general',
                updated_at REAL NOT NULL
            )
        """)
        
        # Notes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY,
                content TEXT NOT NULL,
                updated_at REAL NOT NULL
            )
        """)
        
        # Action audit log table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS action_logs (
                operation_id TEXT PRIMARY KEY,
                timestamp REAL NOT NULL,
                user_query TEXT,
                tool TEXT NOT NULL,
                arguments TEXT,
                status TEXT NOT NULL,
                result TEXT,
                confirmed INTEGER DEFAULT 1
            )
        """)
        
        # Settings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        
        conn.commit()

# Run DB initialization on module load
init_db()

# Memory facts functions
def set_fact(key: str, value: str, category: str = "general") -> dict:
    """Stores a fact or preference in persistent SQLite memory."""
    clean_k = key.strip().lower()
    now = time.time()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO memory (key, value, category, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                category = excluded.category,
                updated_at = excluded.updated_at
        """, (clean_k, str(value).strip(), category, now))
        conn.commit()
    return {"success": True, "key": clean_k, "value": value}

def get_fact(key: str):
    """Retrieves a single fact from SQLite."""
    clean_k = key.strip().lower()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM memory WHERE key = ?", (clean_k,))
        row = cursor.fetchone()
        return row["value"] if row else None

def get_all_facts() -> dict:
    """Returns all stored facts as a key-value dictionary."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT key, value, category, updated_at FROM memory ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        return {r["key"]: {"value": r["value"], "category": r["category"], "updated_at": r["updated_at"]} for r in rows}

def clear_all_memory() -> dict:
    """Clears user memory facts from SQLite."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM memory")
        conn.commit()
    return {"success": True, "message": "All saved memories cleared from database, sir."}

# Notes functions
def get_notes() -> str:
    """Retrieves current scratchpad notes."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT content FROM notes WHERE id = 1")
        row = cursor.fetchone()
        return row["content"] if row else ""

def save_notes(content: str) -> dict:
    """Saves or replaces scratchpad notes."""
    now = time.time()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO notes (id, content, updated_at)
            VALUES (1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                content = excluded.content,
                updated_at = excluded.updated_at
        """, (content, now))
        conn.commit()
    return {"success": True, "notes": content}

def append_to_notes(line: str) -> dict:
    """Appends a new line to scratchpad notes."""
    current = get_notes()
    new_content = current + ("\n" if current else "") + line.strip()
    return save_notes(new_content)

# Action Audit Logging
def log_action(operation_id: str, tool: str, arguments: dict, status: str, result: dict, user_query: str = "", confirmed: bool = True):
    """Records an operation execution in the SQLite audit trail."""
    try:
        now = time.time()
        args_str = json.dumps(arguments) if arguments else ""
        res_str = json.dumps(result) if result else ""
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO action_logs (operation_id, timestamp, user_query, tool, arguments, status, result, confirmed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (operation_id, now, user_query, tool, args_str, status, res_str, 1 if confirmed else 0))
            conn.commit()
    except Exception as e:
        print(f"[AUDIT LOG ERROR] Failed to record log: {e}")

def get_action_logs(limit: int = 50) -> list:
    """Fetches recent action audit records."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM action_logs ORDER BY timestamp DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        logs = []
        for r in rows:
            logs.append({
                "operation_id": r["operation_id"],
                "timestamp": r["timestamp"],
                "user_query": r["user_query"],
                "tool": r["tool"],
                "arguments": json.loads(r["arguments"]) if r["arguments"] else {},
                "status": r["status"],
                "result": json.loads(r["result"]) if r["result"] else {},
                "confirmed": bool(r["confirmed"])
            })
        return logs
