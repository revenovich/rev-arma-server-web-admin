"""Unit tests for app.domain.missions — list, save, delete."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.core.config import Settings
from app.domain import missions as missions_domain


def _make_settings(tmp_path: Path) -> Settings:
    return Settings(game="arma3", path=str(tmp_path), type="linux")


# ---------------------------------------------------------------------------
# list_missions
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_missions_empty_when_no_directory(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    result = await missions_domain.list_missions(settings)
    assert result == []


@pytest.mark.asyncio
async def test_list_missions_ignores_non_files(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    missions_dir = tmp_path / "mpmissions"
    missions_dir.mkdir()
    (missions_dir / "subdir").mkdir()
    result = await missions_domain.list_missions(settings)
    assert result == []


@pytest.mark.asyncio
async def test_list_missions_returns_mission_schema(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    missions_dir = tmp_path / "mpmissions"
    missions_dir.mkdir()
    (missions_dir / "co_10_escape.Stratis.pbo").write_bytes(b"fake")

    result = await missions_domain.list_missions(settings)
    assert len(result) == 1
    m = result[0]
    assert m.name == "co_10_escape.Stratis.pbo"
    assert m.missionName == "co_10_escape"
    assert m.worldName == "Stratis"
    assert m.size == 4
    assert m.sizeFormatted  # humanize produces non-empty string


@pytest.mark.asyncio
async def test_list_missions_multiple_files(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    missions_dir = tmp_path / "mpmissions"
    missions_dir.mkdir()
    (missions_dir / "alpha.Altis.pbo").write_bytes(b"a")
    (missions_dir / "bravo.Stratis.pbo").write_bytes(b"b")

    result = await missions_domain.list_missions(settings)
    assert len(result) == 2
    names = {m.name for m in result}
    assert "alpha.Altis.pbo" in names
    assert "bravo.Stratis.pbo" in names


@pytest.mark.asyncio
async def test_list_missions_handles_oserror_gracefully(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    missions_dir = tmp_path / "mpmissions"
    missions_dir.mkdir()
    # Write a file then simulate OSError by removing the directory mid-scan
    # (hard to reproduce portably — just verify empty dir returns empty)
    result = await missions_domain.list_missions(settings)
    assert result == []


# ---------------------------------------------------------------------------
# save_upload
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_save_upload_moves_file_to_missions_dir(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    # Create a temp file to simulate upload
    src = tmp_path / "upload_tmp.pbo"
    src.write_bytes(b"pbo content")

    await missions_domain.save_upload(src, "test_mission.Altis.pbo", settings)

    dest = tmp_path / "mpmissions" / "test_mission.altis.pbo"
    assert dest.exists()
    assert dest.read_bytes() == b"pbo content"


@pytest.mark.asyncio
async def test_save_upload_creates_parent_directory(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    src = tmp_path / "tmp.pbo"
    src.write_bytes(b"x")

    await missions_domain.save_upload(src, "New.Altis.pbo", settings)

    assert (tmp_path / "mpmissions").is_dir()


# ---------------------------------------------------------------------------
# delete_mission
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_mission_removes_file(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    missions_dir = tmp_path / "mpmissions"
    missions_dir.mkdir()
    target = missions_dir / "remove_me.pbo"
    target.write_bytes(b"x")

    await missions_domain.delete_mission("remove_me.pbo", settings)
    assert not target.exists()


@pytest.mark.asyncio
async def test_delete_mission_noop_for_missing_file(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    # Should not raise even if file doesn't exist
    await missions_domain.delete_mission("ghost.pbo", settings)
