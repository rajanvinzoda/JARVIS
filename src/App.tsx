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
} from 'lucide-react';

interface LogMessage {
  id: string;
  sender: 'user' | 'jarvis';
  text: string;
  timestamp: string;
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
  network: { mbps: number; status: string };
  battery: { percent: number; status_text: string; charging?: boolean };
  os?: { platform: string; hostname?: string; uptime_seconds?: number };
}

interface PendingConfirmation {
  confirmation_id: string;
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
  });

  // Notes
  const [notes, setNotes] = useState('');

  // Status line & Console
  const [hudStatus, setHudStatus] = useState('ALL SYSTEMS NOMINAL');
  const [consoleLogs, setConsoleLogs] = useState<LogMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIndex, setHistIndex] = useState<number>(-1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Audio & Voice
  const [voxEnabled, setVoxEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Modals & Drawers
  const [activeModal, setActiveModal] = useState<
    'none' | 'apps' | 'files' | 'agent' | 'help' | 'viewFile'
  >('none');
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState('desktop');
  const [selectedFileContent, setSelectedFileContent] = useState<{
    name: string;
    content: string;
    size: number;
  } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);

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
    // Initial fetch from backend with localStorage fallback
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
    // Debounce backend save
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
      // Clean up markdown / symbols for smoother speech
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
    action?: { tool: string; args?: any; result?: any }
  ) => {
    const newLog: LogMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'jarvis',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
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

    // 1. Direct local commands
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
        'Direct commands: time, date, scan, theme, vox, clear, apps, files, note <text>, calc <expr>, search <query>, who are you. Or speak natural language queries.';
      addJarvisLog(msg);
      if (voxEnabled) speak('Displaying system capabilities and commands, sir.');
      return;
    }

    if (low === 'apps') {
      setActiveModal('apps');
      addJarvisLog('Opening application launcher registry, sir.');
      return;
    }

    if (low === 'files') {
      fetchFolderFiles('desktop');
      setActiveModal('files');
      addJarvisLog('Opening file system explorer, sir.');
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
    setIsProcessing(true);
    setHudStatus('PROCESSING, SIR...');

    // Add temporary processing log
    const processingId = Math.random().toString(36).substring(2, 9);
    setConsoleLogs((prev) => [
      ...prev,
      {
        id: processingId,
        sender: 'jarvis',
        text: 'Processing, sir...',
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

      // Remove the processing indicator
      setConsoleLogs((prev) => prev.filter((l) => l.id !== processingId));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const reply = data.response || 'Action processed, sir.';

      // Check if action requires explicit user confirmation
      if (data.requires_confirmation) {
        setPendingConfirm(data.requires_confirmation);
      }

      addJarvisLog(reply, data.action);
      if (voxEnabled) speak(reply);
    } catch (err: any) {
      setConsoleLogs((prev) => prev.filter((l) => l.id !== processingId));
      const failMsg = `Neural connection timed out or unreachable (${err.message}). Local systems remain active, sir.`;
      addJarvisLog(failMsg);
      if (voxEnabled) speak(failMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirmation handling
  const handleConfirmAction = async (approved: boolean) => {
    if (!pendingConfirm) return;
    const cid = pendingConfirm.confirmation_id;
    setPendingConfirm(null);

    try {
      const res = await fetch(`${backendEndpoint}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation_id: cid, approved }),
      });
      const data = await res.json();
      const msg = data.message || (approved ? 'Execution confirmed, sir.' : 'Execution cancelled, sir.');
      addJarvisLog(msg);
      if (voxEnabled) speak(msg);
    } catch {
      addJarvisLog('Confirmation communication failed, sir.');
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

      {/* TOP STATUS BAR */}
      <header className="px-4 py-2 border-b border-[var(--line)] bg-[var(--panel)] flex items-center justify-between text-xs tracking-wider">
        <div className="flex items-center space-x-3">
          <span className="font-bold text-[var(--accent)] tracking-[0.2em]">J.A.R.V.I.S. OS</span>
          <span className="text-[var(--dim)]">|</span>
          <span className="text-[var(--dim)] hidden sm:inline">WINDOWS DESKTOP KERNEL</span>
          <span className="text-[var(--dim)]">|</span>
          <div className="flex items-center space-x-1.5">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                isLocalWindowsConnected
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : 'bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]'
              }`}
            />
            <span className="text-xs text-[var(--dim)]">
              {isLocalWindowsConnected ? 'LOCAL WINDOWS AGENT (5000)' : 'CLOUD GATEWAY GATEWAY'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveModal('agent')}
            className="hud-button text-[11px] py-0.5 px-2 flex items-center space-x-1"
            title="Configure Local Windows Python Server"
          >
            <Monitor className="w-3.5 h-3.5 inline mr-1" />
            <span className="hidden md:inline">WINDOWS AGENT</span>
          </button>
          <button
            onClick={() => {
              const r = document.documentElement;
              const isDark = r.dataset.theme !== 'light';
              r.dataset.theme = isDark ? 'light' : 'dark';
            }}
            className="hud-button text-[11px] py-0.5 px-2"
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
            <h2 className="hud-title flex items-center justify-between">
              <span>SYSTEM DIAGNOSTICS</span>
              <Cpu className="w-3 h-3 text-[var(--accent)]" />
            </h2>

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
                <span>NETWORK</span>
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
              placeholder="Jot something down, sir... (Synced with AI memory)"
              className="flex-1 w-full bg-transparent border border-[var(--line)] text-[var(--text)] text-xs font-mono p-2 rounded resize-none outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* ================= CENTER COLUMN (ARC REACTOR & CONTROLS) ================= */}
        <div className="hud-panel p-4 flex flex-col items-center justify-center text-center relative overflow-hidden">
          {/* Subtle Cybernetic Grid Background */}
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
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full max-w-lg mt-auto pt-3 border-t border-[var(--line)]">
            <button onClick={() => executeCommand('time')} className="hud-button text-xs py-1.5">
              TIME
            </button>
            <button onClick={() => executeCommand('scan')} className="hud-button text-xs py-1.5">
              SCAN
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
            <h2 className="hud-title mb-0 flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>COMMAND CONSOLE</span>
            </h2>
            <div className="flex items-center space-x-1">
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
                      <span>{log.timestamp}</span>
                    </div>

                    {log.isProcessing ? (
                      <div className="flex items-center space-x-2 text-[var(--accent)] py-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span className="italic">Processing intent and tool execution, sir...</span>
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
              <div className="flex items-center space-x-2 text-red-300 font-bold">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span>CONFIRMATION REQUIRED</span>
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
              disabled={isProcessing}
              placeholder={isProcessing ? 'Processing...' : 'Type a command or query...'}
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
              Select an authorized Windows application to launch safely without arbitrary shell
              execution:
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
                <span>PERMITTED FILE SYSTEM ACCESS</span>
              </h3>
              <button
                onClick={() => setActiveModal('none')}
                className="text-[var(--dim)] hover:text-[var(--text)] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Folder Tabs */}
            <div className="flex items-center space-x-2 text-xs border-b border-[var(--line)] pb-2">
              {['desktop', 'documents', 'downloads', 'sandbox'].map((f) => (
                <button
                  key={f}
                  onClick={() => fetchFolderFiles(f)}
                  className={`hud-button uppercase py-1 px-3 ${
                    currentFolder === f ? 'active' : ''
                  }`}
                >
                  {f}
                </button>
              ))}
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
                    className="flex items-center justify-between p-2 rounded hover:bg-[var(--line)] transition-colors"
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
              <span>Security Rule: All paths are strictly validated to prevent traversal.</span>
              <button
                onClick={() => {
                  const fname = prompt('Enter new filename (e.g. project_plan.txt):');
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

            <div className="text-xs text-[var(--text)] space-y-3 leading-relaxed">
              <p>
                To control your native Windows files, applications, and system metrics directly
                from your desktop, run the J.A.R.V.I.S. Python backend on your PC:
              </p>

              <div className="bg-black/40 border border-[var(--line)] p-3 rounded font-mono text-[11px] text-[var(--accent)] space-y-1">
                <div className="text-[var(--dim)]"># 1. Install dependencies:</div>
                <div>pip install -r requirements.txt</div>
                <div className="text-[var(--dim)] mt-2"># 2. Run Python server on your PC:</div>
                <div>python backend/server.py</div>
                <div className="text-[var(--dim)] mt-2"># Or double-click:</div>
                <div>run_jarvis.bat</div>
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
                with complete path traversal prevention.
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
                  <li>"Create a file called notes.txt on my desktop."</li>
                  <li>"Read timetable.py."</li>
                  <li>"Open Visual Studio Code."</li>
                  <li>"What are my current system diagnostics?"</li>
                  <li>"Search Google for latest tech news."</li>
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
                    <code className="text-[var(--text)]">apps</code> — App Registry
                  </div>
                  <div>
                    <code className="text-[var(--text)]">files</code> — Explorer
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
                  <div>
                    <code className="text-[var(--text)]">clear</code> — Flush Console
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
