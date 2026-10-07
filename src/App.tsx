/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Volume2,
  VolumeX,
  Terminal,
  Folder,
  Cpu,
  Monitor,
  Settings,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Copy,
  Trash2,
  FileText,
  Clock,
  Layers,
  Sparkles,
  ShieldAlert,
  Activity,
  Lock,
  Power,
  Search,
  Clipboard,
} from 'lucide-react';

type ProcessingState =
  | 'IDLE'
  | 'ANALYZING'
  | 'EXECUTING'
  | 'WAITING FOR CONFIRMATION'
  | 'COMPLETED'
  | 'ERROR';

interface LogMessage {
  id: string;
  sender: 'user' | 'jarvis';
  text: string;
  timestamp: string;
  operation_id?: string;
  isProcessing?: boolean;
  action?: {
    tool: string;
    args?: any;
    result?: any;
  };
}

interface SystemTelemetry {
  cpu: { percent: number; cores?: number; model?: string };
  memory: { percent: number; total_gb?: number; used_gb?: number };
  disk: { percent: number; total_gb?: number; used_gb?: number };
  network: { mbps: number; status: string; download_mbps?: number; upload_mbps?: number };
  battery: { percent: number; status_text: string; charging?: boolean };
  gpu?: { name?: string; available?: boolean; load_percent?: number };
  os?: { platform: string; hostname?: string; uptime_seconds?: number };
}

interface PendingConfirmation {
  confirmation_id: string;
  operation_id?: string;
  prompt: string;
  path?: string;
  action?: string;
}

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size_bytes: number;
  size_display: string;
  modified: string;
  path: string;
}

interface ProcessItem {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_percent: number;
}

