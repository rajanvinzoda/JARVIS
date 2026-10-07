# J.A.R.V.I.S. OS — Local Windows AI Assistant

## Master Architectural Specification & Implementation

An authentic local Windows AI assistant powered by the cybernetic J.A.R.V.I.S. HUD, backed by a local Python execution & security boundary, and orchestrated via the BluesMinds AI API.

```
USER
 ↓
J.A.R.V.I.S. HUD (Frontend)
 ↓
LOCAL PYTHON BACKEND (http://127.0.0.1:5000)
 ↓
AI ORCHESTRATION / TOOL ROUTER
 ↓
BLUESMINDS AI (meta/llama-3.2-11b-vision-instruct)
 ↓
CONTROLLED LOCAL TOOLS (Security Guard)
 ↓
WINDOWS / FILESYSTEM / SYSTEM TELEMETRY
 ↓
RESULT -> J.A.R.V.I.S. -> USER
```

---

## 🛡️ Core Security Architecture

1. **AI Is Not Trusted:** The AI never executes raw PowerShell, CMD, or arbitrary shell strings. It can only request strictly predefined, typed tools.
2. **Path Traversal & Sandbox Enforcement:** All file accesses are resolved to canonical realpaths and verified against authorized roots:
   - `Desktop`
   - `Documents`
   - `Downloads`
   - Dedicated `sandbox` folder
   Any attempt to access `C:\Windows`, `System32`, or escape via `../` is actively blocked and logged.
3. **Destructive Action Safety:**
   - Soft deletion moves files to the local Recycle Bin rather than permanent destruction.
   - Deletions, overwrites, system reboots, and shutdowns generate a secure confirmation token. The AI cannot confirm its own operations; execution halts until the user explicitly clicks `[CONFIRM]` in the HUD.
4. **Zero-Hallucination Hardware Telemetry:** CPU load, RAM utilization, storage, network throughput, and battery states are read directly from `psutil` and hardware counters.

---

## 🗄️ Project Structure

```
JARVIS/
├── frontend/
│   ├── index.html        # Standalone HUD entrypoint
│   ├── css/
│   │   └── jarvis.css    # Cybernetic HUD styles & Arc Reactor animations
│   └── js/
│       └── jarvis.js     # Client controller & Speech API
│
├── backend/
│   ├── server.py         # Flask API server (http://127.0.0.1:5000)
│   ├── ai.py             # BluesMinds orchestration & tool dispatcher
│   ├── config.py         # Dynamic user folder discovery & registry
│   ├── security.py       # Canonical path validation & confirmation tokens
│   ├── memory.py         # SQLite persistent facts, notes & audit logs
│   └── tools/
│       ├── files.py      # Sandboxed file operations & soft deletion
│       ├── apps.py       # Safe application launcher & process control
│       ├── system.py     # psutil telemetry & process inspection
│       ├── windows.py    # Lock, power states, and clipboard
│       └── web.py        # Safe URL opening & Google search
│
├── data/
│   ├── jarvis.db         # SQLite persistent database
│   └── sandbox/          # Permitted workspace directories
│
├── .env.example          # Safe template without secrets
├── requirements.txt      # Python dependencies
├── run_jarvis.bat        # 1-click Windows startup script
└── README.md
```

---

## 🚀 One-Click Windows Startup

1. **Clone / Download the project files.**
2. **Double-click `run_jarvis.bat`** in Windows Explorer.
   - Automatically checks Python 3.10+
   - Creates and activates virtual environment `venv`
   - Installs dependencies (`flask`, `psutil`, `requests`, `python-dotenv`)
   - Verifies SQLite database (`data/jarvis.db`)
   - Starts Flask on `http://127.0.0.1:5000`
   - Automatically launches your browser to the HUD!

---

## ⚙️ Environment Variables

Create `.env` in the root directory:
```env
BLUESMINDS_API_KEY=YOUR_BLUESMINDS_API_KEY
BLUESMINDS_MODEL=meta/llama-3.2-11b-vision-instruct
JARVIS_HOST=127.0.0.1
JARVIS_PORT=5000
```

---

## 🎙️ Cybernetic HUD Features

- **Voice Input (MIC):** Press the MIC button for speech recognition.
- **Voice Output (VOX):** Toggle synthesized audio responses in J.A.R.V.I.S.'s calm, concise tone.
- **Top Processes Inspector:** Monitor high-memory and high-CPU processes.
- **Windows Power Controls:** Lock workstation, shutdown, restart, and sleep with confirmation guards.
- **Offline Resilience:** If the AI API is offline or disconnected, J.A.R.V.I.S. transparently executes deterministic local commands (`time`, `scan`, `apps`, `files`, `windows`, `theme`, `clear`).
