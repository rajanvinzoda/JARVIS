"""
J.A.R.V.I.S. OS File System Security and Operations Layer
Implements strict path traversal verification, permitted directory boundaries,
and user-confirmed destructive safety protocols.
"""

import os
import shutil
import time
from pathlib import Path
from backend.security import (
    resolve_secure_path,
    is_binary_file,
    create_confirmation_request,
    MAX_READ_BYTES,
    SecurityError
)
from backend.config import ALLOWED_DIRECTORIES, DATA_DIR

# Dedicated recycle/trash folder in data for soft deletion
RECYCLE_BIN = DATA_DIR / "recycle_bin"
RECYCLE_BIN.mkdir(parents=True, exist_ok=True)

def list_files(folder_path: str = "desktop") -> dict:
    """Lists files and directories inside an authorized directory."""
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

        items.sort(key=lambda x: (0 if x["type"] == "directory" else 1, x["name"].lower()))
        return {
            "success": True,
            "tool": "list_files",
            "directory": resolved.name,
            "total_items": len(items),
            "items": items
        }
    except SecurityError as e:
        return {"success": False, "tool": "list_files", "error": str(e)}
    except Exception as e:
        return {"success": False, "tool": "list_files", "error": f"Directory access error: {str(e)}"}

def search_files(folder_path: str = "desktop", query: str = "") -> dict:
    """Searches for files matching a query within an authorized directory."""
    try:
        resolved = resolve_secure_path(folder_path)
        if not resolved.exists() or not resolved.is_dir():
            return {"success": False, "error": f"Invalid search directory: {folder_path}"}

        q = query.strip().lower()
        matches = []
        for root, dirs, files in os.walk(resolved):
            # Bound search depth
            rel = Path(root).relative_to(resolved)
            if len(rel.parts) > 4:
                continue
            for f in files:
                if q in f.lower():
                    fp = Path(root) / f
                    try:
                        st = fp.stat()
                        matches.append({
                            "name": f,
                            "relative_path": str(fp.relative_to(resolved)),
                            "size_bytes": st.st_size,
                            "modified": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(st.st_mtime))
                        })
                    except Exception:
                        pass

        return {
            "success": True,
            "tool": "search_files",
            "query": query,
            "directory": resolved.name,
            "matches_count": len(matches),
            "matches": matches[:30]
        }
    except SecurityError as e:
        return {"success": False, "tool": "search_files", "error": str(e)}
    except Exception as e:
        return {"success": False, "tool": "search_files", "error": f"Search failed: {str(e)}"}

