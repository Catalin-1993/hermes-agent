"""The market-data service: its own Python environment and its process.

OpenBB (and later the backtesting engine) are heavy and pinned, so they never enter Hermes's
environment: they live in a venv under ``<HERMES_HOME>/portfolio/venv`` built with Hermes's own uv
from ``service/requirements.txt`` constrained by ``service/requirements.lock``. A hash of both files
is stamped into the venv, so after an update that changes them the environment reports ``outdated``
and the next install rebuilds it — one update for the user, never a silent upgrade.

The environment is installed only when the owner asks (it downloads a few hundred MB) and only when
Hermes allows lazy installs. The service runs as one process per home, bound to 127.0.0.1 with a
random per-start token; every backend that needs it reuses the running one, and the backend that
started it stops it on exit. One backend serves several profiles, so the install/start threads and
the last error are kept per home, and the threads carry the caller's profile scope.
"""

from __future__ import annotations

import atexit
import hashlib
import json
import secrets
import socket
import subprocess
import threading
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from hermes_constants import display_hermes_home, get_hermes_home, hermes_home_key

SERVICE_DIR = Path(__file__).resolve().parents[1] / "service"
REQUIREMENTS = SERVICE_DIR / "requirements.txt"
LOCK = SERVICE_DIR / "requirements.lock"
PYTHON_VERSION = "3.13"
_START_TIMEOUT_S = 90
_INSTALL_TIMEOUT_S = 1200


@dataclass
class _Home:
    root: Path
    install: Optional[threading.Thread] = None
    start: Optional[threading.Thread] = None
    error: str = ""
    owned_pid: Optional[int] = None


_lock = threading.RLock()
_homes: dict[str, _Home] = {}


def _root() -> Path:
    return get_hermes_home() / "portfolio"


def _home() -> _Home:
    with _lock:
        return _homes.setdefault(hermes_home_key(), _Home(root=_root()))


def _venv() -> Path:
    return _root() / "venv"


def _python() -> Path:
    from pm.environments import venv_python

    return venv_python(_venv())


def _stamp_file() -> Path:
    return _venv() / ".portfolio-stamp"


def _service_file(root: Optional[Path] = None) -> Path:
    return (root or _root()) / "service.json"


def wanted_stamp() -> str:
    digest = hashlib.sha256()
    for path in (REQUIREMENTS, LOCK):
        digest.update(path.read_bytes() if path.is_file() else b"")
    return digest.hexdigest()[:16]


def env_phase() -> str:
    """``installing`` · ``ready`` · ``outdated`` (built from older pins) · ``missing`` · ``error``."""
    home = _home()
    if home.install is not None and home.install.is_alive():
        return "installing"
    if _python().is_file() and _stamp_file().is_file():
        return "ready" if _stamp_file().read_text(encoding="utf-8-sig").strip() == wanted_stamp() else "outdated"
    return "error" if home.error else "missing"


def last_error() -> str:
    return _home().error


def _run(command: list[str], log, cwd: Path) -> None:
    log.write(f"$ {' '.join(command)}\n")
    log.flush()
    subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=_INSTALL_TIMEOUT_S,
                   cwd=cwd)


def _build(uv: Path) -> None:
    with (_root() / "install.log").open("w", encoding="utf-8") as log:
        # uv splits a ``-c`` path at its spaces and the checkout may live under one, so the
        # requirements go by bare name from SERVICE_DIR; ``--no-config`` keeps the repo's own
        # [tool.uv] settings out of this venv.
        _run([str(uv), "venv", "--no-config", "--clear", "--python", PYTHON_VERSION, str(_venv())], log,
             SERVICE_DIR)
        _run([str(uv), "pip", "install", "--no-config", "--python", str(_python()),
              "-r", REQUIREMENTS.name, "-c", LOCK.name], log, SERVICE_DIR)
        # OpenBB generates its package on first import and tidies it with ruff, which reads the
        # ruff config of the working directory: under the repo's it keeps imports that break the
        # package. So its first import (which builds it) runs here, from the portfolio folder.
        _run([str(_python()), "-I", "-c", "import openbb"], log, _root())
    _stamp_file().write_text(wanted_stamp(), encoding="utf-8")


def _install() -> None:
    from pm.install import lazy_installs_allowed, uv_launcher

    home = _home()
    _root().mkdir(parents=True, exist_ok=True)
    try:
        if not lazy_installs_allowed():
            raise RuntimeError("Instalările la cerere sunt oprite (security.allow_lazy_installs în config.yaml).")
        uv = uv_launcher("uv")
        if uv is None:
            raise RuntimeError("Lipsește uv-ul lui Hermes; rulează `hermes update`.")
        stop_service()
        _build(uv)
        home.error = ""
    except subprocess.SubprocessError:
        home.error = f"Detalii în {display_hermes_home()}/portfolio/install.log."
    except (OSError, RuntimeError) as exc:
        home.error = str(exc)[:400]


