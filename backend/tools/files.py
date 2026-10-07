"""
J.A.R.V.I.S. OS File System Security and Operations Layer
Implements strict path traversal verification, permitted directory boundaries,
and user-confirmed destructive safety protocols.
"""

import os
import shutil
import time
import uuid
from pathlib import Path
from backend.config import ALLOWED_DIRECTORIES

# Allowed text extensions for safe reading
READABLE_EXTENSIONS = {
    ".txt", ".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css",
    ".json", ".csv", ".md", ".log", ".xml", ".yaml", ".yml", ".ini",
    ".bat", ".sh", ".sql", ".env.example", ".conf"
}

# In-memory pending confirmation registry
PENDING_CONFIRMATIONS = {}

class FileSecurityError(Exception):
    pass

def resolve_secure_path(input_path: str) -> Path:
    """
    Validates that a path resides within one of the ALLOWED_DIRECTORIES.
    Supports shorthand folder names: 'desktop', 'documents', 'downloads', 'sandbox'.
    Prevents path traversal and unauthorized directory escapes.
    """
    if not input_path or not input_path.strip():
        raise FileSecurityError("No path specified.")

    clean_path = input_path.strip().replace('"', '').replace("'", "")
    
    # Check if user passed shorthand root e.g. "desktop/test.py" or "desktop"
    parts = clean_path.replace("\\", "/").split("/")
    first_part = parts[0].lower()
    
    target_path = None
    if first_part in ALLOWED_DIRECTORIES:
        base_dir = ALLOWED_DIRECTORIES[first_part]
        sub_path = "/".join(parts[1:])
        target_path = (base_dir / sub_path).resolve()
    else:
        # Check if it's already an absolute path
        candidate = Path(clean_path).expanduser().resolve()
        target_path = candidate

    # Strict boundary validation: target must be inside at least one allowed directory
    allowed = False
    for name, root in ALLOWED_DIRECTORIES.items():
        try:
            target_path.relative_to(root)
            allowed = True
            break
        except ValueError:
            continue

    if not allowed:
        allowed_names = ", ".join(ALLOWED_DIRECTORIES.keys())
        raise FileSecurityError(
            f"Access Denied: Path '{clean_path}' is outside permitted directories ({allowed_names})."
        )

    return target_path

def list_files(folder_path: str = "desktop"):
    """
    Lists files and directories inside an allowed directory.
    """
    try:
        resolved = resolve_secure_path(folder_path)
        if not resolved.exists():
            return {"success": False, "error": f"Directory '{resolved.name}' does not exist."}
        if not resolved.is_dir():
            return {"success": False, "error": f"Path '{resolved.name}' is a file, not a directory."}

        items = []
        for entry in resolved.iterdir():
            try:
                stat = entry.stat()
                items.append({
                    "name": entry.name,
                    "type": "directory" if entry.is_dir() else "file",
                    "size_bytes": stat.st_size if entry.is_file() else 0,
                    "size_display": f"{round(stat.st_size / 1024, 1)} KB" if entry.is_file() else "-",
                    "modified": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime)),
                    "path": str(entry)
                })
            except Exception:
                continue

        # Sort folders first, then files
        items.sort(key=lambda x: (0 if x["type"] == "directory" else 1, x["name"].lower()))
        return {
            "success": True,
            "directory": str(resolved),
            "folder_name": resolved.name,
            "total_items": len(items),
            "items": items
        }
    except FileSecurityError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": f"Failed to list directory: {str(e)}"}

