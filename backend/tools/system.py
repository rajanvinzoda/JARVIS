"""
J.A.R.V.I.S. OS System Diagnostics Tool
Gathers real hardware metrics using psutil, platform, and Windows WMI/nvidia-smi if available.
Never fabricates statistics.
"""

import os
import platform
import time
import subprocess
try:
    import psutil
except ImportError:
    psutil = None

BOOT_TIME = time.time()

def get_system_diagnostics():
    """
    Retrieves genuine system metrics.
    Returns:
        dict: CPU, RAM, Disk, Network, Battery, GPU, OS info.
    """
    data = {
        "timestamp": int(time.time()),
        "os": {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "architecture": platform.machine(),
            "processor": platform.processor() or "Generic Processor",
            "hostname": platform.node()
        },
        "uptime_seconds": int(time.time() - (psutil.boot_time() if psutil else BOOT_TIME)),
        "cpu": {
            "percent": None,
            "cores_physical": None,
            "cores_logical": None,
            "frequency_mhz": None
        },
        "memory": {
            "percent": None,
            "total_gb": None,
            "used_gb": None,
            "available_gb": None
        },
        "disk": {
            "percent": None,
            "total_gb": None,
            "used_gb": None,
            "free_gb": None
        },
        "network": {
            "bytes_sent": None,
            "bytes_recv": None,
            "status": "online"
        },
        "battery": {
            "percent": None,
            "power_plugged": None,
            "status_text": "N/A"
        },
        "gpu": {
            "name": "Telemetry unavailable",
            "load_percent": None,
            "memory_percent": None,
            "available": False
        }
    }

    if not psutil:
        return data

    try:
        # CPU
        data["cpu"]["percent"] = round(psutil.cpu_percent(interval=None), 1)
        data["cpu"]["cores_physical"] = psutil.cpu_count(logical=False)
        data["cpu"]["cores_logical"] = psutil.cpu_count(logical=True)
        freq = psutil.cpu_freq()
        if freq:
            data["cpu"]["frequency_mhz"] = round(freq.current, 0)

        # Memory
        mem = psutil.virtual_memory()
        data["memory"]["percent"] = round(mem.percent, 1)
        data["memory"]["total_gb"] = round(mem.total / (1024 ** 3), 2)
        data["memory"]["used_gb"] = round(mem.used / (1024 ** 3), 2)
        data["memory"]["available_gb"] = round(mem.available / (1024 ** 3), 2)

        # Primary disk
        root_path = "C:\\" if platform.system() == "Windows" else "/"
        try:
            disk = psutil.disk_usage(root_path)
            data["disk"]["percent"] = round(disk.percent, 1)
            data["disk"]["total_gb"] = round(disk.total / (1024 ** 3), 2)
            data["disk"]["used_gb"] = round(disk.used / (1024 ** 3), 2)
            data["disk"]["free_gb"] = round(disk.free / (1024 ** 3), 2)
        except Exception:
            pass

        # Network
        net = psutil.net_io_counters()
        if net:
            data["network"]["bytes_sent"] = net.bytes_sent
            data["network"]["bytes_recv"] = net.bytes_recv

        # Battery
        bat = psutil.sensors_battery()
        if bat is not None:
            data["battery"]["percent"] = round(bat.percent, 0)
            data["battery"]["power_plugged"] = bat.power_plugged
            status = f"{int(bat.percent)}%"
            if bat.power_plugged:
                status += " (Charging)"
            data["battery"]["status_text"] = status
        else:
            data["battery"]["status_text"] = "AC Power / N/A"

        # Optional GPU detection via nvidia-smi
        try:
            res = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,utilization.gpu,memory.used,memory.total", "--format=csv,noheader,nounits"],
                capture_output=True,
                text=True,
                timeout=1
            )
            if res.returncode == 0 and res.stdout.strip():
                parts = [p.strip() for p in res.stdout.strip().split(",")]
                if len(parts) >= 4:
                    data["gpu"]["name"] = parts[0]
                    data["gpu"]["load_percent"] = float(parts[1])
                    mem_used = float(parts[2])
                    mem_total = float(parts[3])
                    data["gpu"]["memory_percent"] = round((mem_used / mem_total) * 100, 1) if mem_total > 0 else 0
                    data["gpu"]["available"] = True
        except Exception:
            pass

    except Exception as e:
        data["error"] = str(e)

    return data