def install_env() -> str:
    """Start building the environment in the background (no-op while one is running)."""
    from agent.memory_provider import spawn_context_thread

    with _lock:
        if env_phase() != "installing":
            home = _home()
            home.install = spawn_context_thread(_install, name="portfolio-env-install")
            home.install.start()
    return env_phase()


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def _alive(pid: int) -> bool:
    """Running, and not a zombie: a dead child stays in the process table until it is reaped."""
    import psutil

    try:
        return pid > 0 and psutil.Process(pid).status() != psutil.STATUS_ZOMBIE
    except psutil.Error:
        return False


def _read_service(root: Optional[Path] = None) -> Optional[dict]:
    try:
        info = json.loads(_service_file(root).read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return None
    return info if isinstance(info, dict) and _alive(int(info.get("pid", 0))) else None


def _get(info: dict, path: str, params: Optional[dict] = None, timeout: float = 30) -> dict:
    query = f"?{urllib.parse.urlencode(params)}" if params else ""
    request = urllib.request.Request(f"http://127.0.0.1:{info['port']}{path}{query}",
                                     headers={"X-Portfolio-Token": info["token"]})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _post(info: dict, path: str, body: dict, timeout: float = 30) -> dict:
    request = urllib.request.Request(f"http://127.0.0.1:{info['port']}{path}", data=json.dumps(body).encode("utf-8"),
                                     headers={"X-Portfolio-Token": info["token"], "Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _healthy(info: dict) -> bool:
    try:
        return bool(_get(info, "/health", timeout=3).get("ok"))
    except (OSError, ValueError):
        return False


def _spawn() -> tuple[subprocess.Popen, dict]:
    token = secrets.token_urlsafe(24)
    port = _free_port()
    from tools.environments.local import build_subprocess_env

    # The market-data service reads its provider keys from the environment, so nothing is scrubbed.
    env = build_subprocess_env(scrub_secrets=False, inherit_profile_home=False,
                               extra={"PYTHONPATH": str(SERVICE_DIR), "PORTFOLIO_SERVICE_TOKEN": token})
    with (_root() / "service.log").open("a", encoding="utf-8") as log:
        process = subprocess.Popen([str(_python()), "-m", "portfolio_service", "--port", str(port)],
                                   # detached-spawn: ok — reused across restarts via service.json; stop_service ends it
                                   stdout=log, stderr=subprocess.STDOUT, env=env, start_new_session=True,
                                   cwd=_root())  # see _build: OpenBB may rebuild itself on import
    info = {"pid": process.pid, "port": port, "token": token, "stamp": wanted_stamp()}
    path = _service_file()
    path.write_text(json.dumps(info), encoding="utf-8")
    path.chmod(0o600)
    return process, info


def _start() -> None:
    home = _home()
    process, info = _spawn()
    home.owned_pid = process.pid
    deadline = time.monotonic() + _START_TIMEOUT_S
    while time.monotonic() < deadline:
        if process.poll() is not None:
            home.error = f"Serviciul s-a oprit la pornire; detalii în {display_hermes_home()}/portfolio/service.log."
            return
        if _healthy(info):
            home.error = ""
            return
        time.sleep(1)
    home.error = "Serviciul nu a răspuns la timp."


def service() -> Optional[dict]:
    """The running service's address and token, starting it in the background when the environment is
    ready but nothing runs. None while it is not (yet) available."""
    from agent.memory_provider import spawn_context_thread

    if env_phase() != "ready":
        return None
    info = _read_service()
    if info is not None and info.get("stamp") == wanted_stamp() and _healthy(info):
        return info
    with _lock:
        home = _home()
        if home.start is None or not home.start.is_alive():
            if info is not None:
                stop_service()
            home.start = spawn_context_thread(_start, name="portfolio-service-start")
            home.start.start()
    return None


def service_phase() -> str:
    if env_phase() != "ready":
        return "off"
    home = _home()
    if home.start is not None and home.start.is_alive():
        return "starting"
    info = _read_service()
    return "running" if info is not None and _healthy(info) else "stopped"


def fetch_history(info: dict, symbols: list[str], start: str) -> dict:
    if not symbols:
        return {}
    return _get(info, "/history", {"symbols": ",".join(symbols), "start": start}, timeout=60)


def fetch_bars(info: dict, symbol: str, interval: str) -> dict:
    return _get(info, "/bars", {"symbol": symbol, "interval": interval}, timeout=60)


def fetch_profile(info: dict, symbol: str) -> dict:
    return _get(info, "/profile", {"symbol": symbol}, timeout=60)


def run_backtest(info: dict, request: dict) -> dict:
    return _post(info, "/backtest", request, timeout=180)


def stop_service(root: Optional[Path] = None) -> None:
    import psutil

    info = _read_service(root)
    if info is not None:
        try:
            psutil.Process(int(info["pid"])).terminate()
        except psutil.Error:
            pass  # it exited on its own in the meantime
    _service_file(root).unlink(missing_ok=True)


def _stop_owned() -> None:
    """At exit, stop the services this process started — in every home it served."""
    for home in list(_homes.values()):
        info = _read_service(home.root)
        if info is not None and home.owned_pid is not None and int(info.get("pid", 0)) == home.owned_pid:
            stop_service(home.root)


atexit.register(_stop_owned)