def read_file(file_path: str) -> dict:
    """Reads text content from permitted files. Returns metadata for binaries or oversized files."""
    try:
        resolved = resolve_secure_path(file_path)
        if not resolved.exists():
            return {"success": False, "tool": "read_file", "error": f"File '{resolved.name}' not found."}
        if not resolved.is_file():
            return {"success": False, "tool": "read_file", "error": f"'{resolved.name}' is a directory, not a file."}

        stat = resolved.stat()

        # Binary check
        if is_binary_file(resolved):
            return {
                "success": True,
                "tool": "read_file",
                "is_binary": True,
                "filename": resolved.name,
                "size_bytes": stat.st_size,
                "size_display": f"{round(stat.st_size / 1024, 1)} KB",
                "modified": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime)),
                "message": f"File '{resolved.name}' is a binary format ({resolved.suffix}). Inspecting metadata only."
            }

        # Size check
        if stat.st_size > MAX_READ_BYTES:
            return {
                "success": False,
                "tool": "read_file",
                "error": f"File '{resolved.name}' exceeds the 5MB safety limit ({round(stat.st_size / (1024*1024), 2)} MB). Direct reading restricted."
            }

        with open(resolved, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        return {
            "success": True,
            "tool": "read_file",
            "filename": resolved.name,
            "size_bytes": stat.st_size,
            "content": content
        }
    except SecurityError as e:
        return {"success": False, "tool": "read_file", "error": str(e)}
    except Exception as e:
        return {"success": False, "tool": "read_file", "error": f"Read error: {str(e)}"}

def create_file(file_path: str, content: str = "") -> dict:
    """Creates a new file. If the file already exists, requests user confirmation to overwrite."""
    try:
        resolved = resolve_secure_path(file_path)
        if resolved.exists():
            return create_confirmation_request(
                tool_name="write_file",
                params={"path": str(resolved), "content": content},
                prompt=f"File '{resolved.name}' already exists. Overwriting will replace existing data. Shall I proceed, sir?"
            )

        resolved.parent.mkdir(parents=True, exist_ok=True)
        with open(resolved, "w", encoding="utf-8") as f:
            f.write(content)

        return {
            "success": True,
            "tool": "create_file",
            "filename": resolved.name,
            "path": str(resolved),
            "message": f"File '{resolved.name}' has been created successfully, sir."
        }
    except SecurityError as e:
        return {"success": False, "tool": "create_file", "error": str(e)}
    except Exception as e:
        return {"success": False, "tool": "create_file", "error": f"Creation failed: {str(e)}"}

def write_file(file_path: str, content: str = "") -> dict:
    """Writes content to a file. Requires confirmation if overwriting existing content."""
    try:
        resolved = resolve_secure_path(file_path)
        if resolved.exists() and resolved.stat().st_size > 0:
            return create_confirmation_request(
                tool_name="write_file",
                params={"path": str(resolved), "content": content},
                prompt=f"Updating '{resolved.name}' will overwrite existing contents ({resolved.stat().st_size} bytes). Confirm execution, sir?"
            )

        resolved.parent.mkdir(parents=True, exist_ok=True)
        with open(resolved, "w", encoding="utf-8") as f:
            f.write(content)

        return {
            "success": True,
            "tool": "write_file",
            "filename": resolved.name,
            "message": f"File '{resolved.name}' updated successfully, sir."
        }
    except SecurityError as e:
        return {"success": False, "tool": "write_file", "error": str(e)}
    except Exception as e:
        return {"success": False, "tool": "write_file", "error": f"Write failed: {str(e)}"}

def append_file(file_path: str, content: str) -> dict:
    """Appends content to an existing file without modifying previous data."""
    try:
        resolved = resolve_secure_path(file_path)
        resolved.parent.mkdir(parents=True, exist_ok=True)
        with open(resolved, "a", encoding="utf-8") as f:
            f.write(content if content.endswith("\n") else content + "\n")

        return {
            "success": True,
            "tool": "append_file",
            "filename": resolved.name,
            "message": f"Appended text to '{resolved.name}', sir."
        }
    except SecurityError as e:
        return {"success": False, "tool": "append_file", "error": str(e)}
    except Exception as e:
        return {"success": False, "tool": "append_file", "error": f"Append failed: {str(e)}"}

def rename_file(old_path: str, new_path: str) -> dict:
    """Renames a file or folder within authorized directories."""
    try:
        source = resolve_secure_path(old_path)
        dest = resolve_secure_path(new_path)

        if not source.exists():
            return {"success": False, "tool": "rename_file", "error": f"Source item '{source.name}' does not exist."}
        if dest.exists():
            return {"success": False, "tool": "rename_file", "error": f"Destination item '{dest.name}' already exists."}

        source.rename(dest)
        return {
            "success": True,
            "tool": "rename_file",
            "old_name": source.name,
            "new_name": dest.name,
            "message": f"Renamed '{source.name}' to '{dest.name}', sir."
        }
    except SecurityError as e:
        return {"success": False, "tool": "rename_file", "error": str(e)}
    except Exception as e:
        return {"success": False, "tool": "rename_file", "error": f"Rename failed: {str(e)}"}

def copy_file(source_path: str, dest_path: str) -> dict:
    """Copies a file or directory within authorized boundaries."""
    try:
        src = resolve_secure_path(source_path)
        dst = resolve_secure_path(dest_path)

        if not src.exists():
            return {"success": False, "tool": "copy_file", "error": f"Source item '{src.name}' not found."}

        if src.is_dir():
            shutil.copytree(src, dst)
        else:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)

        return {
            "success": True,
            "tool": "copy_file",
            "source": src.name,
            "destination": dst.name,
            "message": f"Successfully copied '{src.name}' to '{dst.name}', sir."
        }
    except SecurityError as e:
        return {"success": False, "tool": "copy_file", "error": str(e)}
    except Exception as e:
        return {"success": False, "tool": "copy_file", "error": f"Copy failed: {str(e)}"}

