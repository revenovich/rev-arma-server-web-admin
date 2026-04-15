from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class DifficultyOptions(BaseModel):
    """Custom difficulty flags — stored in USERNAME.Arma3Profile."""

    # Simulation
    reducedDamage: int = 0

    # Situational awareness (0=never, 1=limited distance, 2=always)
    groupIndicators: int = 0
    friendlyTags: int = 0
    enemyTags: int = 0
    detectedMines: int = 0
    commands: int = 1      # 0=never, 1=fade out, 2=always
    waypoints: int = 1
    tacticalPing: int = 0  # 0=disable, 1=enable

    # Personal awareness
    weaponInfo: int = 2
    stanceIndicator: int = 2
    staminaBar: int = 0
    weaponCrosshair: int = 0
    visionAid: int = 0

    # View
    thirdPersonView: int = 0   # 0=disabled, 1=enabled, 2=vehicles only
    cameraShake: int = 1

    # Multiplayer
    scoreTable: int = 1
    deathMessages: int = 1
    vonID: int = 1

    # Misc
    mapContent: int = 0
    autoReport: int = 0
    multipleSaves: int = 0


class CustomAILevel(BaseModel):
    skillAI: float = 0.5     # 0.0 – 1.0
    precisionAI: float = 0.5  # 0.0 – 1.0


class _DifficultyPresets(BaseModel):
    custom_difficulty: DifficultyOptions = DifficultyOptions()
    ai_level_preset: int = 3   # 0=Low, 1=Normal, 2=High, 3=Custom
    custom_ai_level: CustomAILevel = CustomAILevel()


class ServerProfileSchema(BaseModel):
    """Full .Arma3Profile schema — written only when forcedDifficulty = 'Custom'."""

    model_config = ConfigDict(extra="allow")

    difficulty: _DifficultyPresets = _DifficultyPresets()
