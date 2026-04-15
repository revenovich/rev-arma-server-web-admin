from __future__ import annotations

from pathlib import Path

from app.schemas.server_profile import ServerProfileSchema


def write_profile_cfg(dest: Path, profile: ServerProfileSchema | None = None) -> None:
    """Write USERNAME.Arma3Profile — called only when forcedDifficulty = 'Custom'."""
    if profile is None:
        profile = ServerProfileSchema()

    d = profile.difficulty
    opts = d.custom_difficulty
    ai = d.custom_ai_level

    lines = [
        "class DifficultyPresets {",
        "    class CustomDifficulty {",
        "        class Options {",
        f"            reducedDamage = {opts.reducedDamage};",
        f"            groupIndicators = {opts.groupIndicators};",
        f"            friendlyTags = {opts.friendlyTags};",
        f"            enemyTags = {opts.enemyTags};",
        f"            detectedMines = {opts.detectedMines};",
        f"            commands = {opts.commands};",
        f"            waypoints = {opts.waypoints};",
        f"            tacticalPing = {opts.tacticalPing};",
        f"            weaponInfo = {opts.weaponInfo};",
        f"            stanceIndicator = {opts.stanceIndicator};",
        f"            staminaBar = {opts.staminaBar};",
        f"            weaponCrosshair = {opts.weaponCrosshair};",
        f"            visionAid = {opts.visionAid};",
        f"            thirdPersonView = {opts.thirdPersonView};",
        f"            cameraShake = {opts.cameraShake};",
        f"            scoreTable = {opts.scoreTable};",
        f"            deathMessages = {opts.deathMessages};",
        f"            vonID = {opts.vonID};",
        f"            mapContent = {opts.mapContent};",
        f"            autoReport = {opts.autoReport};",
        f"            multipleSaves = {opts.multipleSaves};",
        "        };",
        f"        aiLevelPreset = {d.ai_level_preset};",
        "    };",
        "    class CustomAILevel {",
        f"        skillAI = {ai.skillAI};",
        f"        precisionAI = {ai.precisionAI};",
        "    };",
        "};",
    ]

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")
