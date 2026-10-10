/**
 * J.A.R.V.I.S. OS Frontend HUD Engine
 * Pure vanilla JavaScript layer connecting to local Python Flask / Node API Gateway.
 */

const $ = id => document.getElementById(id);
const API_BASE = window.location.origin.includes(':5000') ? 'http://127.0.0.1:5000/api' : '/api';

let vox = false;
let currentConfirmationId = null;

// 1. Boot Animation
const bootLines = [
  "J.A.R.V.I.S. KERNEL 1.0 — INITIALIZING",
  "Loading arc reactor drivers... OK",
  "Calibrating repulsors and diagnostics... OK",
  "Mounting neural language interface layer... OK",
  "Connecting to local security supervisor... OK",
  "Welcome back, sir."
];

let bi = 0;
const bt = setInterval(() => {
  if (bi < bootLines.length) {
    $("boot").textContent += (bootLines[bi++] || "") + "\n";
  } else {
    clearInterval(bt);
    setTimeout(() => {
      $("boot").style.display = "none";
      const welcome = "Good " + greet() + ", sir. All systems are online. Type help or speak freely.";
      say(welcome);
    }, 400);
  }
}, 280);

function greet() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

// 2. Chronometer Tick
function tick() {
  const d = new Date();
  $("clock").textContent = d.toLocaleTimeString([], { hour12: false });
  $("date").textContent = d.toLocaleDateString([], {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  }).toUpperCase();
}
setInterval(tick, 1000);
tick();

// 3. Real Telemetry from Backend (Never simulated Math.random)
async function fetchTelemetry() {
  try {
    const res = await fetch(`${API_BASE}/system`);
    if (res.ok) {
      const data = await res.json();
      const cpu = data.cpu ? data.cpu.percent : 0;
      const mem = data.memory ? data.memory.percent : 0;
      const disk = data.disk ? data.disk.percent : 0;
      const net = data.network ? data.network.mbps : 0;

      $("v1").textContent = cpu + "%";
      $("b1").style.width = Math.min(100, Math.max(5, cpu)) + "%";

      $("v2").textContent = mem + "%";
      $("b2").style.width = Math.min(100, Math.max(5, mem)) + "%";

      $("v3").textContent = disk + "%";
      $("b3").style.width = Math.min(100, Math.max(5, disk)) + "%";

      $("v4").textContent = net + " Mb/s";
      $("b4").style.width = Math.min(100, Math.max(8, net)) + "%";

      if (data.battery) {
        $("bat").textContent = "DEVICE POWER: " + data.battery.status_text;
      }
      if (data.gpu) {
        $("gpu").textContent = "GPU: " + (data.gpu.name || "UNAVAILABLE");
      }
    }
  } catch (e) {
    // Backend offline / connecting
  }
}
let telemetryTimer = null;
let telemetryMs = 2500;

function setTelemetryInterval(ms) {
  telemetryMs = ms;
  if ($("int-label")) $("int-label").textContent = ms + "ms";
  if (telemetryTimer) clearInterval(telemetryTimer);
  telemetryTimer = setInterval(fetchTelemetry, telemetryMs);
  say("Telemetry refresh interval adjusted to " + ms + "ms, sir.");
}

telemetryTimer = setInterval(fetchTelemetry, telemetryMs);
fetchTelemetry();

// 4. Notes Persistence
fetch(`${API_BASE}/notes`)
  .then(r => r.json())
  .then(d => { if (d.notes) $("notes").value = d.notes; })
  .catch(() => {});

$("notes").addEventListener("input", () => {
  fetch(`${API_BASE}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes: $("notes").value })
  }).catch(() => {});
});

function clearNotes() {
  $("notes").value = "";
  $("notes").dispatchEvent(new Event("input"));
  say("Notes scratchpad cleared, sir.");
}

// 5. Console & Speech
function esc(s) {
  return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function print(cls, html) {
  const p = document.createElement("p");
  p.className = cls;
  p.innerHTML = html;
  $("log").appendChild(p);
  $("log").scrollTop = 1e9;
}

function say(t, opId) {
  print("j", "<b>JARVIS:</b> " + esc(t));
  $("status").textContent = t.toUpperCase().slice(0, 60);
  if (opId) $("op-id").textContent = opId;

  if (vox && window.speechSynthesis) {
    const clean = t.replace(/[*#`_\[\]()]/g, "").trim();
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.05;
    u.pitch = 0.95;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
}

