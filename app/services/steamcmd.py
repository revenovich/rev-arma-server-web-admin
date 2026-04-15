from __future__ import annotations

import asyncio
import shutil
from pathlib import Path
from typing import Any

import structlog

log = structlog.get_logger()

STEAM_APP_IDS: dict[str, int] = {
    "arma3": 233780,
    "arma3_x64": 233780,
    "arma2oa": 33910,
    "arma2": 33910,
}


def _find_steamcmd() -> str | None:
    return shutil.which("steamcmd") or shutil.which("steamcmd.exe")


async def install_server(
    game: str,
    install_path: str,
    branch: str = "public",
    bus: Any | None = None,
) -> dict[str, Any]:
    app_id = STEAM_APP_IDS.get(game)
    if app_id is None:
        return {"ok": False, "error": f"No Steam app ID for game '{game}'"}

    steamcmd = _find_steamcmd()
    if steamcmd is None:
        return {"ok": False, "error": "steamcmd binary not found in PATH"}

    beta_args = ["+app_update_beta", branch] if branch != "public" else []
    cmd = [
        steamcmd,
        "+force_install_dir", install_path,
        "+login", "anonymous",
        "+app_update", str(app_id),
        *beta_args,
        "validate",
        "+quit",
    ]

    return await _run_steamcmd(cmd, bus=bus)


async def update_server(
    game: str,
    install_path: str,
    branch: str = "public",
    bus: Any | None = None,
) -> dict[str, Any]:
    return await install_server(game, install_path, branch=branch, bus=bus)


async def _run_steamcmd(cmd: list[str], bus: Any | None = None) -> dict[str, Any]:
    log.info("steamcmd starting", cmd=" ".join(cmd))
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
    except OSError as exc:
        return {"ok": False, "error": str(exc)}

    assert proc.stdout
    lines: list[str] = []
    while True:
        line_bytes = await proc.stdout.readline()
        if not line_bytes:
            break
        line = line_bytes.decode("utf-8", errors="replace").rstrip()
        lines.append(line)
        if bus:
            await bus.publish("steamcmd", {"line": line})

    await proc.wait()
    ok = proc.returncode == 0
    return {"ok": ok, "returncode": proc.returncode, "output": lines}


async def get_installed_version(install_path: str) -> str | None:
    """Read current build ID from steamapps/appmanifest_*.acf."""
    import re

    p = Path(install_path) / "steamapps"
    if not p.exists():
        return None
    for acf in p.glob("appmanifest_*.acf"):
        try:
            text = acf.read_text(encoding="utf-8", errors="replace")
            m = re.search(r'"buildid"\s+"(\d+)"', text)
            if m:
                return m.group(1)
        except OSError:
            pass
    return None