export default function App() {
  // Boot Sequence State
  const [booting, setBooting] = useState(true);
  const [bootLog, setBootLog] = useState<string[]>([]);
  const [bootSkipped, setBootSkipped] = useState(false);

  // HUD Clock & Telemetry
  const [timeStr, setTimeStr] = useState('--:--:--');
  const [dateStr, setDateStr] = useState('');
  const [systemStats, setSystemStats] = useState<SystemTelemetry>({
    cpu: { percent: 18.5 },
    memory: { percent: 45.2 },
    disk: { percent: 38.0 },
    network: { mbps: 72, status: 'online' },
    battery: { percent: 98, status_text: 'AC Line Power' },
    gpu: { name: 'GPU: TELEMETRY PENDING', available: false },
  });

  // Processing State
  const [processingState, setProcessingState] = useState<ProcessingState>('IDLE');
  const [neuralLinkOnline, setNeuralLinkOnline] = useState<boolean>(true);

  // Notes
  const [notes, setNotes] = useState('');

  // Status line & Console
  const [hudStatus, setHudStatus] = useState('ALL SYSTEMS NOMINAL');
  const [consoleLogs, setConsoleLogs] = useState<LogMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIndex, setHistIndex] = useState<number>(-1);

  // Audio & Voice
  const [voxEnabled, setVoxEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Modals & Drawers
  const [activeModal, setActiveModal] = useState<
    'none' | 'apps' | 'files' | 'agent' | 'help' | 'viewFile' | 'processes' | 'windows' | 'terminal'
  >('none');
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState('desktop');
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [selectedFileContent, setSelectedFileContent] = useState<{
    name: string;
    content: string;
    size: number;
  } | null>(null);
  const [processList, setProcessList] = useState<ProcessItem[]>([]);
  const [clipboardText, setClipboardText] = useState<string>('');
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);

  // Terminal Automation Subsystem State
  const [terminalStatus, setTerminalStatus] = useState<{
    alive: boolean;
    hwnd?: string | null;
    title?: string;
    session_id?: string;
  } | null>(null);
  const [terminalCmdInput, setTerminalCmdInput] = useState('');
  const [terminalExecuting, setTerminalExecuting] = useState(false);

  // Local vs Cloud Backend Target
  const [backendEndpoint, setBackendEndpoint] = useState<string>('/api');
  const [isLocalWindowsConnected, setIsLocalWindowsConnected] = useState<boolean>(false);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Format Helper
  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  };

  // 1. Boot Sequence Animation
  useEffect(() => {
    if (bootSkipped) return;
    const lines = [
      'J.A.R.V.I.S. KERNEL 1.0 — INITIALIZING',
      'Loading arc reactor magnetic containment... OK',
      'Calibrating repulsor arrays and subroutines... OK',
      'Mounting neural language interface layer... OK',
      'Establishing secure uplink to BluesMinds AI API... OK',
      'Verifying Windows tool permissions & sandbox boundaries... OK',
      'Diagnostics verified. Welcome back, sir.',
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < lines.length) {
        setBootLog((prev) => [...prev, lines[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setBooting(false);
          const welcome = `Good ${getGreeting()}, sir. All systems are online. Type help for commands or speak freely.`;
          addJarvisLog(welcome);
          if (voxEnabled) speak(welcome);
        }, 500);
      }
    }, 280);

    return () => clearInterval(interval);
  }, [bootSkipped]);

  // 2. Chronometer Clock Tick
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString([], { hour12: false }));
      setDateStr(
        d
          .toLocaleDateString([], {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
          .toUpperCase()
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. Real Telemetry Fetching (GET /api/system)
  const fetchTelemetry = async () => {
    try {
      const res = await fetch(`${backendEndpoint}/system`);
      if (res.ok) {
        const data = await res.json();
        setSystemStats(data);
      }
    } catch {
      // Backend temporarily unreachable
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 2500);
    return () => clearInterval(interval);
  }, [backendEndpoint]);

  // 4. Notes Persistence
  useEffect(() => {
    fetch(`${backendEndpoint}/notes`)
      .then((r) => r.json())
      .then((d) => {
        if (d.notes) {
          setNotes(d.notes);
        } else {
          const local = localStorage.getItem('jarvis-notes') || '';
          setNotes(local);
        }
      })
      .catch(() => {
        const local = localStorage.getItem('jarvis-notes') || '';
        setNotes(local);
      });
  }, [backendEndpoint]);

  const handleNotesChange = (val: string) => {
    setNotes(val);
    try {
      localStorage.setItem('jarvis-notes', val);
    } catch {}
    fetch(`${backendEndpoint}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: val }),
    }).catch(() => {});
  };

  // 5. Speech Synthesis
  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*#`_\[\]()]/g, '').trim();
      const utter = new SpeechSynthesisUtterance(cleanText);
      utter.rate = 1.05;
      utter.pitch = 0.95;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn('SpeechSynthesis error:', e);
    }
  };

  // 6. Speech Recognition
  const toggleSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      addJarvisLog('Speech recognition is not supported in this browser, sir.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setHudStatus('ALL SYSTEMS NOMINAL');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = navigator.language || 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setHudStatus('LISTENING...');
      };

      recognition.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setIsListening(false);
        setHudStatus('SPEECH RECEIVED');
        executeCommand(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
        setHudStatus('ALL SYSTEMS NOMINAL');
      };

      recognition.onend = () => {
        setIsListening(false);
        setHudStatus('ALL SYSTEMS NOMINAL');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [consoleLogs]);

  // Log helpers
  const addUserLog = (text: string) => {
    const newLog: LogMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
    };
    setConsoleLogs((prev) => [...prev, newLog]);
  };

  const addJarvisLog = (
    text: string,
    action?: { tool: string; args?: any; result?: any },
    opId?: string
  ) => {
    const newLog: LogMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'jarvis',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      operation_id: opId,
      action,
    };
    setConsoleLogs((prev) => [...prev, newLog]);
    setHudStatus(text.slice(0, 50).toUpperCase());
  };

  // Command Execution Engine
  const executeCommand = async (inputStr: string) => {
    const raw = inputStr.trim();
    if (!raw) return;

    addUserLog(raw);
    setInputVal('');
    setHistory((prev) => [...prev, raw]);
    setHistIndex(-1);

    const low = raw.toLowerCase().replace(/[?!.]+$/, '');

    // 1. Direct local deterministic commands
    if (low === 'theme') {
      const r = document.documentElement;
      const currentDark =
        r.dataset.theme !== 'light' &&
        getComputedStyle(r).getPropertyValue('--bg').trim() === '#02121c';
      const nextTheme = currentDark ? 'light' : 'dark';
      r.dataset.theme = nextTheme;
      const msg = `Theme toggled to ${nextTheme === 'light' ? 'daylight' : 'stealth'} mode, sir.`;
      addJarvisLog(msg);
      if (voxEnabled) speak(msg);
      return;
    }

    if (low === 'vox') {
      const nextVox = !voxEnabled;
      setVoxEnabled(nextVox);
      const msg = `Voice synthesis ${nextVox ? 'activated' : 'deactivated'}, sir.`;
      addJarvisLog(msg);
      if (nextVox) speak(msg);
      return;
    }

    if (low === 'clear') {
      setConsoleLogs([]);
      setHudStatus('CONSOLE CLEARED');
      return;
    }

    if (low === 'scan') {
      await fetchTelemetry();
      const cpu = systemStats.cpu.percent;
      const mem = systemStats.memory.percent;
      const bat = systemStats.battery.status_text;
      const osName = systemStats.os?.platform || 'Windows';
      const msg = `Full diagnostic complete, sir. Core load is at ${cpu}%, memory consumption at ${mem}%, power state: ${bat}. Host OS platform: ${osName}.`;
      addJarvisLog(msg);
      if (voxEnabled) speak(msg);
      return;
    }

    if (low === 'help') {
      setActiveModal('help');
      const msg =
        'Direct commands: time, date, scan, theme, vox, clear, apps, files, processes, windows, clip, note <text>, calc <expr>, search <query>, who are you.';
      addJarvisLog(msg);
      if (voxEnabled) speak('Displaying system capabilities and commands, sir.');
      return;
    }

    if (low === 'apps') {
      setActiveModal('apps');
      addJarvisLog('Opening application launcher registry, sir.');
      return;
    }

    if (['cmd', 'terminal', 'open cmd', 'open terminal', 'launch cmd', 'launch terminal', 'start console'].includes(low)) {
      handleLaunchCmd();
      return;
    }

    if (['close cmd', 'close terminal', 'exit cmd'].includes(low)) {
      handleCloseCmd();
      return;
    }

    if (low === 'files') {
      fetchFolderFiles('desktop');
      setActiveModal('files');
      addJarvisLog('Opening file system explorer, sir.');
      return;
    }

    if (low === 'processes' || low.includes('what is using the most ram') || low.includes('top processes')) {
      fetchProcesses();
      setActiveModal('processes');
      addJarvisLog('Displaying top active processes by memory utilization, sir.');
      return;
    }

    if (low === 'windows' || low === 'power') {
      setActiveModal('windows');
      addJarvisLog('Opening Windows power controls, sir.');
      return;
    }

    if (low === 'clip' || low === 'clipboard') {
      fetchClipboard();
      return;
    }

    if (low.startsWith('note ')) {
      const noteContent = raw.slice(5).trim();
      const updated = (notes ? notes + '\n' : '') + noteContent;
      handleNotesChange(updated);
      const msg = `Appended to scratchpad notes, sir.`;
      addJarvisLog(msg);
      if (voxEnabled) speak(msg);
      return;
    }

    // 2. Send to AI Orchestration Backend
    setProcessingState('ANALYZING');
    setHudStatus('ANALYZING INTENT...');

    const processingId = Math.random().toString(36).substring(2, 9);
    setConsoleLogs((prev) => [
      ...prev,
      {
        id: processingId,
        sender: 'jarvis',
        text: 'Analyzing request and evaluating local tool security, sir...',
        timestamp: new Date().toLocaleTimeString([], { hour12: false }),
        isProcessing: true,
      },
    ]);

    try {
      const response = await fetch(`${backendEndpoint}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: raw,
          history: consoleLogs.slice(-6).map((l) => ({
            role: l.sender === 'user' ? 'user' : 'assistant',
            content: l.text,
          })),
        }),
      });

      setConsoleLogs((prev) => prev.filter((l) => l.id !== processingId));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const reply = data.response || 'Action processed, sir.';

      if (data.offline) {
        setNeuralLinkOnline(false);
      } else {
        setNeuralLinkOnline(true);
      }

      if (data.requires_confirmation) {
        setProcessingState('WAITING FOR CONFIRMATION');
        setPendingConfirm(data.requires_confirmation);
      } else {
        setProcessingState('COMPLETED');
        setTimeout(() => setProcessingState('IDLE'), 3000);
      }

      addJarvisLog(reply, data.action, data.operation_id);
      if (voxEnabled) speak(reply);
    } catch (err: any) {
      setConsoleLogs((prev) => prev.filter((l) => l.id !== processingId));
      setProcessingState('ERROR');
      setNeuralLinkOnline(false);
      const failMsg = `Neural connection timed out or unreachable (${err.message}). Local systems remain active, sir.`;
      addJarvisLog(failMsg);
      if (voxEnabled) speak(failMsg);
      setTimeout(() => setProcessingState('IDLE'), 3500);
    }
  };

  // Confirmation handling
  const handleConfirmAction = async (approved: boolean) => {
    if (!pendingConfirm) return;
    const cid = pendingConfirm.confirmation_id;
    setPendingConfirm(null);
    setProcessingState('EXECUTING');

    try {
      const res = await fetch(`${backendEndpoint}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation_id: cid, approved }),
      });
      const data = await res.json();
      const msg = data.message || (approved ? 'Execution confirmed, sir.' : 'Execution cancelled, sir.');
      setProcessingState('COMPLETED');
      addJarvisLog(msg);
      if (voxEnabled) speak(msg);
    } catch {
      setProcessingState('ERROR');
      addJarvisLog('Confirmation communication failed, sir.');
    } finally {
      setTimeout(() => setProcessingState('IDLE'), 2500);
    }
  };

  // File explorer fetch
  const fetchFolderFiles = async (folderName: string) => {
    setCurrentFolder(folderName);
    try {
      const res = await fetch(`${backendEndpoint}/files?folder=${encodeURIComponent(folderName)}`);
      const data = await res.json();
      if (data.success && data.items) {
        setFileList(data.items);
      } else {
        setFileList([]);
      }
    } catch {
      setFileList([]);
    }
  };

  // Search files
  const searchFiles = async () => {
    if (!fileSearchQuery.trim()) {
      fetchFolderFiles(currentFolder);
      return;
    }
    try {
      const res = await fetch(
        `${backendEndpoint}/files/search?folder=${encodeURIComponent(
          currentFolder
        )}&q=${encodeURIComponent(fileSearchQuery)}`
      );
      const data = await res.json();
      if (data.success && data.matches) {
        setFileList(
          data.matches.map((m: any) => ({
            name: m.name,
            type: 'file',
            size_bytes: m.size_bytes,
            size_display: `${(m.size_bytes / 1024).toFixed(1)} KB`,
            modified: m.modified,
            path: m.relative_path,
          }))
        );
      }
    } catch {}
  };

  // View specific file
  const handleViewFile = async (filePath: string) => {
    try {
      const res = await fetch(`${backendEndpoint}/files/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedFileContent({
          name: data.filename,
          content: data.content,
          size: data.size_bytes,
        });
        setActiveModal('viewFile');
      } else {
        addJarvisLog(`Could not read file: ${data.error || 'unknown error'}`);
      }
    } catch (e: any) {
      addJarvisLog(`Failed to load file contents: ${e.message}`);
    }
  };

  // Processes fetch
  const fetchProcesses = async () => {
    try {
      const res = await fetch(`${backendEndpoint}/processes?limit=15`);
      const data = await res.json();
      if (data.success && data.top_processes) {
        setProcessList(data.top_processes);
      }
    } catch {}
  };

  // Clipboard fetch
  const fetchClipboard = async () => {
    try {
      const res = await fetch(`${backendEndpoint}/clipboard`);
      const data = await res.json();
      const txt = data.text || '';
      setClipboardText(txt);
      addJarvisLog(
        txt ? `Clipboard contains:\n"${txt}"` : 'Clipboard is currently empty, sir.'
      );
    } catch {}
  };

  // Quick App Launch
  const handleLaunchApp = async (appKey: string) => {
    try {
      const res = await fetch(`${backendEndpoint}/apps/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: appKey }),
      });
      const data = await res.json();
      if (data.success) {
        const msg = data.message || `Launched ${appKey}, sir.`;
        addJarvisLog(msg);
        if (voxEnabled) speak(msg);
      } else {
        addJarvisLog(`Launch error: ${data.error}`);
      }
    } catch {
      addJarvisLog(`Application dispatch command failed, sir.`);
    }
    setActiveModal('none');
  };

  // Windows Power Operations
  const handleWindowsPower = async (action: 'lock' | 'shutdown' | 'restart' | 'sleep') => {
    try {
      const res = await fetch(`${backendEndpoint}/windows/${action}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.requires_confirmation) {
        setPendingConfirm(data);
        setActiveModal('none');
      } else {
        addJarvisLog(data.message || `Dispatched ${action} sequence, sir.`);
      }
    } catch {}
  };

  // Terminal Automation Operations
  const fetchTerminalStatus = async () => {
    try {
      const res = await fetch(`${backendEndpoint}/terminal/status`);
      const data = await res.json();
      setTerminalStatus(data);
    } catch {
      setTerminalStatus({ alive: false });
    }
  };

  const handleLaunchCmd = async () => {
    try {
      const res = await fetch(`${backendEndpoint}/terminal/start`, { method: 'POST' });
      const data = await res.json();
      const msg = data.message || 'J.A.R.V.I.S. Command Console launched, sir.';
      addJarvisLog(msg, { tool: 'start_terminal_console', result: data });
      if (voxEnabled) speak(msg);
      fetchTerminalStatus();
    } catch {
      addJarvisLog('Failed to start Command Console, sir.');
    }
  };

  const handleCloseCmd = async () => {
    try {
      const res = await fetch(`${backendEndpoint}/terminal/close`, { method: 'POST' });
      const data = await res.json();
      const msg = data.message || 'Command Console closed, sir.';
      addJarvisLog(msg, { tool: 'close_terminal_console', result: data });
      if (voxEnabled) speak(msg);
      fetchTerminalStatus();
    } catch {
      addJarvisLog('Failed to close Command Console, sir.');
    }
  };

  const handleExecuteTerminalCommand = async (cmdStr: string) => {
    const clean = cmdStr.trim();
    if (!clean) return;
    setTerminalExecuting(true);
    try {
      const res = await fetch(`${backendEndpoint}/terminal/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: clean }),
      });
      const data = await res.json();
      if (data.success) {
        let msg = data.message || `Command '${clean}' visibly typed and executed in CMD, sir.`;
        addJarvisLog(msg, { tool: 'execute_terminal_command', args: { command: clean }, result: data });
        if (voxEnabled) speak(`Command executed in visible CMD, sir.`);
      } else {
        const errMsg = `Terminal execution error: ${data.error || 'Failed to inject keystrokes'}`;
        addJarvisLog(errMsg, { tool: 'execute_terminal_command', args: { command: clean }, result: data });
      }
      fetchTerminalStatus();
    } catch (e: any) {
      addJarvisLog(`Terminal dispatch error: ${e.message}`);
    } finally {
      setTerminalExecuting(false);
      setTerminalCmdInput('');
    }
  };

  // Keyboard Navigation for Console Input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand(inputVal);
    } else if (e.key === 'ArrowUp') {
      if (history.length > 0) {
        const nextIdx = histIndex === -1 ? history.length - 1 : Math.max(0, histIndex - 1);
        setHistIndex(nextIdx);
        setInputVal(history[nextIdx] || '');
      }
    } else if (e.key === 'ArrowDown') {
      if (histIndex !== -1) {
        const nextIdx = histIndex + 1;
        if (nextIdx >= history.length) {
          setHistIndex(-1);
          setInputVal('');
        } else {
          setHistIndex(nextIdx);
          setInputVal(history[nextIdx] || '');
        }
      }
    }
  };

  // Test Local Windows Connection at http://127.0.0.1:5000
  const testLocalWindowsServer = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/health', { method: 'GET' });
      if (res.ok) {
        setBackendEndpoint('http://127.0.0.1:5000/api');
        setIsLocalWindowsConnected(true);
        setNeuralLinkOnline(true);
        addJarvisLog('Connected directly to local Windows Python Agent on port 5000, sir.');
        if (voxEnabled) speak('Local Windows agent connected successfully, sir.');
      } else {
        throw new Error('Health check returned non-200');
      }
    } catch {
      setIsLocalWindowsConnected(false);
      addJarvisLog('Local Python server at 127.0.0.1:5000 not detected. Still using Cloud Gateway.');
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-[var(--bg)] text-[var(--text)] select-none">
      {/* 1. BOOT SEQUENCE OVERLAY */}
      {booting && (
        <div className="fixed inset-0 z-50 bg-[var(--bg)] p-8 font-mono text-[var(--accent)] flex flex-col justify-between overflow-hidden">
          <div className="space-y-2 max-w-3xl">
            <div className="text-xl tracking-widest font-bold border-b border-[var(--line)] pb-2 mb-4 flex items-center justify-between">
              <span>J.A.R.V.I.S. SYSTEM INITIALIZATION</span>
              <span className="text-xs text-[var(--dim)] animate-pulse">BOOT SEQUENCE V1.0.4</span>
            </div>
            {bootLog.map((line, idx) => (
              <div key={idx} className="text-sm tracking-wide flex items-center space-x-2">
                <span className="text-[var(--dim)] opacity-50">&gt;&gt;</span>
                <span>{line}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--line)] text-xs text-[var(--dim)]">
            <span>PRESS ANYWHERE TO SKIP BOOT ANIMATION</span>
            <button
              onClick={() => {
                setBootSkipped(true);
                setBooting(false);
                addJarvisLog(`Good ${getGreeting()}, sir. All systems are online.`);
              }}
              className="hud-button text-xs py-1 px-3"
            >
              SKIP INTRO
            </button>
          </div>
        </div>
      )}

      {/* TOP STATUS BAR (Adhering to Section 44) */}
      <header className="px-3 py-1.5 border-b border-[var(--line)] bg-[var(--panel)] flex flex-wrap items-center justify-between text-[11px] tracking-wider">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <span className="font-bold text-[var(--accent)] tracking-[0.2em]">J.A.R.V.I.S. OS</span>
          <span className="text-[var(--dim)] hidden sm:inline">|</span>

          {/* Core Status Badges */}
          <div className="flex items-center space-x-3 text-[10px]">
            <span className="flex items-center space-x-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
              <span className="text-[var(--dim)]">LOCAL CORE:</span>
              <span className="text-emerald-300 font-bold">ONLINE</span>
            </span>

            <span className="flex items-center space-x-1">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  neuralLinkOnline
                    ? 'bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]'
                    : 'bg-red-500 shadow-[0_0_6px_#ef4444]'
                }`}
              />
              <span className="text-[var(--dim)]">NEURAL LINK:</span>
              <span
                className={`font-bold ${
                  neuralLinkOnline ? 'text-[var(--accent)]' : 'text-red-400'
                }`}
              >
                {neuralLinkOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </span>

            <span className="hidden md:flex items-center space-x-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[var(--dim)]">FILESYSTEM:</span>
              <span className="text-emerald-300 font-bold">READY</span>
            </span>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center space-x-2">
          {/* Active Processing State Badge */}
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
              processingState === 'IDLE'
                ? 'border-[var(--line)] text-[var(--dim)]'
                : processingState === 'ERROR'
                ? 'border-red-500 text-red-300 bg-red-950/40 animate-pulse'
                : processingState === 'WAITING FOR CONFIRMATION'
                ? 'border-amber-500 text-amber-300 bg-amber-950/40 animate-pulse'
                : 'border-[var(--accent)] text-[var(--accent)] bg-[var(--line)] animate-pulse'
            }`}
          >
            STATE: {processingState}
          </span>

          <button
            onClick={() => setActiveModal('agent')}
            className="hud-button text-[10px] py-0.5 px-2 flex items-center space-x-1"
            title="Configure Local Windows Python Server"
          >
            <Monitor className="w-3 h-3 inline mr-1" />
            <span className="hidden md:inline">
              {isLocalWindowsConnected ? 'WINDOWS: 5000' : 'WINDOWS AGENT'}
            </span>
          </button>

          <button
            onClick={() => {
              const r = document.documentElement;
              const isDark = r.dataset.theme !== 'light';
              r.dataset.theme = isDark ? 'light' : 'dark';
            }}
            className="hud-button text-[10px] py-0.5 px-2"
            title="Toggle Day/Stealth Theme"
          >
            THEME
          </button>
        </div>
      </header>

      {/* MAIN THREE-COLUMN HUD LAYOUT */}
      <main className="flex-1 p-3 grid grid-cols-1 md:grid-cols-[280px_1fr_360px] gap-3 min-h-0 overflow-hidden">
        {/* ================= LEFT COLUMN ================= */}
        <div className="flex flex-col gap-3 min-h-0 overflow-y-auto">
          {/* CHRONOMETER */}
          <div className="hud-panel p-3">
            <h2 className="hud-title flex items-center justify-between">
              <span>CHRONOMETER</span>
              <Clock className="w-3 h-3 text-[var(--accent)]" />
            </h2>
            <div className="text-3xl font-bold tracking-wider text-[var(--accent)] font-mono">
              {timeStr}
            </div>
            <div className="text-xs text-[var(--dim)] tracking-wider mt-1 font-mono">
              {dateStr}
            </div>
          </div>

          {/* SYSTEM DIAGNOSTICS */}
          <div className="hud-panel p-3 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="hud-title mb-0 flex items-center space-x-1">
                <Cpu className="w-3 h-3 text-[var(--accent)]" />
                <span>SYSTEM DIAGNOSTICS</span>
              </h2>
              <button
                onClick={() => {
                  fetchProcesses();
                  setActiveModal('processes');
                }}
                className="hud-button text-[10px] py-0.5 px-1.5 opacity-90"
                title="View active processes"
              >
                PROCS
              </button>
            </div>

            {/* Core Load */}
            <div>
              <div className="flex justify-between text-xs text-[var(--dim)]">
                <span>CORE LOAD</span>
                <span className="text-[var(--accent)] font-mono">{systemStats.cpu.percent}%</span>
              </div>
              <div className="h-1.5 bg-[var(--line)] rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(5, systemStats.cpu.percent))}%` }}
                />
              </div>
            </div>

            {/* Memory */}
            <div>
              <div className="flex justify-between text-xs text-[var(--dim)]">
                <span>MEMORY</span>
                <span className="text-[var(--accent)] font-mono">{systemStats.memory.percent}%</span>
              </div>
              <div className="h-1.5 bg-[var(--line)] rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(5, systemStats.memory.percent))}%` }}
                />
              </div>
            </div>

            {/* Arc Output / Primary Storage */}
            <div>
              <div className="flex justify-between text-xs text-[var(--dim)]">
                <span>ARC OUTPUT (DISK)</span>
                <span className="text-[var(--accent)] font-mono">{systemStats.disk.percent}%</span>
              </div>
              <div className="h-1.5 bg-[var(--line)] rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(5, systemStats.disk.percent))}%` }}
                />
              </div>
            </div>

            {/* Network Throughput */}
            <div>
              <div className="flex justify-between text-xs text-[var(--dim)]">
                <span>NETWORK THROUGHPUT</span>
                <span className="text-[var(--accent)] font-mono">
                  {systemStats.network.mbps} Mb/s
                </span>
              </div>
              <div className="h-1.5 bg-[var(--line)] rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-700"
                  style={{
                    width: `${Math.min(100, Math.max(10, systemStats.network.mbps))}%`,
                  }}
                />
              </div>
            </div>

            {/* Battery / Power */}
            <div className="pt-1 border-t border-[var(--line)] text-xs text-[var(--dim)] flex items-center justify-between">
              <span>DEVICE POWER:</span>
              <span className="text-[var(--accent)] font-mono">
                {systemStats.battery.status_text}
              </span>
            </div>

            {/* GPU Telemetry */}
            <div className="text-[11px] text-[var(--dim)] flex items-center justify-between">
              <span>GPU TELEMETRY:</span>
              <span className="text-[var(--accent)] font-mono text-[10px]">
                {systemStats.gpu?.name || 'GPU: UNAVAILABLE'}
              </span>
            </div>

            {/* Quick Refresh Telemetry Button */}
            <button
              onClick={fetchTelemetry}
              className="hud-button text-[11px] py-1 flex items-center justify-center space-x-1.5 opacity-80 hover:opacity-100"
            >
              <RefreshCw className="w-3 h-3" />
              <span>SYNC TELEMETRY</span>
            </button>
          </div>

          {/* NOTES SCRATCHPAD */}
          <div className="hud-panel p-3 flex-1 flex flex-col min-h-[140px]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="hud-title mb-0 flex items-center space-x-1">
                <FileText className="w-3 h-3 inline text-[var(--accent)]" />
                <span>NOTES</span>
              </h2>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(notes);
                    setHudStatus('NOTES COPIED TO CLIPBOARD');
                  }}
                  title="Copy Notes"
                  className="text-[var(--dim)] hover:text-[var(--accent)] p-0.5"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleNotesChange('')}
                  title="Clear Notes"
                  className="text-[var(--dim)] hover:text-red-400 p-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Jot something down, sir... (Synced with SQLite database)"
              className="flex-1 w-full bg-transparent border border-[var(--line)] text-[var(--text)] text-xs font-mono p-2 rounded resize-none outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* ================= CENTER COLUMN (ARC REACTOR & CONTROLS) ================= */}
        <div className="hud-panel p-4 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(to_right,#12d6ff_1px,transparent_1px),linear-gradient(to_bottom,#12d6ff_1px,transparent_1px)] bg-[size:24px_24px]" />

          {/* ARC REACTOR SVG */}
          <div className="relative my-auto flex flex-col items-center">
            <svg
              id="reactor"
              viewBox="0 0 300 300"
              className="w-[min(42vh,100%)] max-w-[300px] aspect-square drop-shadow-[0_0_20px_var(--accent-glow)] transition-transform duration-500 hover:scale-105"
              aria-label="Arc reactor"
            >
              <g fill="none" stroke="var(--accent)">
                {/* Outer Ring */}
                <circle cx="150" cy="150" r="140" strokeOpacity=".3" strokeWidth="1.5" />

                {/* Counter-Clockwise Rotating Outer Stator */}
                <g className="spin">
                  <circle
                    cx="150"
                    cy="150"
                    r="125"
                    strokeWidth="3.5"
                    strokeDasharray="40 18 8 18"
                  />
                  <circle
                    cx="150"
                    cy="150"
                    r="115"
                    strokeWidth="1"
                    strokeDasharray="4 8"
                    strokeOpacity=".6"
                  />
                </g>

                {/* Clockwise Rotating Inner Ring */}
                <g className="spin2">
                  <circle cx="150" cy="150" r="100" strokeWidth="2.5" strokeDasharray="6 12" />
                  <circle cx="150" cy="150" r="88" strokeWidth="1" strokeDasharray="18 10 4 10" />
                </g>

                {/* Inner Static Containment Ring */}
                <circle cx="150" cy="150" r="72" strokeWidth="2.5" strokeOpacity=".85" />

                {/* Magnetic Coils / Field Guides */}
                <g strokeWidth="5" strokeOpacity=".9" strokeLinecap="round">
                  <path d="M150 82v-18M150 218v18M82 150H64M218 150h18M102 102L89 89M198 198l13 13M198 102l13-13M102 198L89 211" />
                </g>
              </g>

              {/* Pulsating Core */}
              <circle
                id="core"
                className="core-pulse"
                cx="150"
                cy="150"
                r="40"
                fill="var(--accent)"
                fillOpacity=".25"
                stroke="var(--accent)"
                strokeWidth="3"
              />
              <circle cx="150" cy="150" r="18" fill="var(--accent)" />
            </svg>

            {/* J.A.R.V.I.S. Title */}
            <div className="text-xl md:text-2xl font-black tracking-[0.45em] text-[var(--accent)] mt-3">
              J.A.R.V.I.S.
            </div>

            {/* Sub-status Indicator */}
            <div
              id="status"
              className="text-xs tracking-wider text-[var(--dim)] mt-1 max-w-sm truncate h-5 font-mono"
            >
              {hudStatus}
            </div>
          </div>

          {/* Quick HUD Navigation Buttons */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 w-full max-w-xl mt-auto pt-3 border-t border-[var(--line)]">
            <button onClick={() => executeCommand('time')} className="hud-button text-xs py-1.5">
              TIME
            </button>
            <button onClick={() => executeCommand('scan')} className="hud-button text-xs py-1.5">
              SCAN
            </button>
            <button
              onClick={() => {
                fetchTerminalStatus();
                setActiveModal('terminal');
              }}
              className="hud-button text-xs py-1.5 border-[var(--accent)] text-[var(--accent)] font-bold"
              title="Dedicated CMD Console"
            >
              CMD
            </button>
            <button onClick={() => setActiveModal('apps')} className="hud-button text-xs py-1.5">
              APPS
            </button>
            <button
              onClick={() => {
                fetchFolderFiles('desktop');
                setActiveModal('files');
              }}
              className="hud-button text-xs py-1.5"
            >
              FILES
            </button>
            <button onClick={() => setActiveModal('windows')} className="hud-button text-xs py-1.5">
              POWER
            </button>
            <button onClick={() => executeCommand('theme')} className="hud-button text-xs py-1.5">
              THEME
            </button>
            <button onClick={() => setActiveModal('help')} className="hud-button text-xs py-1.5">
              HELP
            </button>
          </div>
        </div>

        {/* ================= RIGHT COLUMN (COMMAND CONSOLE) ================= */}
        <div className="hud-panel p-3 flex flex-col min-h-0 relative">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-[var(--line)]">
            <div className="flex items-center space-x-2">
              <h2 className="hud-title mb-0 flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>COMMAND CONSOLE</span>
              </h2>
              <button
                onClick={() => {
                  fetchTerminalStatus();
                  setActiveModal('terminal');
                }}
                className="hud-button text-[9px] py-0.5 px-1.5 text-[var(--accent)]"
                title="Open CMD Automation Control"
              >
                CMD HUD
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchClipboard}
                className="text-[var(--dim)] hover:text-[var(--accent)]"
                title="Inspect Clipboard"
              >
                <Clipboard className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-[var(--dim)] font-mono">
                {consoleLogs.length} LOGS
              </span>
            </div>
          </div>

          {/* Message Log */}
          <div
            ref={logContainerRef}
            className="flex-1 overflow-y-auto space-y-3 font-mono text-xs pr-1 min-h-0"
          >
            {consoleLogs.length === 0 && (
              <div className="text-[var(--dim)] text-xs text-center py-10 opacity-60">
                Awaiting your command, sir.
                <br />
                Type or speak using the MIC button below.
              </div>
            )}

            {consoleLogs.map((log) => (
              <div key={log.id} className="leading-relaxed">
                {log.sender === 'user' ? (
                  <div className="text-[var(--dim)]">
                    <span className="text-[var(--accent)] font-bold">&gt;&gt; USER:</span> {log.text}
                  </div>
                ) : (
                  <div className="text-[var(--text)] pl-1 border-l-2 border-[var(--accent)] bg-[rgba(18,214,255,0.02)] p-1.5 rounded-r">
                    <div className="flex items-center justify-between text-[10px] text-[var(--dim)] mb-0.5">
                      <span className="font-bold text-[var(--accent)] flex items-center space-x-1">
                        <Sparkles className="w-2.5 h-2.5 inline" />
                        <span>JARVIS</span>
                      </span>
                      <div className="flex items-center space-x-2">
                        {log.operation_id && (
                          <span className="text-[9px] bg-[var(--line)] px-1 rounded text-[var(--accent)]">
                            {log.operation_id}
                          </span>
                        )}
                        <span>{log.timestamp}</span>
                      </div>
                    </div>

                    {log.isProcessing ? (
                      <div className="flex items-center space-x-2 text-[var(--accent)] py-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span className="italic">{log.text}</span>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{log.text}</div>
                    )}

                    {/* Tool execution badge if present */}
                    {log.action && (
                      <div className="mt-1.5 pt-1 border-t border-[var(--line)] flex items-center space-x-1.5 text-[10px] text-[var(--dim)]">
                        <span className="bg-[var(--line)] text-[var(--text)] px-1.5 py-0.5 rounded font-mono">
                          TOOL: {log.action.tool}
                        </span>
                        {log.action.result?.success !== false ? (
                          <span className="text-emerald-400 flex items-center">
                            <CheckCircle className="w-2.5 h-2.5 mr-0.5" /> SUCCESS
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center">
                            <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> REJECTED
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* DESTRUCTIVE ACTION CONFIRMATION BAR */}
          {pendingConfirm && (
            <div className="mt-2 p-2.5 bg-red-950/70 border border-red-500 rounded text-xs space-y-2 animate-pulse">
              <div className="flex items-center justify-between text-red-300 font-bold">
                <span className="flex items-center space-x-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span>CONFIRMATION REQUIRED</span>
                </span>
                {pendingConfirm.operation_id && (
                  <span className="text-[9px] text-red-400 font-mono">
                    {pendingConfirm.operation_id}
                  </span>
                )}
              </div>
              <div className="text-neutral-200">{pendingConfirm.prompt}</div>
              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => handleConfirmAction(true)}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1 rounded text-xs"
                >
                  CONFIRM EXECUTION
                </button>
                <button
                  onClick={() => handleConfirmAction(false)}
                  className="bg-neutral-700 hover:bg-neutral-600 text-white px-3 py-1 rounded text-xs"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}

          {/* Console Input Bar */}
          <div className="mt-3 pt-2 border-t border-[var(--line)] flex items-center gap-1.5">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={processingState === 'ANALYZING' || processingState === 'EXECUTING'}
              placeholder={
                processingState === 'ANALYZING'
                  ? 'Analyzing intent...'
                  : processingState === 'EXECUTING'
                  ? 'Executing local tool...'
                  : 'Type a command or query...'
              }
              className="hud-input flex-1 text-xs"
              autoComplete="off"
            />

            {/* MIC BUTTON */}
            <button
              onClick={toggleSpeechRecognition}
              className={`hud-button p-2 ${isListening ? 'active animate-pulse' : ''}`}
              title="Voice Input (Speech Recognition)"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* VOX BUTTON */}
            <button
              onClick={() => {
                const nextVox = !voxEnabled;
                setVoxEnabled(nextVox);
                const msg = `Voice responses ${nextVox ? 'activated' : 'deactivated'}, sir.`;
                addJarvisLog(msg);
                if (nextVox) speak(msg);
              }}
              className={`hud-button p-2 ${voxEnabled ? 'active' : ''}`}
              title="Voice Output (Speech Synthesis)"
            >
              {voxEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </main>

      {/* ================= MODALS & DRAWERS ================= */}

      {/* TOP PROCESSES MODAL */}
      {activeModal === 'processes' && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="hud-panel p-5 max-w-lg w-full bg-[var(--panel-solid)] space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
              <h3 className="hud-title mb-0 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-[var(--accent)]" />
                <span>ACTIVE WORKSTATION PROCESSES</span>
              </h3>
              <button
                onClick={() => setActiveModal('none')}
                className="text-[var(--dim)] hover:text-[var(--text)] text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[var(--dim)]">
              Read-only process monitoring via <code>psutil</code>. Sorted by memory consumption:
            </p>
            <div className="flex-1 overflow-y-auto space-y-1 font-mono text-xs">
              {processList.length === 0 ? (
                <div className="text-[var(--dim)] text-center py-6">Loading process metrics...</div>
              ) : (
                processList.map((p) => (
                  <div
                    key={p.pid}
                    className="flex items-center justify-between p-2 rounded hover:bg-[var(--line)]/30 border border-transparent hover:border-[var(--line)]"
                  >
                    <div className="flex items-center space-x-2 truncate max-w-[60%]">
                      <span className="text-[var(--dim)] text-[10px]">[{p.pid}]</span>
                      <span className="truncate text-[var(--text)] font-bold">{p.name}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-[11px]">
                      <span className="text-[var(--dim)]">CPU: {p.cpu_percent}%</span>
                      <span className="text-[var(--accent)] font-bold">RAM: {p.memory_percent}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="pt-2 border-t border-[var(--line)] flex justify-end">
              <button onClick={fetchProcesses} className="hud-button text-xs py-1 px-3">
                REFRESH PROCESSES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WINDOWS POWER SUBROUTINES MODAL */}
      {activeModal === 'windows' && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="hud-panel p-5 max-w-sm w-full bg-[var(--panel-solid)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
              <h3 className="hud-title mb-0 flex items-center space-x-2">
                <Power className="w-4 h-4 text-[var(--accent)]" />
                <span>WINDOWS POWER &amp; SECURITY</span>
              </h3>
              <button
                onClick={() => setActiveModal('none')}
                className="text-[var(--dim)] hover:text-[var(--text)] text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[var(--dim)]">
              Controlled system actions. Shutdown, reboot, and sleep require explicit confirmation:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => handleWindowsPower('lock')}
                className="hud-button p-3 flex flex-col items-center justify-center space-y-1"
              >
                <Lock className="w-4 h-4 text-[var(--accent)]" />
                <span>LOCK WORKSTATION</span>
              </button>
              <button
                onClick={() => handleWindowsPower('sleep')}
                className="hud-button p-3 flex flex-col items-center justify-center space-y-1"
              >
                <Clock className="w-4 h-4 text-amber-400" />
                <span>SLEEP COMPUTER</span>
              </button>
              <button
                onClick={() => handleWindowsPower('restart')}
                className="hud-button p-3 flex flex-col items-center justify-center space-y-1 text-amber-300 border-amber-400"
              >
                <RefreshCw className="w-4 h-4" />
                <span>RESTART (REBOOT)</span>
              </button>
              <button
                onClick={() => handleWindowsPower('shutdown')}
                className="hud-button p-3 flex flex-col items-center justify-center space-y-1 text-red-400 border-red-500"
              >
                <Power className="w-4 h-4" />
                <span>SHUT DOWN</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPS LAUNCHER MODAL */}
      {activeModal === 'apps' && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="hud-panel p-5 max-w-md w-full bg-[var(--panel-solid)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
              <h3 className="hud-title mb-0 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-[var(--accent)]" />
                <span>AUTHORIZED APPLICATION REGISTRY</span>
              </h3>
              <button
                onClick={() => setActiveModal('none')}
                className="text-[var(--dim)] hover:text-[var(--text)] text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[var(--dim)]">
              Authorized Windows applications launched safely without arbitrary command execution:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { key: 'chrome', label: 'Google Chrome' },
                { key: 'vscode', label: 'VS Code' },
                { key: 'notepad', label: 'Notepad' },
                { key: 'calculator', label: 'Calculator' },
                { key: 'explorer', label: 'File Explorer' },
                { key: 'terminal', label: 'Terminal / CMD' },
                { key: 'settings', label: 'Windows Settings' },
                { key: 'paint', label: 'Paint' },
                { key: 'spotify', label: 'Spotify' },
                { key: 'discord', label: 'Discord' },
              ].map((app) => (
                <button
                  key={app.key}
                  onClick={() => handleLaunchApp(app.key)}
                  className="hud-button text-left p-2.5 flex items-center justify-between"
                >
                  <span>{app.label}</span>
                  <ExternalLink className="w-3 h-3 text-[var(--dim)]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FILE SYSTEM EXPLORER MODAL */}
      {activeModal === 'files' && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="hud-panel p-5 max-w-2xl w-full bg-[var(--panel-solid)] space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
              <h3 className="hud-title mb-0 flex items-center space-x-2">
                <Folder className="w-4 h-4 text-[var(--accent)]" />
                <span>PERMITTED FILE SYSTEM SANDBOX</span>
              </h3>
              <button
                onClick={() => setActiveModal('none')}
                className="text-[var(--dim)] hover:text-[var(--text)] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Folder Tabs & Search */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-2">
              <div className="flex items-center space-x-2 text-xs">
                {['desktop', 'documents', 'downloads', 'sandbox'].map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setFileSearchQuery('');
                      fetchFolderFiles(f);
                    }}
                    className={`hud-button uppercase py-1 px-3 ${
                      currentFolder === f ? 'active' : ''
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  value={fileSearchQuery}
                  onChange={(e) => setFileSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchFiles()}
                  placeholder="Search files..."
                  className="hud-input text-[11px] py-1 px-2 w-32 sm:w-40"
                />
                <button onClick={searchFiles} className="hud-button p-1">
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* File List Table */}
            <div className="flex-1 overflow-y-auto min-h-[220px] text-xs font-mono space-y-1">
              {fileList.length === 0 ? (
                <div className="text-[var(--dim)] text-center py-10">
                  Folder is empty or contents are restricted.
                </div>
              ) : (
                fileList.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-2 rounded hover:bg-[var(--line)]/20 transition-colors"
                  >
                    <div className="flex items-center space-x-2 truncate max-w-[65%]">
                      {item.type === 'directory' ? (
                        <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-[var(--accent)] shrink-0" />
                      )}
                      <span className="truncate">{item.name}</span>
                    </div>

                    <div className="flex items-center space-x-3 text-[var(--dim)] shrink-0">
                      <span>{item.size_display}</span>
                      <span>{item.modified.split(' ')[0]}</span>
                      {item.type === 'file' && (
                        <button
                          onClick={() => handleViewFile(`${currentFolder}/${item.name}`)}
                          className="hud-button text-[10px] py-0.5 px-1.5"
                        >
                          VIEW
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* File Creation Prompt */}
            <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-xs text-[var(--dim)]">
              <span>Security Boundary: Traversal escapes (../) are actively blocked.</span>
              <button
                onClick={() => {
                  const fname = prompt('Enter new filename (e.g. project_plan.py):');
                  if (fname) {
                    const content = prompt('Enter initial file content:') || '';
                    fetch(`${backendEndpoint}/files/create`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ path: `${currentFolder}/${fname}`, content }),
                    }).then(() => fetchFolderFiles(currentFolder));
                  }
                }}
                className="hud-button text-xs py-1 px-3"
              >
                + NEW FILE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW FILE CONTENT MODAL */}
      {activeModal === 'viewFile' && selectedFileContent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="hud-panel p-5 max-w-2xl w-full bg-[var(--panel-solid)] space-y-3 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
              <h3 className="hud-title mb-0 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[var(--accent)]" />
                <span>{selectedFileContent.name}</span>
              </h3>
              <button
                onClick={() => setActiveModal('files')}
                className="text-[var(--dim)] hover:text-[var(--text)] text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <pre className="flex-1 overflow-auto bg-black/40 p-3 rounded font-mono text-xs text-emerald-300 border border-[var(--line)] max-h-[55vh]">
              {selectedFileContent.content}
            </pre>
            <div className="flex items-center justify-between text-xs text-[var(--dim)]">
              <span>Size: {selectedFileContent.size} bytes</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedFileContent.content);
                  setHudStatus('FILE CONTENT COPIED');
                }}
                className="hud-button text-xs py-1 px-3"
              >
                COPY TO CLIPBOARD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WINDOWS LOCAL PYTHON AGENT MODAL */}
      {activeModal === 'agent' && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="hud-panel p-5 max-w-xl w-full bg-[var(--panel-solid)] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
              <h3 className="hud-title mb-0 flex items-center space-x-2">
                <Monitor className="w-4 h-4 text-[var(--accent)]" />
                <span>LOCAL WINDOWS PYTHON INTEGRATION</span>
              </h3>
              <button
                onClick={() => setActiveModal('none')}
                className="text-[var(--dim)] hover:text-[var(--text)] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-[var(--text)] space-y-3 leading-relaxed font-mono">
              <p>
                To control your native Windows files, apps, and hardware directly on your PC,
                launch the local J.A.R.V.I.S. Python server:
              </p>

              <div className="bg-black/40 border border-[var(--line)] p-3 rounded text-[11px] text-[var(--accent)] space-y-1">
                <div className="text-[var(--dim)]"># 1. Double-click the launcher script:</div>
                <div className="font-bold text-emerald-300">run_jarvis.bat</div>
                <div className="text-[var(--dim)] mt-2"># Or manually start Flask:</div>
                <div>pip install -r requirements.txt</div>
                <div>python backend/server.py</div>
              </div>

              <div className="p-3 bg-[var(--line)]/20 border border-[var(--line)] rounded space-y-2">
                <div className="font-bold text-[var(--accent)] flex items-center justify-between">
                  <span>BACKEND CONNECTION STATUS</span>
                  <span
                    className={
                      isLocalWindowsConnected
                        ? 'text-emerald-400 font-bold'
                        : 'text-amber-400 font-bold'
                    }
                  >
                    {isLocalWindowsConnected
                      ? '● CONNECTED TO 127.0.0.1:5000'
                      : '○ CONNECTED TO CLOUD GATEWAY'}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--dim)]">
                  Active Endpoint: <code className="text-[var(--accent)]">{backendEndpoint}</code>
                </p>
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={testLocalWindowsServer}
                    className="hud-button text-xs py-1 px-3"
                  >
                    CONNECT TO LOCAL WINDOWS (127.0.0.1:5000)
                  </button>
                  <button
                    onClick={() => {
                      setBackendEndpoint('/api');
                      setIsLocalWindowsConnected(false);
                      addJarvisLog('Switched to Cloud Gateway, sir.');
                    }}
                    className="hud-button text-xs py-1 px-3"
                  >
                    USE CLOUD GATEWAY
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-[var(--dim)]">
                The Python server includes dynamic path resolution for your Windows user directory
                (<code>%USERPROFILE%\Desktop</code>, <code>Documents</code>, <code>Downloads</code>)
                with SQLite persistence in <code>data/jarvis.db</code>.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HELP MODAL */}
      {activeModal === 'help' && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="hud-panel p-5 max-w-lg w-full bg-[var(--panel-solid)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
              <h3 className="hud-title mb-0 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                <span>J.A.R.V.I.S. CAPABILITIES &amp; COMMANDS</span>
              </h3>
              <button
                onClick={() => setActiveModal('none')}
                className="text-[var(--dim)] hover:text-[var(--text)] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-3 font-mono">
              <div>
                <span className="text-[var(--accent)] font-bold">NATURAL LANGUAGE EXAMPLES:</span>
                <ul className="list-disc list-inside mt-1 space-y-1 text-[var(--dim)]">
                  <li>"Jarvis, what's on my desktop?"</li>
                  <li>"Create a file called project.py on my desktop."</li>
                  <li>"Read timetable.py."</li>
                  <li>"Open Visual Studio Code."</li>
                  <li>"What's using the most RAM?"</li>
                  <li>"What are my current system diagnostics?"</li>
                  <li>"Lock my computer."</li>
                </ul>
              </div>

              <div>
                <span className="text-[var(--accent)] font-bold">DIRECT HUD COMMANDS:</span>
                <div className="grid grid-cols-2 gap-1.5 mt-1 text-[var(--dim)]">
                  <div>
                    <code className="text-[var(--text)]">time</code> — Chronometer
                  </div>
                  <div>
                    <code className="text-[var(--text)]">scan</code> — Full Diagnostic
                  </div>
                  <div>
                    <code className="text-[var(--text)]">cmd</code> — Terminal Automation
                  </div>
                  <div>
                    <code className="text-[var(--text)]">apps</code> — App Registry
                  </div>
                  <div>
                    <code className="text-[var(--text)]">files</code> — Sandbox Explorer
                  </div>
                  <div>
                    <code className="text-[var(--text)]">processes</code> — Task Telemetry
                  </div>
                  <div>
                    <code className="text-[var(--text)]">windows</code> — Power Control
                  </div>
                  <div>
                    <code className="text-[var(--text)]">clip</code> — Clipboard Buffer
                  </div>
                  <div>
                    <code className="text-[var(--text)]">theme</code> — Day / Stealth
                  </div>
                  <div>
                    <code className="text-[var(--text)]">vox</code> — Voice Audio
                  </div>
                  <div>
                    <code className="text-[var(--text)]">note &lt;text&gt;</code> — Scratchpad
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED VISIBLE COMMAND CONSOLE MODAL */}
      {activeModal === 'terminal' && (
        <div className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="hud-panel p-5 max-w-xl w-full bg-[var(--panel-solid)] space-y-4 max-h-[85vh] flex flex-col font-mono">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
              <h3 className="hud-title mb-0 flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-[var(--accent)]" />
                <span>J.A.R.V.I.S. VISIBLE CMD AUTOMATION</span>
              </h3>
              <button
                onClick={() => setActiveModal('none')}
                className="text-[var(--dim)] hover:text-[var(--text)] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Console Status Overview */}
            <div className="bg-black/40 border border-[var(--line)] p-3 rounded space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--dim)]">CONSOLE WINDOW STATUS:</span>
                <span
                  className={
                    terminalStatus?.alive
                      ? 'text-emerald-400 font-bold flex items-center'
                      : 'text-amber-400 font-bold flex items-center'
                  }
                >
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                      terminalStatus?.alive ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-amber-400'
                    }`}
                  />
                  {terminalStatus?.alive ? 'ONLINE & VISIBLE' : 'STANDBY / CLOSED'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--dim)]">
                <span>WINDOW HANDLE (HWND):</span>
                <span className="text-[var(--accent)] font-bold">
                  {terminalStatus?.hwnd || 'NONE ACQUIRED'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--dim)]">
                <span>SESSION ID:</span>
                <span className="text-[var(--text)]">
                  {terminalStatus?.session_id || 'STANDBY'}
                </span>
              </div>
            </div>

            {/* Console Lifecycle Actions */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={handleLaunchCmd}
                className="hud-button p-2.5 flex items-center justify-center space-x-2 text-[var(--accent)] border-[var(--accent)] font-bold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>LAUNCH / FOCUS CMD</span>
              </button>
              <button
                onClick={handleCloseCmd}
                className="hud-button p-2.5 flex items-center justify-center space-x-2 text-rose-300 border-rose-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>CLOSE CMD WINDOW</span>
              </button>
            </div>

            {/* Live Command Injection Section */}
            <div className="border-t border-[var(--line)] pt-3 space-y-2">
              <div className="text-xs font-bold text-[var(--accent)] flex items-center justify-between">
                <span>PHYSICAL KEYSTROKE INJECTION</span>
                <span className="text-[10px] text-[var(--dim)] font-normal">
                  SendInput (Unicode) + Verified Focus
                </span>
              </div>
              <p className="text-[11px] text-[var(--dim)]">
                Keystrokes will be physically injected into the active CMD window and executed with ENTER:
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={terminalCmdInput}
                  onChange={(e) => setTerminalCmdInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleExecuteTerminalCommand(terminalCmdInput)}
                  placeholder="Enter command (e.g. dir, echo Hello Sir)..."
                  disabled={terminalExecuting}
                  className="hud-input flex-1 text-xs py-1.5 px-2"
                />
                <button
                  onClick={() => handleExecuteTerminalCommand(terminalCmdInput)}
                  disabled={terminalExecuting || !terminalCmdInput.trim()}
                  className="hud-button text-xs py-1.5 px-3 flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {terminalExecuting ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>INJECTING...</span>
                    </>
                  ) : (
                    <>
                      <Terminal className="w-3 h-3" />
                      <span>INJECT &amp; RUN</span>
                    </>
                  )}
                </button>
              </div>

              {/* Preset Diagnostic Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1 text-[10px]">
                <span className="text-[var(--dim)] self-center mr-1">QUICK TESTS:</span>
                {[
                  'dir',
                  'echo J.A.R.V.I.S. Core Online',
                  'whoami',
                  'ipconfig',
                  'python --version',
                  'cls',
                ].map((tc) => (
                  <button
                    key={tc}
                    onClick={() => handleExecuteTerminalCommand(tc)}
                    disabled={terminalExecuting}
                    className="hud-button text-[10px] py-0.5 px-2 font-mono"
                  >
                    {tc}
                  </button>
                ))}
              </div>
            </div>

            {/* Architecture Explanatory Note */}
            <div className="text-[10px] text-[var(--dim)] border-t border-[var(--line)] pt-2 leading-relaxed">
              <span className="text-[var(--accent)] font-bold">AUTOMATION ARCHITECTURE:</span> J.A.R.V.I.S.
              locates the dedicated CMD HWND, breaks Windows background lock via thread-attachment and
              ALT key cycling, verifies foreground focus, injects Unicode characters character-by-character,
              and presses ENTER. No simulated background subprocesses.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