// 6. Execution Engine
async function run(input) {
  const raw = input.trim();
  if (!raw) return;
  print("u", "<b>&gt;&gt; USER:</b> " + esc(raw));
  $("status").textContent = "PROCESSING, SIR...";

  const low = raw.toLowerCase().replace(/[?!.]+$/, "");

  // Direct local commands
  if (low === "theme") {
    const r = document.documentElement;
    const isDark = r.dataset.theme !== "light";
    r.dataset.theme = isDark ? "light" : "dark";
    return say("Theme switched to " + (isDark ? "daylight" : "stealth") + " mode, sir.");
  }
  if (low === "vox") {
    vox = !vox;
    $("vox").classList.toggle("on", vox);
    return say("Voice responses " + (vox ? "enabled" : "disabled") + ", sir.");
  }
  if (low === "clear") {
    $("log").innerHTML = "";
    $("status").textContent = "CONSOLE CLEARED";
    return;
  }
  if (low === "help") {
    return say("Available commands: time, date, scan, apps, files, cmd, theme, vox, clear, note <text>, calc <expr>, search <query>, or type 'run in cmd <command>' / speak freely.");
  }
  if (low === "cmd" || low === "open cmd" || low === "launch cmd") {
    try {
      const res = await fetch(`${API_BASE}/terminal/start`, { method: "POST" });
      const d = await res.json();
      return say(d.message || "Command Console launched, sir.");
    } catch (e) {
      return say("Failed to launch Command Console, sir.");
    }
  }
  if (low === "close cmd" || low === "exit cmd") {
    try {
      const res = await fetch(`${API_BASE}/terminal/close`, { method: "POST" });
      const d = await res.json();
      return say(d.message || "Command Console closed, sir.");
    } catch (e) {
      return say("Failed to close Command Console, sir.");
    }
  }

  // AI & Tool Backend Call
  if ($("reactor")) $("reactor").classList.add("processing");
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: raw })
    });

    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    if (data.requires_confirmation) {
      showConfirmation(data.requires_confirmation);
    }

    say(data.response || "Action processed, sir.", data.operation_id);
  } catch (err) {
    say("Neural uplink anomaly (" + err.message + "). Local systems remain operational, sir.");
  } finally {
    if ($("reactor")) $("reactor").classList.remove("processing");
  }
}

// 7. Confirmation System
function showConfirmation(req) {
  currentConfirmationId = req.confirmation_id;
  $("confirm-text").textContent = req.prompt || "Confirmation required for destructive action.";
  $("confirm-banner").classList.add("active");
}

async function submitConfirmation(approved) {
  if (!currentConfirmationId) return;
  const cid = currentConfirmationId;
  currentConfirmationId = null;
  $("confirm-banner").classList.remove("active");

  try {
    const res = await fetch(`${API_BASE}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation_id: cid, approved })
    });
    const d = await res.json();
    say(d.message || (approved ? "Confirmed, sir." : "Cancelled, sir."));
  } catch (e) {
    say("Confirmation failed, sir.");
  }
}

$("cmd").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    run($("cmd").value);
    $("cmd").value = "";
  }
});
$("vox").onclick = () => run("vox");

// 8. Voice Recognition
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
$("mic").onclick = () => {
  if (!SR) return say("Speech recognition is not supported in this browser, sir.");
  const r = new SR();
  r.lang = navigator.language || "en-US";
  $("mic").classList.add("on");
  $("status").textContent = "LISTENING...";
  r.onresult = e => run(e.results[0][0].transcript);
  r.onend = () => $("mic").classList.remove("on");
  r.onerror = () => $("mic").classList.remove("on");
  try { r.start(); } catch (x) { $("mic").classList.remove("on"); }
};
