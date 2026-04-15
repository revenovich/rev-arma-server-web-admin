from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class ServerConfigIdentity(BaseModel):
    hostname: str = ""
    password: str | None = None
    passwordAdmin: str | None = None
    serverCommandPassword: str | None = None
    maxPlayers: int = 64
    motd: list[str] = []
    motdInterval: float = 5.0


class ServerConfigAdmin(BaseModel):
    admins: list[str] = []


class ServerConfigHeadless(BaseModel):
    headlessClients: list[str] = []
    localClient: list[str] = []


class ServerConfigVoting(BaseModel):
    voteThreshold: float = 0.5
    voteMissionPlayers: int = 1
    allowedVoteCmds: list[dict[str, Any]] = []
    allowedVotedAdminCmds: list[dict[str, Any]] = []


class ServerConfigNetworkQuality(BaseModel):
    kickDuplicate: int = 0
    loopback: int = 0
    upnp: int = 0
    MaxPing: int = -1
    MaxPacketLoss: int = -1
    MaxDesync: int = -1
    DisconnectTimeout: int = 15
    kickClientsOnSlowNetwork: list[int] = [1, 1, 1, 1]


class ServerConfigTimeouts(BaseModel):
    kickTimeout: list[list[int]] = [[0, 60], [1, 60], [2, 60], [3, 60]]
    votingTimeOut: list[int] = [60, 90]
    roleTimeOut: list[int] = [90, 120]
    briefingTimeOut: list[int] = [60, 90]
    debriefingTimeOut: list[int] = [45, 60]
    lobbyIdleTimeout: int = 0


class ServerConfigVon(BaseModel):
    disableVoN: int = 0
    vonCodec: int = 1
    vonCodecQuality: int = 3


class ServerConfigSecurity(BaseModel):
    verifySignatures: int = 2
    equalModRequired: int = 0
    allowedFilePatching: int = 0
    filePatchingExceptions: list[str] = []
    allowedLoadFileExtensions: list[str] = []
    allowedPreprocessFileExtensions: list[str] = []
    allowedHTMLLoadExtensions: list[str] = []
    allowedHTMLLoadURIs: list[str] = []


class ServerConfigGameplay(BaseModel):
    persistent: int = 0
    forcedDifficulty: str | None = None
    skipLobby: bool = False
    allowProfileGlasses: bool = True
    drawingInMap: bool = True
    forceRotorLibSimulation: int = 0
    requiredBuild: int = 0
    autoSelectMission: bool = False
    randomMissionOrder: bool = False


class ServerConfigMissionRotation(BaseModel):
    missions: list[dict[str, Any]] | None = None
    missionWhitelist: list[str] = []


class ServerConfigLifecycle(BaseModel):
    missionsToServerRestart: int = 0
    missionsToShutdown: int = 0


class ServerConfigAntiFlood(BaseModel):
    cycleTime: float = 0.5
    cycleLimit: int = 400
    cycleHardLimit: int = 4000
    enableKick: int = 0


class ServerConfigAdvanced(BaseModel):
    steamProtocolMaxDataSize: int = 1024
    timeStampFormat: str = ""
    statisticsEnabled: int = 1
    enablePlayerDiag: int = 0
    callExtReportLimit: int = 1000
    disableChannels: list[list[Any]] = []
    logFile: str = ""
    BattlEye: int = 1


class ServerConfigScripting(BaseModel):
    onUserConnected: str = ""
    onUserDisconnected: str = ""
    doubleIdDetected: str = ""
    onHackedData: str = ""
    onDifferentData: str = ""
    onUnsignedData: str = ""
    onUserKicked: str = ""
    regularCheck: str = ""


class ServerConfigFull(BaseModel):
    """Complete server.cfg model — all documented Arma 3 parameters."""

    model_config = ConfigDict(extra="allow")

    identity: ServerConfigIdentity = ServerConfigIdentity()
    admin: ServerConfigAdmin = ServerConfigAdmin()
    headless: ServerConfigHeadless = ServerConfigHeadless()
    voting: ServerConfigVoting = ServerConfigVoting()
    network_quality: ServerConfigNetworkQuality = ServerConfigNetworkQuality()
    timeouts: ServerConfigTimeouts = ServerConfigTimeouts()
    von: ServerConfigVon = ServerConfigVon()
    security: ServerConfigSecurity = ServerConfigSecurity()
    gameplay: ServerConfigGameplay = ServerConfigGameplay()
    mission_rotation: ServerConfigMissionRotation = ServerConfigMissionRotation()
    lifecycle: ServerConfigLifecycle = ServerConfigLifecycle()
    anti_flood: ServerConfigAntiFlood = ServerConfigAntiFlood()
    advanced: ServerConfigAdvanced = ServerConfigAdvanced()
    scripting: ServerConfigScripting = ServerConfigScripting()
    additional_configuration_options: str | None = None
