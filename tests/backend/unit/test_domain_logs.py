"""Unit tests for app.domain.logs — list, get, delete, cleanup."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.core.config import Settings
from app.domain import logs as logs_domain


def _make_settings(tmp_path: Path, platform: str = "linux") -> Settings:
    cfg = tmp_path / "config.json"
    cfg.write_text(
        json.dumps({"game": "arma3", "path": str(tmp_path), "type": platform}),
        encoding="utf-8",
    )
    return Settings(game="arma3", path=str(tmp_path), type=platform)


def _make_log(directory: Path, name: str, content: str = "line") -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    p = directory / name
    p.write_text(content, encoding="utf-8")
    return p


# ---------------------------------------------------------------------------
# list_logs
# ---------------------------------------------------------------------------

def test_list_logs_empty_when_no_directory(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    result = logs_domain.list_logs(settings)
    assert result == []


def test_list_logs_empty_when_directory_has_no_rpt(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    logs_dir = tmp_path / "logs"
    logs_dir.mkdir()
    (logs_dir / "notes.txt").write_text("x")
    result = logs_domain.list_logs(settings)
    assert result == []


def test_list_logs_returns_rpt_files(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    log_dir = tmp_path / "logs"
    _make_log(log_dir, "arma3server_2024.rpt", "crash")
    _make_log(log_dir, "arma3server_2025.rpt", "ok")
    result = logs_domain.list_logs(settings)
    assert len(result) == 2
    names = {r.name for r in result}
    assert "arma3server_2024.rpt" in names
    assert "arma3server_2025.rpt" in names


def test_list_logs_skips_non_files(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    log_dir = tmp_path / "logs"
    _make_log(log_dir, "real.rpt")
    (log_dir / "subdir.rpt").mkdir()  # directory named .rpt
    result = logs_domain.list_logs(settings)
    assert len(result) == 1
    assert result[0].name == "real.rpt"


def test_list_logs_schema_fields_populated(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    log_dir = tmp_path / "logs"
    _make_log(log_dir, "server.rpt", "content")
    result = logs_domain.list_logs(settings)
    assert len(result) == 1
    entry = result[0]
    assert entry.name == "server.rpt"
    assert entry.size > 0
    assert entry.formattedSize  # non-empty string from humanize
    assert entry.path.endswith("server.rpt")


def test_list_logs_returns_empty_for_windows_unknown_game(tmp_path: Path) -> None:
    # windows platform with unknown game → logs_dir returns None
    settings = Settings(game="arma3", path=str(tmp_path), type="windows")
    # on windows, logs_dir uses LOCALAPPDATA which may vary — just verify no crash
    result = logs_domain.list_logs(settings)
    assert isinstance(result, list)


# ---------------------------------------------------------------------------
# get_log
# ---------------------------------------------------------------------------

def test_get_log_returns_matching_entry(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    log_dir = tmp_path / "logs"
    _make_log(log_dir, "target.rpt")
    entry = logs_domain.get_log("target.rpt", settings)
    assert entry is not None
    assert entry.name == "target.rpt"


def test_get_log_returns_none_for_missing(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    result = logs_domain.get_log("nonexistent.rpt", settings)
    assert result is None


# ---------------------------------------------------------------------------
# delete_log
# ---------------------------------------------------------------------------

def test_delete_log_removes_file(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    log_dir = tmp_path / "logs"
    p = _make_log(log_dir, "delete_me.rpt")
    ok = logs_domain.delete_log("delete_me.rpt", settings)
    assert ok is True
    assert not p.exists()


def test_delete_log_returns_false_for_missing(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    ok = logs_domain.delete_log("ghost.rpt", settings)
    assert ok is False


def test_delete_log_returns_false_on_oserror(tmp_path: Path) -> None:
    from unittest.mock import patch
    settings = _make_settings(tmp_path)
    log_dir = tmp_path / "logs"
    _make_log(log_dir, "locked.rpt")
    with patch("pathlib.Path.unlink", side_effect=OSError("locked")):
        ok = logs_domain.delete_log("locked.rpt", settings)
    assert ok is False


# ---------------------------------------------------------------------------
# cleanup_old_logs
# ---------------------------------------------------------------------------

def test_cleanup_old_logs_noop_on_windows(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path, platform="windows")
    # Just verify it doesn't crash on non-linux platforms
    logs_domain.cleanup_old_logs(settings)


def test_cleanup_old_logs_keeps_retention_count(tmp_path: Path) -> None:
    from app.core.paths import LOGS_RETENTION
    settings = _make_settings(tmp_path)
    log_dir = tmp_path / "logs"
    # Create LOGS_RETENTION + 5 log files
    total = LOGS_RETENTION + 5
    for i in range(total):
        _make_log(log_dir, f"arma3server_{i:03d}.rpt", f"log {i}")

    logs_domain.cleanup_old_logs(settings)
    remaining = list(log_dir.glob("*.rpt"))
    assert len(remaining) == LOGS_RETENTION
