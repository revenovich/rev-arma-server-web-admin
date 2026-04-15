from __future__ import annotations

from pathlib import Path

from app.schemas.basic_config import BasicConfigSchema


def write_basic_cfg(dest: Path, cfg: BasicConfigSchema | None = None) -> None:
    """Write basic.cfg / Arma3.cfg from BasicConfigSchema."""
    if cfg is None:
        cfg = BasicConfigSchema()

    lines = [
        f"MaxMsgSend = {cfg.MaxMsgSend};",
        f"MaxSizeGuaranteed = {cfg.MaxSizeGuaranteed};",
        f"MaxSizeNonguaranteed = {cfg.MaxSizeNonguaranteed};",
        f"MinBandwidth = {cfg.MinBandwidth};",
        f"MaxBandwidth = {cfg.MaxBandwidth};",
        f"MinErrorToSend = {cfg.MinErrorToSend};",
        f"MinErrorToSendNear = {cfg.MinErrorToSendNear};",
        f"MaxCustomFileSize = {cfg.MaxCustomFileSize};",
        "",
        "class sockets {",
        f"    maxPacketSize = {cfg.sockets.maxPacketSize};",
        "};",
    ]

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")
