#!/usr/bin/env python3
"""Pi system dashboard: temps, fan, CPU, memory, disk, Pi info, services."""
import json
import os
import platform
import subprocess
import threading
import time
import socket
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 9090
HWMON_FAN = "/sys/class/hwmon/hwmon3"
COOLING = "/sys/class/thermal/cooling_device0"
HWMON_CPU_TEMP = "/sys/class/hwmon/hwmon0/temp1_input"
HWMON_NVME_TEMP = "/sys/class/hwmon/hwmon1/temp1_input"

# Services to health-check. Add entries as ArgentOS grows.
# Use "url" for HTTP probes or "systemd" for unit checks.
# Each service entry:
#   name   — display label
#   type   — badge label (API / WS / Web / Service)
#   url    — optional: HTTP health probe
#   tcp    — optional: (host, port) TCP-connect probe
#   unit   — optional: systemd unit name. If present, dashboard shows
#            start/stop/restart buttons and queries ActiveState via
#            _unit_cmd(..., _unit_scope(unit)). Auto-detects scope per unit.
SERVICES = [
    {"name": "argent-lite",     "type": "Service", "unit": "argent-lite.service",     "tcp": None},
    {"name": "argent-gateway",  "type": "WS",      "unit": "argent-gateway.service",  "tcp": ("127.0.0.1", 18789)},
    {"name": "argentos-desktop","type": "Web",     "tcp": ("127.0.0.1", 8080)},
    {"name": "argentos-core",   "type": "API",     "url": "http://127.0.0.1:8000/health"},
    {"name": "ollama",          "type": "API",     "url": "http://127.0.0.1:11434/"},
    {"name": "argent-lite-ui",  "type": "Web",     "unit": "argent-lite-ui.service",  "tcp": ("127.0.0.1", 7787)},
    {"name": "argent-kiosk",    "type": "Web",     "unit": "argent-lite-kiosk.service","tcp": ("127.0.0.1", 7788)},
    {"name": "pi-dashboard",    "type": "Service", "unit": "pi-dashboard.service",    "tcp": ("127.0.0.1", 9090)},
]

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# Argent Lite + ArgentOS Gateway systemd unit control. Dev: user unit under
# jason; prod: system unit. Scope auto-detects at boot per unit name.
ARGENT_LITE_UNIT = "argent-lite.service"
ARGENT_GATEWAY_UNIT = "argent-gateway.service"
ARGENT_LITE_USER = "jason"
ARGENT_LITE_UID = "1000"


def _unit_scope(unit_name):
    """Return 'system' if a system unit exists for this name, else 'user'."""
    try:
        r = subprocess.run(
            ["systemctl", "list-unit-files", unit_name],
            capture_output=True, text=True, timeout=5,
        )
        if r.returncode == 0 and unit_name in r.stdout:
            return "system"
    except Exception:
        pass
    return "user"


ARGENT_LITE_SCOPE = _unit_scope(ARGENT_LITE_UNIT)
ARGENT_GATEWAY_SCOPE = _unit_scope(ARGENT_GATEWAY_UNIT)


def _unit_cmd(action, unit_name, scope):
    """Build a systemctl argv for the detected scope. Works from root."""
    if scope == "system":
        return ["systemctl", action, unit_name]
    return [
        "sudo", "-u", ARGENT_LITE_USER, "-E",
        "env",
        f"XDG_RUNTIME_DIR=/run/user/{ARGENT_LITE_UID}",
        f"DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/{ARGENT_LITE_UID}/bus",
        "systemctl", "--user", action, unit_name,
    ]


def _argent_lite_cmd(action):
    return _unit_cmd(action, ARGENT_LITE_UNIT, ARGENT_LITE_SCOPE)


def _argent_gateway_cmd(action):
    return _unit_cmd(action, ARGENT_GATEWAY_UNIT, ARGENT_GATEWAY_SCOPE)


def argent_lite_status():
    """Return {active, sub, pid, uptime_s} for the argent-lite unit."""
    try:
        argv = _argent_lite_cmd("show")
        # Replace the action verb for show — need property args
        argv[argv.index("show")] = "show"
        argv += ["-p", "ActiveState", "-p", "SubState", "-p", "MainPID",
                 "-p", "ExecMainStartTimestampMonotonic"]
        r = subprocess.run(argv, capture_output=True, text=True, timeout=5)
        if r.returncode != 0:
            return {"active": "unknown", "sub": "error", "pid": 0,
                    "uptime_s": 0, "scope": ARGENT_LITE_SCOPE,
                    "unit": ARGENT_LITE_UNIT, "error": r.stderr.strip()[:200]}
        props = {}
        for line in r.stdout.splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                props[k] = v
        pid = int(props.get("MainPID", "0") or "0")
        uptime_s = 0
        if pid > 0:
            try:
                with open(f"/proc/{pid}/stat") as f:
                    start_ticks = int(f.read().split()[21])
                with open("/proc/uptime") as f:
                    sys_uptime = float(f.read().split()[0])
                hz = os.sysconf("SC_CLK_TCK")
                uptime_s = int(sys_uptime - start_ticks / hz)
            except Exception:
                pass
        return {
            "active": props.get("ActiveState", "unknown"),
            "sub": props.get("SubState", "unknown"),
            "pid": pid,
            "uptime_s": uptime_s,
            "scope": ARGENT_LITE_SCOPE,
            "unit": ARGENT_LITE_UNIT,
        }
    except Exception as e:
        return {"active": "error", "sub": "error", "pid": 0, "uptime_s": 0,
                "scope": ARGENT_LITE_SCOPE, "unit": ARGENT_LITE_UNIT,
                "error": str(e)[:200]}