def read_file(file_path: str):
    """
    Reads text content from permitted files. Returns metadata for binaries.
    """
    try:
        resolved = resolve_secure_path(file_path)
        if not resolved.exists():
            return {"success": False, "error": f"File '{resolved.name}' not found."}
        if not resolved.is_file():
            return {"success": False, "error": f"'{resolved.name}' is a directory, not a file."}

        suffix = resolved.suffix.lower()
        stat = resolved.stat()

        if suffix not in READABLE_EXTENSIONS and suffix != "":
            return {
                "success": True,
                "is_binary": True,
                "message": f"File '{resolved.name}' is a binary format ({suffix}). Reading metadata only.",
                "size_bytes": stat.st_size,
                "modified": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime)),
                "path": str(resolved)
            }

        # Safe size limit for reading text (max 2 MB)
        if stat.st_size > 2 * 1024 * 1024:
            return {"success": False, "error": f"File '{resolved.name}' is too large to read into context (>2MB)."}

        with open(resolved, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        return {
            "success": True,
            "filename": resolved.name,
            "path": str(resolved),
            "size_bytes": stat.st_size,
            "content": content
        }
    except FileSecurityError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": f"Failed to read file: {str(e)}"}

def create_file(file_path: str, content: str = ""):
    """
    Creates a new file. If the file already exists, requests confirmation or prevents overwrite.
    """
    try:
        resolved = resolve_secure_path(file_path)
        if resolved.exists():
            # Trigger confirmation to prevent accidental overwrite
            confirmation_id = str(uuid.uuid4())[:8]
            PENDING_CONFIRMATIONS[confirmation_id] = {
                "action": "overwrite_file",
                "path": str(resolved),
                "content": content,
                "created_at": time.time()
            }
            return {
                "requires_confirmation": True,
                "confirmation_id": confirmation_id,
                "action": "overwrite_file",
                "prompt": f"File '{resolved.name}' already exists. Overwriting will replace existing contents. Shall I proceed, sir?",
                "path": str(resolved)
            }

        # Create parent directories if needed
        resolved.parent.mkdir(parents=True, exist_ok=True)
        with open(resolved, "w", encoding="utf-8") as f:
            f.write(content)

        return {
            "success": True,
            "message": f"File '{resolved.name}' created successfully.",
            "path": str(resolved)
        }
    except FileSecurityError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": f"Failed to create file: {str(e)}"}

def write_file(file_path: str, content: str):
    """
    Writes/replaces content in an existing or new file with confirmation if file has content.
    """
    try:
        resolved = resolve_secure_path(file_path)
        if resolved.exists() and resolved.stat().st_size > 0:
            confirmation_id = str(uuid.uuid4())[:8]
            PENDING_CONFIRMATIONS[confirmation_id] = {
                "action": "overwrite_file",
                "path": str(resolved),
                "content": content,
                "created_at": time.time()
            }
            return {
                "requires_confirmation": True,
                "confirmation_id": confirmation_id,
                "action": "overwrite_file",
                "prompt": f"Updating '{resolved.name}' will overwrite existing data ({resolved.stat().st_size} bytes). Confirm execution, sir?",
                "path": str(resolved)
            }

        resolved.parent.mkdir(parents=True, exist_ok=True)
        with open(resolved, "w", encoding="utf-8") as f:
            f.write(content)

        return {
            "success": True,
            "message": f"File '{resolved.name}' updated successfully.",
            "path": str(resolved)
        }
    except FileSecurityError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": f"Failed to write file: {str(e)}"}

def append_file(file_path: str, content: str):
    """
    Appends content to a file without destroying existing contents.
    """
    try:
        resolved = resolve_secure_path(file_path)
        resolved.parent.mkdir(parents=True, exist_ok=True)
        with open(resolved, "a", encoding="utf-8") as f:
            f.write(content if content.endswith("\n") else content + "\n")

        return {
            "success": True,
            "message": f"Appended content to '{resolved.name}'.",
            "path": str(resolved)
        }
    except FileSecurityError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": f"Failed to append to file: {str(e)}"}

def rename_file(old_path: str, new_path: str):
    """
    Renames a file or directory within permitted boundaries.
    """
    try:
        source = resolve_secure_path(old_path)
        dest = resolve_secure_path(new_path)

        if not source.exists():
            return {"success": False, "error": f"Source item '{source.name}' not found."}
        if dest.exists():
            return {"success": False, "error": f"Destination item '{dest.name}' already exists."}

        source.rename(dest)
        return {
            "success": True,
            "message": f"Renamed '{source.name}' to '{dest.name}'.",
            "old_path": str(source),
            "new_path": str(dest)
        }
    except FileSecurityError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": f"Failed to rename: {str(e)}"}

def copy_file(source_path: str, dest_path: str):
    """
    Copies a file within permitted directories.
    """
    try:
        src = resolve_secure_path(source_path)
        dst = resolve_secure_path(dest_path)

        if not src.exists():
            return {"success": False, "error": f"Source item '{src.name}' not found."}

        if src.is_dir():
            shutil.copytree(src, dst)
        else:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)

        return {
            "success": True,
            "message": f"Successfully copied '{src.name}' to '{dst.name}'.",
            "source": str(src),
            "destination": str(dst)
        }
    except FileSecurityError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": f"Failed to copy: {str(e)}"}

def move_file(source_path: str, dest_path: str):
    """
    Moves a file within permitted directories.
    """
    try:
        src = resolve_secure_path(source_path)
        dst = resolve_secure_path(dest_path)

        if not src.exists():
            return {"success": False, "error": f"Source item '{src.name}' not found."}

        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))

        return {
            "success": True,
            "message": f"Successfully moved '{src.name}' to '{dst.name}'.",
            "source": str(src),
            "destination": str(dst)
        }
    except FileSecurityError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": f"Failed to move: {str(e)}"}

def delete_file(file_path: str):
    """
    DESTRUCTIVE ACTION: Files are NEVER deleted without user confirmation.
    Returns requires_confirmation and generates a confirmation token.
    """
    try:
        resolved = resolve_secure_path(file_path)
        if not resolved.exists():
            return {"success": False, "error": f"Item '{resolved.name}' not found."}

        confirmation_id = str(uuid.uuid4())[:8]
        PENDING_CONFIRMATIONS[confirmation_id] = {
            "action": "delete_file",
            "path": str(resolved),
            "is_dir": resolved.is_dir(),
            "created_at": time.time()
        }

        return {
            "requires_confirmation": True,
            "confirmation_id": confirmation_id,
            "action": "delete_file",
            "prompt": f"Permanently deleting '{resolved.name}' cannot be undone. Shall I proceed, sir?",
            "path": str(resolved)
        }
    except FileSecurityError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": f"Failed: {str(e)}"}

def confirm_action(confirmation_id: str, approved: bool):
    """
    Executes or cancels a queued destructive action.
    """
    item = PENDING_CONFIRMATIONS.pop(confirmation_id, None)
    if not item:
        return {"success": False, "error": "Invalid or expired confirmation request, sir."}

    if not approved:
        return {"success": True, "message": "Operation cancelled as requested, sir."}

    action = item.get("action")
    target_path = Path(item["path"])

    try:
        if action == "delete_file":
            if item.get("is_dir"):
                shutil.rmtree(target_path)
            else:
                target_path.unlink()
            return {"success": True, "message": f"Successfully deleted '{target_path.name}', sir."}

        elif action == "overwrite_file":
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(item.get("content", ""))
            return {"success": True, "message": f"File '{target_path.name}' has been updated, sir."}

        return {"success": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"success": False, "error": f"Execution failed: {str(e)}"}
