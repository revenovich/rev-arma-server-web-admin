from __future__ import annotations

from pathlib import Path
from typing import Any

import humanize
import structlog

from app.core.config import Settings
from app.core.paths import game_dir
from app.schemas.mod import ModSchema

log = structlog.get_logger()


def _folder_size(path: Path) -> int:
    total = 0
    try:
        for f in path.rglob("*"):
            if f.is_file():
                total += f.stat().st_size
    except OSError:
        pass
    return total


def _read_steam_meta(mod_path: Path) -> dict[str, Any] | None:
    meta = mod_path / "meta.cpp"
    if not meta.exists():
        return None
    try:
        text = meta.read_text(encoding="utf-8", errors="replace")
        import re
        m = re.search(r'publishedid\s*=\s*(\d+)', text, re.IGNORECASE)
        name_m = re.search(r'name\s*=\s*"([^"]+)"', text, re.IGNORECASE)
        return {
            "publishedId": m.group(1) if m else None,
            "name": name_m.group(1) if name_m else None,
        }
    except OSError:
        return None


def _read_mod_file(mod_path: Path) -> dict[str, Any] | None:
    """Read mod.cpp or similar for display name."""
    for candidate in ("mod.cpp", "Mod.cpp", "MOD.CPP"):
        p = mod_path / candidate
        if p.exists():
            try:
                text = p.read_text(encoding="utf-8", errors="replace")
                import re
                m = re.search(r'name\s*=\s*"([^"]+)"', text, re.IGNORECASE)
                return {"name": m.group(1) if m else None}
            except OSError:
                pass
    return None


_DLC_MOD_NAMES = {"csla", "ef", "gm", "rf", "spe", "vn", "ws"}
# pathlib.glob() does not support brace expansion, so we use two passes:
# 1. @-prefixed mods (the vast majority)
# 2. Creator-DLC folders with known fixed names
_MOD_GLOBS = ["**/@*/addons"] + [f"**/{n}/addons" for n in _DLC_MOD_NAMES]


def list_mods(settings: Settings) -> list[ModSchema]:
    root = game_dir(settings)
    if not root.exists():
        return []

    results: list[ModSchema] = []
    seen: set[Path] = set()
    for pattern in _MOD_GLOBS:
        for addons_path in root.glob(pattern):
            mod_path = addons_path.parent
            if mod_path in seen:
                continue
            seen.add(mod_path)

            size = _folder_size(mod_path)
            results.append(
                ModSchema(
                    name=str(mod_path.relative_to(root)).replace("\\", "/"),
                    size=size,
                    formattedSize=humanize.naturalsize(size),
                    modFile=_read_mod_file(mod_path),
                    steamMeta=_read_steam_meta(mod_path),
                )
            )

    return sorted(results, key=lambda m: m.name.lower())