def argent_lite_action(action):
    """start | stop | restart the argent-lite unit. Returns {ok, code, stderr}."""
    if action not in ("start", "stop", "restart"):
        return {"ok": False, "error": "invalid action"}
    try:
        argv = _argent_lite_cmd(action)
        r = subprocess.run(argv, capture_output=True, text=True, timeout=15)
        return {
            "ok": r.returncode == 0,
            "code": r.returncode,
            "stderr": r.stderr.strip()[:400],
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout"}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


def argent_gateway_status():
    """Return gateway unit state + port-alive flag."""
    status = {"active": "unknown", "sub": "unknown", "pid": 0,
              "scope": ARGENT_GATEWAY_SCOPE, "unit": ARGENT_GATEWAY_UNIT,
              "port_listening": False}
    try:
        argv = _argent_gateway_cmd("show")
        argv[argv.index("show")] = "show"
        argv += ["-p", "ActiveState", "-p", "SubState", "-p", "MainPID"]
        r = subprocess.run(argv, capture_output=True, text=True, timeout=5)
        if r.returncode == 0:
            props = {}
            for line in r.stdout.splitlines():
                if "=" in line:
                    k, v = line.split("=", 1)
                    props[k] = v
            status["active"] = props.get("ActiveState", "unknown")
            status["sub"] = props.get("SubState", "unknown")
            status["pid"] = int(props.get("MainPID", "0") or "0")
    except Exception as e:
        status["error"] = str(e)[:200]
    # TCP probe on 18789 regardless of unit state (may be running outside systemd)
    try:
        with socket.create_connection(("127.0.0.1", 18789), timeout=0.5):
            status["port_listening"] = True
    except Exception:
        pass
    return status


def argent_gateway_action(action):
    """start | stop | restart the gateway unit."""
    if action not in ("start", "stop", "restart"):
        return {"ok": False, "error": "invalid action"}
    try:
        argv = _argent_gateway_cmd(action)
        r = subprocess.run(argv, capture_output=True, text=True, timeout=30)
        return {
            "ok": r.returncode == 0,
            "code": r.returncode,
            "stderr": r.stderr.strip()[:400],
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout"}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


# ── Generic systemd control for any SERVICES entry ─────────────────────────
_UNIT_NAME_RE = __import__("re").compile(r"^[A-Za-z0-9@\-_.]+\.service$")


def _find_service(name):
    for svc in SERVICES:
        if svc.get("name") == name:
            return svc
    return None


def generic_service_status(name):
    """Return {active, sub, pid, scope, unit, port_listening} for one SERVICES entry."""
    svc = _find_service(name)
    if not svc:
        return {"error": "unknown service"}
    unit = svc.get("unit")
    result = {
        "name": name,
        "unit": unit,
        "scope": None,
        "active": None,
        "sub": None,
        "pid": 0,
        "port_listening": None,
    }
    if unit:
        scope = _unit_scope(unit)
        result["scope"] = scope
        try:
            argv = _unit_cmd("show", unit, scope)
            argv += ["-p", "ActiveState", "-p", "SubState", "-p", "MainPID"]
            r = subprocess.run(argv, capture_output=True, text=True, timeout=5)
            if r.returncode == 0:
                props = {}
                for line in r.stdout.splitlines():
                    if "=" in line:
                        k, v = line.split("=", 1)
                        props[k] = v
                result["active"] = props.get("ActiveState")
                result["sub"] = props.get("SubState")
                result["pid"] = int(props.get("MainPID", "0") or "0")
        except Exception as e:
            result["error"] = str(e)[:200]
    tcp = svc.get("tcp")
    if tcp:
        try:
            with socket.create_connection(tcp, timeout=0.5):
                result["port_listening"] = True
        except Exception:
            result["port_listening"] = False
    return result


def generic_service_action(name, action):
    """start | stop | restart for any SERVICES entry that has a `unit` field."""
    if action not in ("start", "stop", "restart"):
        return {"ok": False, "error": "invalid action"}
    svc = _find_service(name)
    if not svc:
        return {"ok": False, "error": "unknown service"}
    unit = svc.get("unit")
    if not unit:
        return {"ok": False, "error": "service has no unit — not controllable"}
    if not _UNIT_NAME_RE.match(unit):
        return {"ok": False, "error": "bad unit name"}
    scope = _unit_scope(unit)
    try:
        argv = _unit_cmd(action, unit, scope)
        r = subprocess.run(argv, capture_output=True, text=True, timeout=30)
        return {
            "ok": r.returncode == 0,
            "code": r.returncode,
            "stderr": r.stderr.strip()[:400],
            "scope": scope,
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout"}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


def read(path, default=None):
    try:
        with open(path) as f:
            return f.read().strip()
    except OSError:
        return default


def write(path, value):
    with open(path, "w") as f:
        f.write(str(value))


_prev_cpu = None


def cpu_usage():
    global _prev_cpu
    with open("/proc/stat") as f:
        parts = f.readline().split()[1:]
    vals = [int(x) for x in parts]
    idle = vals[3] + vals[4]
    total = sum(vals)
    pct = 0.0
    if _prev_cpu is not None:
        dt = total - _prev_cpu[0]
        di = idle - _prev_cpu[1]
        if dt > 0:
            pct = (1 - di / dt) * 100
    _prev_cpu = (total, idle)
    return round(pct, 1)


def meminfo():
    info = {}
    with open("/proc/meminfo") as f:
        for line in f:
            k, v = line.split(":", 1)
            info[k] = int(v.strip().split()[0])
    total = info["MemTotal"]
    avail = info.get("MemAvailable", info["MemFree"])
    used = total - avail
    return {
        "total_mb": round(total / 1024),
        "used_mb": round(used / 1024),
        "pct": round(used / total * 100, 1),
    }


def diskinfo(path="/"):
    s = os.statvfs(path)
    total = s.f_blocks * s.f_frsize
    free = s.f_bavail * s.f_frsize
    used = total - free
    return {
        "total_gb": round(total / 1e9, 1),
        "used_gb": round(used / 1e9, 1),
        "pct": round(used / total * 100, 1),
    }


def loadavg():
    with open("/proc/loadavg") as f:
        a, b, c = f.read().split()[:3]
    return [float(a), float(b), float(c)]


def uptime():
    with open("/proc/uptime") as f:
        s = float(f.read().split()[0])
    d, r = divmod(int(s), 86400)
    h, r = divmod(r, 3600)
    m, _ = divmod(r, 60)
    return f"{d}d {h}h {m}m"


def temp_c(path):
    v = read(path)
    return round(int(v) / 1000, 1) if v else None


def os_release():
    out = {}
    try:
        with open("/etc/os-release") as f:
            for line in f:
                if "=" in line:
                    k, v = line.rstrip().split("=", 1)
                    out[k] = v.strip('"')
    except OSError:
        pass
    return out


def pi_model():
    try:
        with open("/proc/device-tree/model") as f:
            return f.read().strip("\x00 \n")
    except OSError:
        return platform.machine()


def firmware_version():
    try:
        r = subprocess.run(["vcgencmd", "version"], capture_output=True, text=True, timeout=1)
        for line in r.stdout.splitlines():
            if "version" in line.lower() or "copyright" not in line.lower():
                return line.strip()
    except Exception:
        pass
    return None


# --- Slow / cached data ------------------------------------------------------

STATIC_INFO = {}
UPDATES = {"count": None, "security": None, "checked_at": 0, "checking": False}


def load_static():
    rel = os_release()
    STATIC_INFO.update({
        "model": pi_model(),
        "os": rel.get("PRETTY_NAME", "unknown"),
        "os_version": rel.get("VERSION_ID", ""),
        "kernel": platform.release(),
        "arch": platform.machine(),
        "python": platform.python_version(),
        "hostname": platform.node(),
        "firmware": firmware_version(),
    })


def refresh_updates():
    if UPDATES["checking"]:
        return
    UPDATES["checking"] = True
    try:
        r = subprocess.run(
            ["apt", "list", "--upgradable"],
            capture_output=True, text=True, timeout=30,
            env={**os.environ, "LC_ALL": "C"},
        )
        lines = [l for l in r.stdout.splitlines() if "/" in l and "Listing" not in l]
        UPDATES["count"] = len(lines)
        UPDATES["security"] = sum(1 for l in lines if "-security" in l)
        UPDATES["checked_at"] = int(time.time())
    except Exception:
        UPDATES["count"] = None
    finally:
        UPDATES["checking"] = False


def updates_loop():
    while True:
        refresh_updates()
        time.sleep(900)  # every 15 min


def probe_services():
    results = []
    for svc in SERVICES:
        status = "down"
        detail = ""
        unit = svc.get("unit")
        scope = _unit_scope(unit) if unit else None
        t0 = time.time()
        try:
            # 1. If there's a URL or TCP probe, that's the live-traffic source
            #    of truth — a listening port is a better signal than systemd
            #    state for "is this service actually serving requests".
            if svc.get("url"):
                req = urllib.request.Request(svc["url"])
                with urllib.request.urlopen(req, timeout=0.8) as r:
                    status = "up" if 200 <= r.status < 400 else "degraded"
                    detail = f"HTTP {r.status}"
            elif svc.get("tcp"):
                host, port = svc["tcp"]
                with socket.create_connection((host, port), timeout=0.5):
                    status = "up"
                    detail = f"tcp {host}:{port}"
            elif unit:
                # No network probe available — fall back to systemctl is-active.
                argv = _unit_cmd("is-active", unit, scope)
                r = subprocess.run(argv, capture_output=True, text=True, timeout=2)
                out = r.stdout.strip()
                status = "up" if out == "active" else "down"
                detail = out or "unknown"
        except Exception as e:
            detail = type(e).__name__
            # If the port/URL probe failed but we have a unit, still try to
            # check it — helps distinguish "crashed" from "never installed".
            if unit and status == "down":
                try:
                    argv = _unit_cmd("is-active", unit, scope)
                    r = subprocess.run(argv, capture_output=True, text=True, timeout=2)
                    out = r.stdout.strip()
                    if out == "active":
                        detail = f"{detail} (active, port closed)"
                    elif out:
                        detail = f"{detail} ({out})"
                except Exception:
                    pass
        target = (
            svc.get("url")
            or (f"{svc['tcp'][0]}:{svc['tcp'][1]}" if svc.get("tcp") else None)
            or unit
            or ""
        )
        results.append({
            "name": svc["name"],
            "type": svc["type"],
            "status": status,
            "detail": detail,
            "ms": round((time.time() - t0) * 1000),
            "target": target,
            "unit": unit,
            "scope": scope,
        })
    return results


def gather():
    fan_rpm = read(f"{HWMON_FAN}/fan1_input")
    pwm = read(f"{HWMON_FAN}/pwm1")
    pwm_en = read(f"{HWMON_FAN}/pwm1_enable")
    return {
        "cpu_temp": temp_c(HWMON_CPU_TEMP),
        "nvme_temp": temp_c(HWMON_NVME_TEMP),
        "fan_rpm": int(fan_rpm) if fan_rpm else 0,
        "pwm": int(pwm) if pwm else 0,
        "pwm_pct": round(int(pwm) / 255 * 100) if pwm else 0,
        "pwm_enable": int(pwm_en) if pwm_en else 0,
        "cool_cur": int(read(f"{COOLING}/cur_state") or 0),
        "cool_max": int(read(f"{COOLING}/max_state") or 0),
        "cpu_pct": cpu_usage(),
        "mem": meminfo(),
        "disk": diskinfo("/"),
        "load": loadavg(),
        "uptime": uptime(),
        "info": STATIC_INFO,
        "updates": dict(UPDATES),
        "services": probe_services(),
        "argent_lite": argent_lite_status(),
        "argent_gateway": argent_gateway_status(),
        "ts": int(time.time()),
    }


# --- HTML --------------------------------------------------------------------

INDEX = r"""<!doctype html>
<html lang="en" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pi Dashboard</title>
<script src="/static/tailwind.js"></script>
<script>
 tailwind.config = { theme: { extend: {
  fontFamily: { sans: ['ui-sans-serif','system-ui','sans-serif'], mono: ['ui-monospace','SFMono-Regular','Menlo','monospace'] },
  colors: { border:'hsl(220 20% 20% / .6)', accent:'hsl(174 72% 56%)' },
 }}}
</script>
<style>
 html,body{background:#05070d;color:#e6edf7;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}
 body{
  background:
   radial-gradient(900px 600px at 12% -10%, rgba(56,189,248,.18), transparent 60%),
   radial-gradient(800px 600px at 95% 10%, rgba(168,85,247,.18), transparent 60%),
   radial-gradient(700px 500px at 50% 110%, rgba(16,185,129,.14), transparent 60%),
   #05070d;
  min-height:100vh;
 }
 .glass{
  background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.015));
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  border: 1px solid rgba(255,255,255,.08);
  box-shadow: 0 1px 0 rgba(255,255,255,.05) inset, 0 20px 60px -20px rgba(0,0,0,.6);
  border-radius: 18px;
 }
 .glass:hover{border-color:rgba(255,255,255,.14);}
 .chip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:500;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);}
 .dot{width:7px;height:7px;border-radius:999px;display:inline-block;box-shadow:0 0 10px currentColor;}
 .lbl{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8a96ad;font-weight:500;}
 .val{font-size:30px;font-weight:600;line-height:1.1;letter-spacing:-.02em;}
 .sub{font-size:12px;color:#8a96ad;margin-top:4px;}
 .bar{height:6px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden;position:relative;}
 .bar>i{display:block;height:100%;border-radius:999px;
  background:linear-gradient(90deg,#22d3ee,#a855f7);transition:width .5s ease;}
 .bar.warm>i{background:linear-gradient(90deg,#fbbf24,#f97316);}
 .bar.hot>i{background:linear-gradient(90deg,#f97316,#ef4444);box-shadow:0 0 20px rgba(239,68,68,.5);}
 .btn{padding:7px 12px;border-radius:10px;font-size:12px;font-weight:500;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#e6edf7;
  transition:all .15s;cursor:pointer;display:inline-block;text-decoration:none;}
 a.btn{color:#e6edf7;}
 .btn:hover{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.2);}
 .btn-xs{padding:3px 7px;font-size:11px;border-radius:6px;line-height:1;}
 .btn-primary{background:linear-gradient(135deg,#22d3ee,#a855f7);border-color:transparent;}
 .btn-primary:hover{filter:brightness(1.1);}
 select,input[type=range]{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  color:#e6edf7;border-radius:10px;padding:6px 10px;font-size:12px;}
 input[type=range]{padding:0;height:6px;-webkit-appearance:none;}
 input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:999px;
  background:linear-gradient(135deg,#22d3ee,#a855f7);cursor:pointer;border:2px solid #05070d;}
 .k{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#c2cde0;}
 .status-up{color:#34d399;}
 .status-down{color:#f87171;}
 .status-degraded{color:#fbbf24;}
 @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
 .live{animation:pulse 2s ease-in-out infinite;}
</style>
</head>
<body class="p-5 md:p-8">
<header class="max-w-7xl mx-auto mb-6 flex items-center justify-between flex-wrap gap-3">
 <div>
  <h1 class="text-2xl md:text-3xl font-semibold tracking-tight">
   <span class="bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 bg-clip-text text-transparent">Argent</span>
   <span class="text-white/90">Pi Dashboard</span>
  </h1>
  <div class="sub mt-1"><span id="hdr_host">—</span> · <span id="hdr_model">—</span></div>
 </div>
 <div class="flex items-center gap-2 flex-wrap">
  <a id="btn_desktop" class="btn btn-primary" href="http://localhost:8080" target="_blank" rel="noopener"
     title="Open ArgentOS Desktop (React UI) at :8080">
   ArgentOS Desktop
  </a>
  <button class="btn" onclick="launchKiosk()" title="Kiosk Mode — ships cycle-21">
   Kiosk
  </button>
  <span class="chip"><span class="dot live" style="background:#34d399;color:#34d399;"></span>live</span>
  <span class="chip"><span class="k">updated</span> <span id="ts" class="k">—</span></span>
 </div>
</header>

<main class="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

 <div class="glass p-5">
  <div class="lbl">CPU Temp</div>
  <div class="val mt-2" id="cpu_temp">—</div>
  <div class="bar mt-3" id="cpu_temp_bar"><i style="width:0"></i></div>
 </div>

 <div class="glass p-5">
  <div class="lbl">NVMe Temp</div>
  <div class="val mt-2" id="nvme_temp">—</div>
  <div class="bar mt-3" id="nvme_temp_bar"><i style="width:0"></i></div>
 </div>

 <div class="glass p-5">
  <div class="lbl">CPU Usage</div>
  <div class="val mt-2" id="cpu_pct">—</div>
  <div class="sub" id="load">load —</div>
  <div class="bar mt-3" id="cpu_bar"><i style="width:0"></i></div>
 </div>

 <div class="glass p-5">
  <div class="lbl">Uptime</div>
  <div class="val mt-2" id="uptime">—</div>
  <div class="sub mt-1">kernel <span class="k" id="kernel">—</span></div>
 </div>

 <div class="glass p-5">
  <div class="lbl">Memory</div>
  <div class="val mt-2" id="mem">—</div>
  <div class="sub" id="mem_sub">—</div>
  <div class="bar mt-3" id="mem_bar"><i style="width:0"></i></div>
 </div>

 <div class="glass p-5">
  <div class="lbl">Disk /</div>
  <div class="val mt-2" id="disk">—</div>
  <div class="sub" id="disk_sub">—</div>
  <div class="bar mt-3" id="disk_bar"><i style="width:0"></i></div>
 </div>

 <div class="glass p-5 sm:col-span-2">
  <div class="flex items-center justify-between">
   <div class="lbl">Fan Control</div>
   <span class="chip"><span class="k" id="pwm_mode_chip">—</span></span>
  </div>
  <div class="val mt-2"><span id="fan_rpm">—</span> <span class="text-sm text-slate-400 font-normal">rpm</span></div>
  <div class="sub">pwm <span class="k" id="pwm">—</span>/255 · <span id="pwm_pct">—</span>%</div>
  <div class="bar mt-3" id="fan_bar"><i style="width:0"></i></div>
  <div class="mt-4 flex items-center gap-2">
   <input type="range" id="pwm_slider" min="0" max="255" value="255" class="flex-1">
   <span class="k w-10 text-right" id="slider_val">255</span>
   <button class="btn btn-primary" onclick="setPwm()">Set</button>
  </div>
  <div class="mt-2 flex flex-wrap gap-2">
   <button class="btn" onclick="setPwm(255)">Full</button>
   <button class="btn" onclick="setPwm(128)">50%</button>
   <button class="btn" onclick="setPwm(0)">Off</button>
   <button class="btn" onclick="setAuto()">Auto</button>
   <div class="ml-auto flex items-center gap-2">
    <span class="lbl">Cool Lvl</span>
    <select id="cool_sel"></select>
    <button class="btn" onclick="setCool()">Set</button>
   </div>
  </div>
 </div>

 <div class="glass p-5 sm:col-span-2">
  <div class="lbl">Pi Info</div>
  <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
   <dt class="text-slate-400">Model</dt><dd class="k truncate" id="i_model">—</dd>
   <dt class="text-slate-400">OS</dt><dd class="k truncate" id="i_os">—</dd>
   <dt class="text-slate-400">Kernel</dt><dd class="k truncate" id="i_kernel">—</dd>
   <dt class="text-slate-400">Arch</dt><dd class="k" id="i_arch">—</dd>
   <dt class="text-slate-400">Python</dt><dd class="k" id="i_python">—</dd>
   <dt class="text-slate-400">Host</dt><dd class="k truncate" id="i_host">—</dd>
  </dl>
 </div>

 <div class="glass p-5 sm:col-span-2">
  <div class="flex items-center justify-between">
   <div class="lbl">Update Alerts</div>
   <button class="btn" onclick="refreshUpdates()">Check</button>
  </div>
  <div class="val mt-2"><span id="upd_count">—</span> <span class="text-sm text-slate-400 font-normal">packages</span></div>
  <div class="sub"><span id="upd_sec">—</span> security · checked <span class="k" id="upd_at">—</span></div>
 </div>

 <div class="glass p-5 sm:col-span-2 lg:col-span-2">
  <div class="lbl">ArgentOS Services</div>
  <div id="svc_list" class="mt-3 space-y-2 text-sm">
   <div class="text-slate-500 text-xs">No services configured. Edit SERVICES in dashboard.py.</div>
  </div>
 </div>

 <div class="glass p-5 sm:col-span-2 lg:col-span-2">
  <div class="flex items-center justify-between">
   <div class="lbl">Argent Lite Runtime</div>
   <span class="k text-xs" id="al_scope">—</span>
  </div>
  <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
   <div class="text-slate-400">State</div>
   <div><span class="inline-block w-2 h-2 rounded-full mr-1 align-middle" id="al_dot" style="background:#64748b"></span><span class="k" id="al_state">unknown</span></div>
   <div class="text-slate-400">Unit</div>   <div class="k truncate" id="al_unit">—</div>
   <div class="text-slate-400">PID</div>    <div class="k" id="al_pid">—</div>
   <div class="text-slate-400">Uptime</div> <div class="k" id="al_uptime">—</div>
  </div>
  <div class="mt-4 flex flex-wrap gap-2">
   <button class="btn btn-primary" onclick="alAction('start')">Start</button>
   <button class="btn" onclick="alAction('stop')">Stop</button>
   <button class="btn" onclick="alAction('restart')">Restart</button>
  </div>
  <div class="mt-2 text-[11px] text-slate-500" id="al_msg">&nbsp;</div>

  <div class="mt-4 pt-4 border-t border-white/10">
   <div class="flex items-center justify-between">
    <div class="lbl">ArgentOS Gateway</div>
    <span class="k text-xs" id="gw_scope">—</span>
   </div>
   <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
    <div class="text-slate-400">State</div>
    <div><span class="inline-block w-2 h-2 rounded-full mr-1 align-middle" id="gw_dot" style="background:#64748b"></span><span class="k" id="gw_state">unknown</span></div>
    <div class="text-slate-400">Unit</div>   <div class="k truncate" id="gw_unit">—</div>
    <div class="text-slate-400">Port 18789</div> <div class="k" id="gw_port">—</div>
    <div class="text-slate-400">PID</div>    <div class="k" id="gw_pid">—</div>
   </div>
   <div class="mt-3 flex flex-wrap gap-2">
    <button class="btn btn-primary" onclick="gwAction('start')">Start</button>
    <button class="btn" onclick="gwAction('stop')">Stop</button>
    <button class="btn" onclick="gwAction('restart')">Restart</button>
   </div>
   <div class="mt-2 text-[11px] text-slate-500" id="gw_msg">&nbsp;</div>
  </div>
 </div>

 <!-- Launcher buttons moved into header; launch status messages hide here -->
 <div class="hidden"><span id="launch_msg"></span></div>

</main>

<footer class="max-w-7xl mx-auto mt-6 text-center text-[11px] text-slate-500">
 pi-dashboard · port 9090 · systemd unit <span class="k">pi-dashboard.service</span>
</footer>

<script>
const $ = id => document.getElementById(id);
function setBar(id, pct){
 const el = $(id); el.classList.remove('warm','hot');
 if(pct>=80) el.classList.add('hot');
 else if(pct>=60) el.classList.add('warm');
 el.firstElementChild.style.width = Math.max(0,Math.min(100,pct))+'%';
}
function fmtAgo(ts){
 if(!ts) return 'never';
 const d = Math.max(0, Math.floor(Date.now()/1000)-ts);
 if(d<60) return d+'s ago';
 if(d<3600) return Math.floor(d/60)+'m ago';
 return Math.floor(d/3600)+'h ago';
}
async function refresh(){
 let d;
 try { d = await (await fetch('/api/stats')).json(); } catch(e){ return; }
 $('hdr_host').textContent = d.info.hostname || '—';
 $('hdr_model').textContent = d.info.model || '—';
 $('cpu_temp').textContent = (d.cpu_temp ?? '—')+'°C';
 setBar('cpu_temp_bar', (d.cpu_temp||0)/85*100);
 $('nvme_temp').textContent = (d.nvme_temp ?? '—')+'°C';
 setBar('nvme_temp_bar', (d.nvme_temp||0)/85*100);
 $('cpu_pct').textContent = d.cpu_pct+'%';
 $('load').textContent = 'load '+d.load.join(' · ');
 setBar('cpu_bar', d.cpu_pct);
 $('mem').textContent = d.mem.pct+'%';
 $('mem_sub').textContent = d.mem.used_mb+' / '+d.mem.total_mb+' MB';
 setBar('mem_bar', d.mem.pct);
 $('disk').textContent = d.disk.pct+'%';
 $('disk_sub').textContent = d.disk.used_gb+' / '+d.disk.total_gb+' GB';
 setBar('disk_bar', d.disk.pct);
 $('uptime').textContent = d.uptime;
 $('kernel').textContent = d.info.kernel || '—';
 $('fan_rpm').textContent = d.fan_rpm;
 $('pwm').textContent = d.pwm;
 $('pwm_pct').textContent = d.pwm_pct;
 $('pwm_mode_chip').textContent = d.pwm_enable===1?'manual':'auto';
 setBar('fan_bar', d.pwm_pct);

 const sel = $('cool_sel');
 if(sel.options.length !== d.cool_max+1){
  sel.innerHTML='';
  for(let i=0;i<=d.cool_max;i++){
   const o=document.createElement('option'); o.value=i; o.text='Level '+i; sel.appendChild(o);
  }
 }
 sel.value = d.cool_cur;

 $('i_model').textContent = d.info.model || '—';
 $('i_os').textContent = d.info.os || '—';
 $('i_kernel').textContent = d.info.kernel || '—';
 $('i_arch').textContent = d.info.arch || '—';
 $('i_python').textContent = d.info.python || '—';
 $('i_host').textContent = d.info.hostname || '—';

 $('upd_count').textContent = d.updates.count ?? '—';
 $('upd_sec').textContent = d.updates.security ?? 0;
 $('upd_at').textContent = fmtAgo(d.updates.checked_at);

 const al = d.argent_lite || {};
 $('al_scope').textContent = al.scope ? '('+al.scope+'-scope)' : '';
 $('al_unit').textContent = al.unit || '—';
 $('al_state').textContent = al.active || 'unknown';
 $('al_pid').textContent = (al.pid && al.pid>0) ? al.pid : '—';
 $('al_uptime').textContent = (al.uptime_s && al.uptime_s>0) ? (al.uptime_s+'s') : '—';
 const dot = $('al_dot');
 if (al.active === 'active')       dot.style.background = '#22c55e';
 else if (al.active === 'failed')  dot.style.background = '#ef4444';
 else                              dot.style.background = '#64748b';

 const gw = d.argent_gateway || {};
 $('gw_scope').textContent = gw.scope ? '('+gw.scope+'-scope)' : '';
 $('gw_unit').textContent = gw.unit || '—';
 $('gw_state').textContent = gw.active || 'unknown';
 $('gw_pid').textContent = (gw.pid && gw.pid>0) ? gw.pid : '—';
 $('gw_port').textContent = gw.port_listening ? 'listening' : 'closed';
 const gwDot = $('gw_dot');
 if (gw.port_listening)            gwDot.style.background = '#22c55e';
 else if (gw.active === 'failed')  gwDot.style.background = '#ef4444';
 else                              gwDot.style.background = '#64748b';

 // Desktop button: disable visually when gateway isn't listening
 const dBtn = $('btn_desktop');
 if (dBtn) {
  if (gw.port_listening) {
   dBtn.style.opacity = '1';
   dBtn.style.pointerEvents = 'auto';
   dBtn.title = 'Open ArgentOS Desktop (React UI) at :8080';
  } else {
   dBtn.style.opacity = '0.45';
   dBtn.style.pointerEvents = 'none';
   dBtn.title = 'Gateway is not listening on :18789 — start it below first';
  }
 }

 const list = $('svc_list');
 if(d.services.length === 0){
  list.innerHTML = '<div class="text-slate-500 text-xs">No services configured. Edit SERVICES in dashboard.py.</div>';
 } else {
  list.innerHTML = d.services.map(s => {
   const color = s.status==='up'?'#34d399':s.status==='degraded'?'#fbbf24':'#f87171';
   const ctl = s.unit
    ? `<div class="flex gap-1 ml-2">
        <button class="btn btn-xs" title="Start ${s.name}" onclick="svcAction('${s.name}','start')">▶</button>
        <button class="btn btn-xs" title="Stop ${s.name}"  onclick="svcAction('${s.name}','stop')">■</button>
        <button class="btn btn-xs" title="Restart ${s.name}" onclick="svcAction('${s.name}','restart')">↻</button>
       </div>`
    : '<div class="w-[92px] ml-2 text-[10px] text-slate-600 text-right">no unit</div>';
   return `<div class="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/[.03] border border-white/5">
    <div class="flex items-center gap-2.5 min-w-0 flex-1">
     <span class="dot" style="background:${color};color:${color};"></span>
     <div class="min-w-0 flex-1">
      <div class="text-sm text-white truncate">${s.name}</div>
      <div class="text-[10px] text-slate-500 truncate k">${s.target}</div>
     </div>
    </div>
    <div class="text-right">
     <div class="status-${s.status} text-xs font-medium">${s.status.toUpperCase()}</div>
     <div class="text-[10px] text-slate-500 k">${s.type} · ${s.ms}ms${s.scope?' · '+s.scope:''}</div>
    </div>
    ${ctl}
   </div>`;
  }).join('');
 }

 $('ts').textContent = new Date(d.ts*1000).toLocaleTimeString();
}
$('pwm_slider').oninput = e => $('slider_val').textContent = e.target.value;
async function post(body){
 await fetch('/api/fan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 refresh();
}
function setPwm(v){ post({pwm: v ?? parseInt($('pwm_slider').value)}); }
function setAuto(){ post({auto:true}); }
function setCool(){ post({cool: parseInt($('cool_sel').value)}); }
async function refreshUpdates(){
 await fetch('/api/updates/refresh',{method:'POST'});
 refresh();
}
async function svcAction(name, action){
 const prev = $('svc_list');
 try {
  const r = await fetch('/api/service/'+encodeURIComponent(name)+'/'+action, {method:'POST'});
  const j = await r.json();
  if (!j.ok) console.warn('svc '+name+' '+action+': '+(j.error||j.stderr||'failed'));
 } catch(e){ console.warn(e); }
 setTimeout(refresh, 500);
}
async function alAction(action){
 const msg = $('al_msg');
 msg.textContent = '→ '+action+'…';
 try {
  const r = await fetch('/api/argent-lite/'+action, {method:'POST'});
  const j = await r.json();
  msg.textContent = j.ok ? ('✓ '+action+' ok') : ('✗ '+action+': '+(j.error||j.stderr||'failed'));
 } catch(e){
  msg.textContent = '✗ '+action+' threw: '+e;
 }
 setTimeout(refresh, 500);
}
async function launchDashboard(){
 const msg = $('launch_msg');
 msg.textContent = 'opening http://localhost:8080 …';
 try {
  const r = await fetch('/api/launch/desktop', {method:'POST'});
  const j = await r.json();
  if (j.ok) msg.textContent = '✓ opened in new tab';
  else {
   window.open('http://localhost:8080', '_blank');
   msg.textContent = 'opened in new tab (xdg-open fallback: '+(j.error||'n/a')+')';
  }
 } catch(e){
  window.open('http://localhost:8080', '_blank');
  msg.textContent = 'opened in new tab';
 }
}
async function gwAction(action){
 const msg = $('gw_msg');
 msg.textContent = '→ '+action+'…';
 try {
  const r = await fetch('/api/argent-gateway/'+action, {method:'POST'});
  const j = await r.json();
  msg.textContent = j.ok ? ('✓ '+action+' ok (gateway builds take ~40s on first start)') : ('✗ '+action+': '+(j.error||j.stderr||'failed'));
 } catch(e){
  msg.textContent = '✗ '+action+' threw: '+e;
 }
 setTimeout(refresh, 1000);
}
async function launchKiosk(){
 alert('Kiosk mode ships in cycle-21 — voice + touchscreen not wired yet.');
 setTimeout(refresh, 500);
}
refresh();
setInterval(refresh, 2000);
</script>
</body></html>
"""


# --- HTTP handler ------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a, **k):
        pass

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            body = INDEX.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/api/stats":
            self._json(gather())
        elif self.path.startswith("/static/"):
            rel = self.path[len("/static/"):].lstrip("/")
            fp = os.path.normpath(os.path.join(STATIC_DIR, rel))
            if not fp.startswith(STATIC_DIR) or not os.path.isfile(fp):
                self.send_error(404); return
            ctype = "application/javascript" if fp.endswith(".js") else \
                    "text/css" if fp.endswith(".css") else "application/octet-stream"
            with open(fp, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Cache-Control", "public, max-age=86400")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == "/api/fan":
            n = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(n) or b"{}")
            try:
                if data.get("auto"):
                    write(f"{HWMON_FAN}/pwm1_enable", 2)
                elif "pwm" in data:
                    write(f"{HWMON_FAN}/pwm1_enable", 1)
                    write(f"{HWMON_FAN}/pwm1", max(0, min(255, int(data["pwm"]))))
                elif "cool" in data:
                    write(f"{COOLING}/cur_state", max(0, min(4, int(data["cool"]))))
                self._json({"ok": True})
            except PermissionError:
                self._json({"ok": False, "error": "needs root"}, 403)
            except Exception as e:
                self._json({"ok": False, "error": str(e)}, 500)
        elif self.path == "/api/updates/refresh":
            threading.Thread(target=refresh_updates, daemon=True).start()
            self._json({"ok": True})
        elif self.path in ("/api/argent-lite/start",
                           "/api/argent-lite/stop",
                           "/api/argent-lite/restart"):
            action = self.path.rsplit("/", 1)[-1]
            self._json(argent_lite_action(action))
        elif self.path in ("/api/argent-gateway/start",
                           "/api/argent-gateway/stop",
                           "/api/argent-gateway/restart"):
            action = self.path.rsplit("/", 1)[-1]
            self._json(argent_gateway_action(action))
        elif self.path.startswith("/api/service/"):
            # Generic per-service control: POST /api/service/<name>/<action>
            parts = self.path[len("/api/service/"):].split("/")
            if len(parts) != 2:
                self._json({"ok": False, "error": "expected /api/service/<name>/<action>"}, 400)
                return
            svc_name, action = parts
            self._json(generic_service_action(svc_name, action))
        elif self.path == "/api/launch/desktop":
            # Best-effort xdg-open from server side; client also opens a tab.
            try:
                subprocess.Popen(
                    ["sudo", "-u", ARGENT_LITE_USER, "-E",
                     "env", f"DISPLAY={os.environ.get('DISPLAY', ':0')}",
                     "xdg-open", "http://localhost:8080"],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                )
                self._json({"ok": True})
            except Exception as e:
                self._json({"ok": False, "error": str(e)[:200]})
        else:
            self.send_error(404)


if __name__ == "__main__":
    load_static()
    threading.Thread(target=updates_loop, daemon=True).start()
    print(f"Pi dashboard → http://0.0.0.0:{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
