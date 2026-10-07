"""
J.A.R.V.I.S. OS Security & Authorization Layer
Enforces the core principle:
- AI is not trusted.
- User request is not trusted.
- Tool arguments are not trusted.
- Filesystem paths are not trusted.
- Everything must be validated by the local backend.
"""

import os
import re
import uuid
import time
from pathlib import Path
from datetime import datetime
from backend.config import ALLOWED_DIRECTORIES, DATA_DIR

# Max allowed text file size for direct reading (5 MB)
MAX_READ_BYTES = 5 * 1024 * 1024

# Common binary file extensions
BINARY_EXTENSIONS = {
    ".exe", ".dll", ".bin", ".iso", ".zip", ".tar", ".gz", ".7z", ".rar",
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".ico", ".svgz",
    ".mp3", ".wav", ".ogg", ".mp4", ".mkv", ".avi", ".mov", ".wmv",
    ".pdf", ".docx", ".xlsx", ".pptx", ".pyc", ".pyd", ".db", ".sqlite", ".sqlite3"
}

# In-memory store for pending confirmation tokens
# token -> { "op_id": str, "tool": str, "params": dict, "prompt": str, "created_at": float }
PENDING_CONFIRMATIONS = {}

class SecurityError(Exception):
    """Raised when an operation breaches security or directory boundaries."""
    pass

def generate_operation_id() -> str:
    """Generates an audit Operation ID, e.g., JARVIS-20261007-0042A"""
    today_str = datetime.now().strftime("%Y%m%d")
    short_uuid = uuid.uuid4().hex[:5].upper()
    return f"JARVIS-{today_str}-{short_uuid}"

def resolve_secure_path(input_path: str) -> Path:
    """
    Resolves canonical path and verifies it strictly resides inside ALLOWED_DIRECTORIES.
    Blocks:
    - Path traversal (../, ..\\)
    - Unauthorized absolute paths (C:\\Windows, /etc, etc.)
    - UNC paths, remote drives
    - Symlink / junction escapes pointing outside the sandbox
    """
    if not input_path or not str(input_path).strip():
        raise SecurityError("Path cannot be empty.")

    clean = str(input_path).strip().strip('"').strip("'")

    # Reject UNC paths
    if clean.startswith("\\\\") or clean.startswith("//"):
        raise SecurityError("UNC / Network share paths are prohibited.")

    # Check for shorthand folder prefix (desktop, documents, downloads, sandbox)
    parts = clean.replace("\\", "/").split("/")
    first_part = parts[0].lower()

    if first_part in ALLOWED_DIRECTORIES:
        base_dir = ALLOWED_DIRECTORIES[first_part]
        sub_path = "/".join(parts[1:])
        target_path = base_dir / sub_path if sub_path else base_dir
    else:
        # Check if user specified relative path default to desktop
        if not os.path.isabs(clean) and not re.match(r"^[a-zA-Z]:", clean):
            base_dir = ALLOWED_DIRECTORIES.get("desktop") or ALLOWED_DIRECTORIES.get("sandbox")
            target_path = base_dir / clean
        else:
            target_path = Path(clean)

    # Resolve canonical real path (follows symlinks to check actual target location)
    try:
        canonical_target = target_path.resolve(strict=False)
    except Exception as e:
        raise SecurityError(f"Invalid path structure: {str(e)}")

    # Strict containment check against allowed roots
    is_contained = False
    for root_name, root_path in ALLOWED_DIRECTORIES.items():
        try:
            canonical_root = root_path.resolve()
            canonical_target.relative_to(canonical_root)
            is_contained = True
            break
        except ValueError:
            continue

    if not is_contained:
        allowed_list = ", ".join(ALLOWED_DIRECTORIES.keys())
        raise SecurityError(
            f"Security Violation: Target path is outside authorized sandbox locations ({allowed_list})."
        )

    return canonical_target

def is_binary_file(path: Path) -> bool:
    """Checks whether file has a binary extension."""
    return path.suffix.lower() in BINARY_EXTENSIONS

def create_confirmation_request(tool_name: str, params: dict, prompt: str) -> dict:
    """
    Registers a required user confirmation and produces a unique confirmation token.
    The AI cannot confirm its own operations.
    """
    token = uuid.uuid4().hex[:8]
    op_id = generate_operation_id()
    PENDING_CONFIRMATIONS[token] = {
        "token": token,
        "op_id": op_id,
        "tool": tool_name,
        "params": params,
        "prompt": prompt,
        "created_at": time.time()
    }
    return {
        "requires_confirmation": True,
        "confirmation_id": token,
        "operation_id": op_id,
        "tool": tool_name,
        "prompt": prompt,
        "params": {k: v for k, v in params.items() if k != "content"}
    }

def consume_confirmation(token: str, approved: bool) -> tuple[bool, dict]:
    """
    Validates and removes a confirmation token upon user decision.
    """
    request = PENDING_CONFIRMATIONS.pop(token, None)
    if not request:
        return False, {"error": "Invalid or expired confirmation token, sir."}

    # Expire after 10 minutes
    if time.time() - request["created_at"] > 600:
        return False, {"error": "Confirmation request has expired, sir."}

    if not approved:
        return False, {
            "operation_id": request["op_id"],
            "message": "Operation cancelled by user, sir."
        }

    return True, request
