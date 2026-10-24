#!/usr/bin/env python3
"""One command to run the whole course locally (lessons, runnable code, retrieval lab, AI tutor):

    python start.py            # install what's missing, start the live-reloading app, open http://127.0.0.1:3000
    python start.py --prod     # build once and run the faster production server (no live reload)
    python start.py --port 4000 --no-browser --skip-install

The web app's "Run" buttons execute the lesson and project scripts with *this* Python interpreter,
so start it from the virtual environment you want the code to run in.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
MIN_PY, MIN_NODE = (3, 10), (20, 9)


def step(msg: str) -> None:
    print(f"\n\033[1;34m▶ {msg}\033[0m", flush=True)


def fail(msg: str) -> None:
    print(f"\n\033[1;31m✗ {msg}\033[0m")
    sys.exit(1)


def run(cmd: list[str], cwd: Path = ROOT) -> None:
    print("  $", " ".join(cmd), flush=True)
    if subprocess.run(cmd, cwd=cwd).returncode != 0:
        fail(f"command failed: {' '.join(cmd)}")


def check_python() -> None:
    if sys.version_info < MIN_PY:
        fail(f"Python {'.'.join(map(str, MIN_PY))}+ is required (you have {sys.version.split()[0]}).")
    if sys.prefix == sys.base_prefix and not os.environ.get("CONDA_PREFIX"):
        print("  tip: you're not in a virtual environment. `python -m venv .venv` keeps the course's packages separate.")


def find_npm() -> str:
    npm = shutil.which("npm") or shutil.which("npm.cmd")
    node = shutil.which("node")
    if not npm or not node:
        fail("Node.js is not installed. Get the LTS version (20.9 or newer) from https://nodejs.org, then run this again.")
    version = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip().lstrip("v")
    major, minor = (int(x) for x in version.split(".")[:2])
    if (major, minor) < MIN_NODE:
        fail(f"Node.js {MIN_NODE[0]}.{MIN_NODE[1]}+ is required (you have {version}). Update from https://nodejs.org.")
    print(f"  node {version}, npm at {npm}")
    return npm


def python_deps_ok() -> bool:
    try:
        import anthropic, dotenv, mcp, numpy, pydantic  # noqa: F401, E401

        import rag_common  # noqa: F401
    except ImportError:
        return False
    return True


def check_env() -> None:
    env, example = ROOT / ".env", ROOT / ".env.example"
    if not env.exists():
        if example.exists():
            shutil.copy(example, env)
            print("  created .env from .env.example: add your ANTHROPIC_API_KEY there (no restart needed)")
        return
    text = env.read_text(encoding="utf-8")
    if "ANTHROPIC_API_KEY" not in text or "ANTHROPIC_API_KEY=sk-ant-..." in text:
        print("  tip: add your ANTHROPIC_API_KEY to .env - lessons that call Claude need it (the retrieval lab doesn't)")


def install(npm: str, force: bool) -> None:
    if force or not python_deps_ok():
        step("Installing Python packages (anthropic, mcp, numpy, … and the course's own rag_common library)")
        run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        run([sys.executable, "-m", "pip", "install", "-e", "."])
    else:
        print("  Python packages already installed")
    lock, marker = WEB / "package-lock.json", WEB / "node_modules" / ".package-lock.json"
    if force or not marker.exists() or lock.stat().st_mtime > marker.stat().st_mtime:
        step("Installing the web app's packages (npm ci - first time only, ~1 minute)")
        run([npm, "ci", "--no-audit", "--no-fund"], cwd=WEB)
    else:
        print("  web packages already installed")


def needs_build() -> bool:
    build_id = WEB / ".next" / "BUILD_ID"
    if not build_id.exists():
        return True
    built = build_id.stat().st_mtime
    sources = [p for d in ("app", "components", "lib") for p in (WEB / d).rglob("*") if p.is_file()]
    sources += [WEB / "package-lock.json", WEB / "next.config.mjs"]
    return any(p.stat().st_mtime > built for p in sources)


def open_when_ready(url: str) -> None:
    for _ in range(300):
        try:
            urllib.request.urlopen(url, timeout=2)
            print(f"\n\033[1;32m✓ The course is running at {url}\033[0m  (Ctrl+C to stop)\n", flush=True)
            webbrowser.open(url)
            return
        except Exception:
            time.sleep(1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--prod", action="store_true", help="build once and run the production server (faster, but no live reload)")
    parser.add_argument("--dev", action="store_true", help="the default; kept so old commands still work")
    parser.add_argument("--port", type=int, default=3000)
    parser.add_argument("--no-browser", action="store_true", help="don't open a browser tab")
    parser.add_argument("--skip-install", action="store_true", help="don't check or install dependencies")
    parser.add_argument("--reinstall", action="store_true", help="reinstall Python and npm packages")
    args = parser.parse_args()

    step("Checking Python and Node.js")
    check_python()
    print(f"  python {sys.version.split()[0]} at {sys.executable}")
    npm = find_npm()
    if not args.skip_install:
        install(npm, args.reinstall)

    check_env()
    env = {**os.environ, "RAG_PYTHON": sys.executable, "NEXT_TELEMETRY_DISABLED": "1"}
    dev = not args.prod
    if not dev and needs_build():
        step("Building the web app (first run, or after the app's code changed)")
        if subprocess.run([npm, "run", "build"], cwd=WEB, env=env).returncode != 0:
            fail("build failed - try `python start.py` (dev server), and please report the error above")

    url = f"http://127.0.0.1:{args.port}"
    mode = "dev" if dev else "start"
    step(f"Starting the course app ({'live-reloading' if dev else 'production'} server) on {url}")
    if dev:
        print("  Edit lessons, projects, code or the web app: the page updates by itself. No restart needed.")
    if not args.no_browser:
        threading.Thread(target=open_when_ready, args=(url,), daemon=True).start()
    # The server binds to 127.0.0.1 only: the Run buttons execute code, so the app must not be reachable from the network.
    cmd = [npm, "exec", "--", "next", mode, "--port", str(args.port), "--hostname", "127.0.0.1"]
    try:
        sys.exit(subprocess.run(cmd, cwd=WEB, env=env).returncode)
    except KeyboardInterrupt:
        print("\nStopped. Run `python start.py` to start again.")


if __name__ == "__main__":
    main()
