# J.A.R.V.I.S. OS — Local Windows AI Desktop Assistant

An authentic cybernetic J.A.R.V.I.S. operating HUD integrated with a local Python execution server and BluesMinds AI neural orchestration layer.

---

## 🚀 Quick Start on Windows

### 1. Prerequisites
- **Windows 10 / 11**
- **Python 3.10+** (ensure "Add Python to PATH" is checked during install)
- Modern web browser (Chrome, Edge, or Brave for Web Speech API support)

### 2. Environment Setup
Create or update your `.env` file in the project root:
```env
BLUESMINDS_API_KEY=sk-3wuicKrtIHVMrkvmQ0seTgcBqa5B49LRXQnlFziNNe4clf9K
BLUESMINDS_MODEL=meta/llama-3.2-11b-vision-instruct
JARVIS_HOST=127.0.0.1
JARVIS_PORT=5000
```

### 3. One-Click Launch
Double-click `run_jarvis.bat` or run in Command Prompt / PowerShell:
```cmd
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python backend/server.py
```

Open the HUD in your browser. The interface will automatically connect to `http://127.0.0.1:5000`!

---

## 🛡️ Security & Controlled Tool Boundary

1. **Permitted Directory Sandbox:**
   - Access is strictly constrained to `Desktop`, `Documents`, `Downloads`, and the local `sandbox` directory.
   - Path traversal (`../`), unauthorized absolute paths, and outside drive access are actively blocked and logged.
2. **Destructive Operation Confirmation:**
   - Permanent file deletions and existing file overwrites trigger an explicit HUD confirmation modal:
     `[CONFIRM EXECUTION]` or `[CANCEL]`.
   - The AI cannot bypass this security barrier.
3. **Application Launcher Registry:**
   - Predefined safe targets only (Chrome, Edge, VS Code, Notepad, Calculator, Explorer, Terminal, Settings).
   - Rejects arbitrary shell command strings.
4. **Zero-Hallucination Hardware Telemetry:**
   - True hardware metrics using `psutil` (CPU core load %, RAM usage, disk, network throughput, battery level).

---

## 🎙️ Voice & Cybernetic HUD Commands
- Click **MIC** or press the microphone hotkey for hands-free speech recognition.
- Click **VOX** to toggle synthesized speech audio responses.
- Supports both direct commands (`time`, `scan`, `theme`, `clear`, `apps`, `help`) and natural language requests:
  - *"Jarvis, what's on my desktop?"*
  - *"Create a file called project.py on my desktop and write print('Hello') in it."*
  - *"Read my notes file."*
  - *"Open Visual Studio Code."*
  - *"What are my current system diagnostics?"*
