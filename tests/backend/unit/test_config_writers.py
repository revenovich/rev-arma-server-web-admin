"""Unit tests for config_writer modules."""
from __future__ import annotations

from pathlib import Path

from app.domain.config_writer.basic_config import write_basic_cfg
from app.domain.config_writer.profile_config import write_profile_cfg
from app.schemas.basic_config import BasicConfigSchema
from app.schemas.server_profile import (
    CustomAILevel,
    DifficultyOptions,
    ServerProfileSchema,
)


# ---------------------------------------------------------------------------
# write_basic_cfg
# ---------------------------------------------------------------------------

def test_write_basic_cfg_creates_file(tmp_path: Path) -> None:
    dest = tmp_path / "basic.cfg"
    write_basic_cfg(dest)
    assert dest.exists()


def test_write_basic_cfg_defaults(tmp_path: Path) -> None:
    dest = tmp_path / "basic.cfg"
    write_basic_cfg(dest)
    text = dest.read_text(encoding="utf-8")
    assert "MaxMsgSend = 128;" in text
    assert "MaxSizeGuaranteed = 512;" in text
    assert "class sockets {" in text


def test_write_basic_cfg_custom_values(tmp_path: Path) -> None:
    dest = tmp_path / "basic.cfg"
    cfg = BasicConfigSchema(MaxMsgSend=512, MaxBandwidth=100_000_000)
    write_basic_cfg(dest, cfg)
    text = dest.read_text(encoding="utf-8")
    assert "MaxMsgSend = 512;" in text
    assert "MaxBandwidth = 100000000;" in text


def test_write_basic_cfg_creates_parent_dirs(tmp_path: Path) -> None:
    dest = tmp_path / "subdir" / "nested" / "basic.cfg"
    write_basic_cfg(dest)
    assert dest.exists()


# ---------------------------------------------------------------------------
# ServerProfileSchema
# ---------------------------------------------------------------------------

def test_server_profile_defaults() -> None:
    p = ServerProfileSchema()
    d = p.difficulty
    assert d.ai_level_preset == 3
    assert d.custom_difficulty.reducedDamage == 0
    assert d.custom_ai_level.skillAI == 0.5


def test_difficulty_options_all_defaults() -> None:
    opts = DifficultyOptions()
    assert opts.weaponCrosshair == 0
    assert opts.thirdPersonView == 0
    assert opts.scoreTable == 1


def test_custom_ai_level_bounds() -> None:
    ai = CustomAILevel(skillAI=0.75, precisionAI=0.25)
    assert ai.skillAI == 0.75
    assert ai.precisionAI == 0.25


# ---------------------------------------------------------------------------
# write_profile_cfg
# ---------------------------------------------------------------------------

def test_write_profile_cfg_creates_file(tmp_path: Path) -> None:
    dest = tmp_path / "profile.Arma3Profile"
    write_profile_cfg(dest)
    assert dest.exists()


def test_write_profile_cfg_default_values(tmp_path: Path) -> None:
    dest = tmp_path / "profile.Arma3Profile"
    write_profile_cfg(dest)
    text = dest.read_text(encoding="utf-8")
    assert "class DifficultyPresets {" in text
    assert "reducedDamage = 0;" in text
    assert "skillAI = 0.5;" in text


def test_write_profile_cfg_custom_values(tmp_path: Path) -> None:
    dest = tmp_path / "profile.Arma3Profile"
    from app.schemas.server_profile import _DifficultyPresets

    profile = ServerProfileSchema(
        difficulty=_DifficultyPresets(
            custom_difficulty=DifficultyOptions(thirdPersonView=1, weaponCrosshair=1),
            ai_level_preset=2,
            custom_ai_level=CustomAILevel(skillAI=0.8, precisionAI=0.9),
        )
    )
    write_profile_cfg(dest, profile)
    text = dest.read_text(encoding="utf-8")
    assert "thirdPersonView = 1;" in text
    assert "weaponCrosshair = 1;" in text
    assert "aiLevelPreset = 2;" in text
    assert "skillAI = 0.8;" in text


def test_write_profile_cfg_creates_parent_dirs(tmp_path: Path) -> None:
    dest = tmp_path / "profiles" / "Admin" / "Admin.Arma3Profile"
    write_profile_cfg(dest)
    assert dest.exists()
