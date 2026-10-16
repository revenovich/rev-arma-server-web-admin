from __future__ import annotations

import os
from pathlib import Path, PureWindowsPath

from app.core.config import Settings

# Mod directory glob — matches @-prefixed mods and Creator DLC folders
MOD_SCAN_GLOB = "**/{@*,csla,ef,gm,rf,spe,vn,ws}/addons"

SERVERS_JSON = Path("servers.json")
LOGS_RETENTION = 20

_GAME_LOG_FOLDERS: dict[str, str] = {
    "arma1": "ArmA",
    "arma2": "ArmA 2",
    "arma2oa": "ArmA 2 OA",
    "arma3": "Arma 3",
    "arma3_x64": "Arma 3",
}


class UnsafePathError(ValueError):
    """A client-supplied name or path would leave its base directory (mapped to HTTP 400)."""


def validate_name(name: str) -> str:
    """Return *name* if it is safe to use as one path component, else raise UnsafePathError.

    Rejects empty names, ``.``/``..``, either path separator (a Linux host refuses
    Windows-style ``..\\`` too), NUL bytes, and drive/UNC prefixes such as ``C:``.
    """
    if (
        name in ("", ".", "..")
        or "/" in name
        or "\\" in name
        or "\0" in name
        or PureWindowsPath(name).anchor
    ):
        raise UnsafePathError(f"Invalid name: {name!r}")
    return name


def ensure_within(base: Path, candidate: Path) -> Path:
    """Return *candidate* if it resolves strictly inside *base*, else raise UnsafePathError.

    Both sides are resolved, so a symlink or junction can't be used to step out,
    and a sibling sharing the prefix (``mpmissions_old`` vs ``mpmissions``) fails.
    os.path.realpath rather than Path.resolve(): on Windows before Python 3.10,
    resolve() leaves ``..`` uncollapsed after a component that doesn't exist yet.
    """
    try:
        root = Path(os.path.realpath(base))
        resolved = Path(os.path.realpath(candidate))
    except OSError as exc:
        raise UnsafePathError(f"Invalid path: {candidate.name!r}") from exc
    if resolved == root or not resolved.is_relative_to(root):
        raise UnsafePathError(f"Path escapes its directory: {candidate.name!r}")
    return candidate


def safe_join(base: Path, *names: str) -> Path:
    """Join single-component *names* onto *base*, refusing anything that leaves it.

    Returns the unresolved join so callers act on the entry itself, not a link target.
    """
    for name in names:
        validate_name(name)
    return ensure_within(base, base.joinpath(*names))


def game_dir(settings: Settings) -> Path:
    return Path(settings.path)


def missions_dir(settings: Settings) -> Path:
    return game_dir(settings) / "mpmissions"


def logs_dir(settings: Settings) -> Path | None:
    platform = settings.type
    game = settings.game

    if platform == "linux":
        return game_dir(settings) / "logs"

    folder = _GAME_LOG_FOLDERS.get(game)
    if folder is None:
        return None

    if platform == "windows":
        local = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        return Path(local) / folder

    if platform == "wine":
        user = os.environ.get("USER", "user")
        return (
            Path.home()
            / ".wine"
            / "drive_c"
            / "users"
            / user
            / "Local Settings"
            / "Application Data"
            / folder
        )

    return None