def move_file(source_path: str, dest_path: str) -> dict:
    """Moves a file or folder within authorized boundaries."""
    try:
        src = resolve_secure_path(source_path)
        dst = resolve_secure_path(dest_path)

        if not src.exists():
            return {"success": False, "tool": "move_file", "error": f"Source item '{src.name}' not found."}

        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))

        return {
            "success": True,
            "tool": "move_file",
            "source": src.name,
            "destination": dst.name,
            "message": f"Successfully moved '{src.name}' to '{dst.name}', sir."
        }
    except SecurityError as e:
        return {"success": False, "tool": "move_file", "error": str(e)}
    except Exception as e:
        return {"success": False, "tool": "move_file", "error": f"Move failed: {str(e)}"}

def delete_file(file_path: str) -> dict:
    """
    Normal deletion: moves file to the recycle bin / local trash folder.
    Requires user confirmation!
    """
    try:
        resolved = resolve_secure_path(file_path)
        if not resolved.exists():
            return {"success": False, "tool": "delete_file", "error": f"Item '{resolved.name}' not found."}

        return create_confirmation_request(
            tool_name="delete_file",
            params={"path": str(resolved), "is_dir": resolved.is_dir(), "permanent": False},
            prompt=f"Sir, this will move '{resolved.name}' to the Recycle Bin. Shall I proceed?"
        )
    except SecurityError as e:
        return {"success": False, "tool": "delete_file", "error": str(e)}
    except Exception as e:
        return {"success": False, "tool": "delete_file", "error": f"Delete request failed: {str(e)}"}

def permanent_delete(file_path: str) -> dict:
    """
    Permanent deletion: destroys file immediately.
    Requires STRONGER confirmation!
    """
    try:
        resolved = resolve_secure_path(file_path)
        if not resolved.exists():
            return {"success": False, "tool": "permanent_delete", "error": f"Item '{resolved.name}' not found."}

        return create_confirmation_request(
            tool_name="permanent_delete",
            params={"path": str(resolved), "is_dir": resolved.is_dir(), "permanent": True},
            prompt=f"WARNING: Permanently deleting '{resolved.name}' cannot be undone. Confirm permanent destruction, sir?"
        )
    except SecurityError as e:
        return {"success": False, "tool": "permanent_delete", "error": str(e)}
    except Exception as e:
        return {"success": False, "tool": "permanent_delete", "error": f"Permanent delete request failed: {str(e)}"}

def execute_confirmed_file_action(action_data: dict) -> dict:
    """Executes a confirmed file action."""
    tool = action_data.get("tool")
    params = action_data.get("params", {})
    target_path = Path(params["path"])

    try:
        if tool == "delete_file":
            # Soft delete: move to RECYCLE_BIN
            timestamp = int(time.time())
            trash_dest = RECYCLE_BIN / f"{timestamp}_{target_path.name}"
            shutil.move(str(target_path), str(trash_dest))
            return {
                "success": True,
                "tool": "delete_file",
                "message": f"Moved '{target_path.name}' to the Recycle Bin, sir."
            }

        elif tool == "permanent_delete":
            # Hard delete
            if params.get("is_dir"):
                shutil.rmtree(target_path)
            else:
                target_path.unlink()
            return {
                "success": True,
                "tool": "permanent_delete",
                "message": f"Permanently deleted '{target_path.name}', sir."
            }

        elif tool == "write_file":
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(params.get("content", ""))
            return {
                "success": True,
                "tool": "write_file",
                "message": f"Successfully updated '{target_path.name}', sir."
            }

        return {"success": False, "error": f"Unknown confirmed action: {tool}"}
    except Exception as e:
        return {"success": False, "error": f"Execution failed: {str(e)}"}
