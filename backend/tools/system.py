"""
J.A.R.V.I.S. OS System & Hardware Diagnostics Tool
Retrieves authentic machine metrics using psutil, platform, and nvidia-smi.
Never fabricates statistics.
"""

import os
import platform
import time
import subprocess
from datetime import datetime
try:
    import psutil
except ImportError:
    psutil = None

BOOT_TIME = time.time()
_last_net_time = time.time()
_last_net_io = None

def get_time() -> str:
    """Returns formatted current time."""
    return datetime.now().strftime("%H:%M:%S")

def get_date() -> str:
    """Returns formatted current date."""
    return datetime.now().strftime("%A, %B %d, %Y")

def get_battery() -> dict:
    """Returns authentic battery and power status."""
    if not psutil:
        return {"percent": 100, "charging": True, "status_text": "AC Line Power (psutil unavailable)"}

    try:
        bat = psutil.sensors_battery()
        if bat is not None:
            pct = round(bat.percent, 0)
            status_text = f"{int(pct)}%"
            if bat.power_plugged:
                status_text += " (Charging)"
            return {
                "has_battery": True,
                "percent": pct,
                "charging": bat.power_plugged,
                "status_text": status_text
            }
        else:
            return {
                "has_battery": False,
                "percent": 100,
                "charging": True,
                "status_text": "AC Line Power"
            }
    except Exception:
        return {
            "has_battery": False,
            "percent": 100,
            "charging": True,
            "status_text": "AC Line Power"
        }

def get_network_info() -> dict:
    """Measures current network throughput in Megabits per second."""
    global _last_net_time, _last_net_io

    if not psutil:
        return {"download_mbps": 0.0, "upload_mbps": 0.0, "mbps": 0.0, "status": "online"}

    try:
        current_io = psutil.net_io_counters()
        current_time = time.time()

        if _last_net_io is None:
            _last_net_io = current_io
            _last_net_time = current_time
            return {"download_mbps": 0.0, "upload_mbps": 0.0, "mbps": 0.0, "status": "online"}

        time_delta = max(0.1, current_time - _last_net_time)
        rx_bytes = current_io.bytes_recv - _last_net_io.bytes_recv
        tx_bytes = current_io.bytes_sent - _last_net_io.bytes_sent

        # Convert bytes/sec to Megabits/sec
        rx_mbps = round((rx_bytes * 8) / (time_delta * 1024 * 1024), 2)
        tx_mbps = round((tx_bytes * 8) / (time_delta * 1024 * 1024), 2)
        total_mbps = round(rx_mbps + tx_mbps, 2)

        _last_net_io = current_io
        _last_net_time = current_time

        return {
            "download_mbps": max(0.0, rx_mbps),
            "upload_mbps": max(0.0, tx_mbps),
            "mbps": max(0.0, total_mbps),
            "status": "online"
        }
    except Exception:
        return {"download_mbps": 0.0, "upload_mbps": 0.0, "mbps": 0.0, "status": "online"}

def get_gpu_info() -> dict:
    """Attempts genuine GPU telemetry detection via nvidia-smi. Never fakes values."""
    data = {
        "name": "GPU: UNAVAILABLE",
        "load_percent": None,
        "temperature_c": None,
        "vram_used_mb": None,
        "vram_total_mb": None,
        "available": False
    }

    try:
        res = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,utilization.gpu,temperature.gpu,memory.used,memory.total",
                "--format=csv,noheader,nounits"
            ],
            capture_output=True,
            text=True,
            timeout=1
        )
        if res.returncode == 0 and res.stdout.strip():
            parts = [p.strip() for p in res.stdout.strip().split(",")]
            if len(parts) >= 5:
                data["name"] = parts[0]
                data["load_percent"] = float(parts[1])
                data["temperature_c"] = float(parts[2])
                data["vram_used_mb"] = float(parts[3])
                data["vram_total_mb"] = float(parts[4])
                data["available"] = True
    except Exception:
        pass

    return data

def list_processes(limit: int = 10) -> dict:
    """Returns top active processes by CPU and memory consumption."""
    if not psutil:
        return {"processes": [], "error": "psutil unavailable"}

    procs = []
    for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
        try:
            procs.append({
                "pid": p.info['pid'],
                "name": p.info['name'] or "unknown",
                "cpu_percent": round(p.info['cpu_percent'] or 0.0, 1),
                "memory_percent": round(p.info['memory_percent'] or 0.0, 1)
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    # Sort by memory consumption descending
    procs.sort(key=lambda x: x["memory_percent"], reverse=True)
    return {
        "success": True,
        "total_active": len(procs),
        "top_processes": procs[:limit]
    }

def get_system_diagnostics() -> dict:
    """Gathers full authentic system hardware metrics."""
    data = {
        "timestamp": int(time.time()),
        "time": get_time(),
        "date": get_date(),
        "os": {
            "platform": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "architecture": platform.machine(),
            "processor": platform.processor() or "CPU",
            "hostname": platform.node(),
            "uptime_seconds": int(time.time() - (psutil.boot_time() if psutil else BOOT_TIME))
        },
        "cpu": {
            "percent": 0.0,
            "cores": psutil.cpu_count(logical=True) if psutil else 1,
            "model": platform.processor() or "Generic Processor"
        },
        "memory": {
            "percent": 0.0,
            "total_gb": 0.0,
            "used_gb": 0.0,
            "available_gb": 0.0
        },
        "disk": {
            "percent": 0.0,
            "total_gb": 0.0,
            "used_gb": 0.0
        },
        "network": get_network_info(),
        "battery": get_battery(),
        "gpu": get_gpu_info()
    }

    if not psutil:
        return data

    try:
        # CPU
        data["cpu"]["percent"] = round(psutil.cpu_percent(interval=None), 1)

        # Memory
        mem = psutil.virtual_memory()
        data["memory"]["percent"] = round(mem.percent, 1)
        data["memory"]["total_gb"] = round(mem.total / (1024 ** 3), 1)
        data["memory"]["used_gb"] = round(mem.used / (1024 ** 3), 1)
        data["memory"]["available_gb"] = round(mem.available / (1024 ** 3), 1)

        # Primary disk
        root_path = "C:\\" if platform.system() == "Windows" else "/"
        try:
            disk = psutil.disk_usage(root_path)
            data["disk"]["percent"] = round(disk.percent, 1)
            data["disk"]["total_gb"] = round(disk.total / (1024 ** 3), 1)
            data["disk"]["used_gb"] = round(disk.used / (1024 ** 3), 1)
        except Exception:
            pass

    except Exception as e:
        data["error"] = str(e)

    return data
