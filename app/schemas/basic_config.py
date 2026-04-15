from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class _SocketsConfig(BaseModel):
    maxPacketSize: int = 1400


class BasicConfigSchema(BaseModel):
    """basic.cfg / Arma3.cfg — network performance tuning."""

    model_config = ConfigDict(extra="allow")

    MaxMsgSend: int = 128
    MaxSizeGuaranteed: int = 512
    MaxSizeNonguaranteed: int = 256
    MinBandwidth: int = 131072
    MaxBandwidth: int = 10_000_000_000
    MinErrorToSend: float = 0.001
    MinErrorToSendNear: float = 0.01
    MaxCustomFileSize: int = 0

    sockets: _SocketsConfig = _SocketsConfig()


# One-click bandwidth presets for the UI
BANDWIDTH_PRESETS: dict[str, BasicConfigSchema] = {
    "home_1mbps": BasicConfigSchema(
        MinBandwidth=131_072,
        MaxBandwidth=1_000_000,
        MaxMsgSend=128,
    ),
    "vps_10mbps": BasicConfigSchema(
        MinBandwidth=768_000,
        MaxBandwidth=10_000_000,
        MaxMsgSend=256,
    ),
    "dedicated_100mbps": BasicConfigSchema(
        MinBandwidth=5_000_000,
        MaxBandwidth=100_000_000,
        MaxMsgSend=512,
    ),
    "unlimited": BasicConfigSchema(
        MinBandwidth=131_072,
        MaxBandwidth=10_000_000_000,
        MaxMsgSend=128,
    ),
}
