"""Tests for schema modules not covered by test_schemas.py."""
from __future__ import annotations

from app.schemas.basic_config import BANDWIDTH_PRESETS, BasicConfigSchema
from app.schemas.game_types import GAME_FEATURES, QUERY_TYPES, GameType, get_features
from app.schemas.server_config import (
    ServerConfigAdmin,
    ServerConfigHeadless,
    ServerConfigIdentity,
    ServerConfigNetworkQuality,
    ServerConfigVoting,
)
from app.schemas.ws import WsEnvelope


# ---------------------------------------------------------------------------
# BasicConfigSchema
# ---------------------------------------------------------------------------

def test_basic_config_defaults() -> None:
    cfg = BasicConfigSchema()
    assert cfg.MaxMsgSend == 128
    assert cfg.MaxSizeGuaranteed == 512
    assert cfg.sockets.maxPacketSize == 1400


def test_basic_config_allows_extra() -> None:
    cfg = BasicConfigSchema(customParam="yes")
    assert cfg.model_extra.get("customParam") == "yes"


def test_bandwidth_presets_exist() -> None:
    assert "home_1mbps" in BANDWIDTH_PRESETS
    assert "vps_10mbps" in BANDWIDTH_PRESETS
    assert "dedicated_100mbps" in BANDWIDTH_PRESETS
    assert "unlimited" in BANDWIDTH_PRESETS


def test_bandwidth_presets_are_valid() -> None:
    for name, preset in BANDWIDTH_PRESETS.items():
        assert isinstance(preset, BasicConfigSchema), f"{name} is not BasicConfigSchema"
        assert preset.MaxBandwidth >= preset.MinBandwidth


# ---------------------------------------------------------------------------
# GameType / get_features / QUERY_TYPES
# ---------------------------------------------------------------------------

def test_game_type_enum_values() -> None:
    values = {gt.value for gt in GameType}
    assert "arma3" in values
    assert "arma2oa" in values
    assert "ofp" in values


def test_game_features_all_games_present() -> None:
    for gt in GameType:
        assert gt.value in GAME_FEATURES or get_features(gt.value) == GAME_FEATURES["arma3"]


def test_arma3_features_workshop_true() -> None:
    assert GAME_FEATURES["arma3"]["workshop"] is True


def test_arma2_features_workshop_false() -> None:
    assert GAME_FEATURES["arma2"]["workshop"] is False


def test_query_types_all_games() -> None:
    for gt in GameType:
        if gt.value in QUERY_TYPES:
            assert isinstance(QUERY_TYPES[gt.value], str)


def test_get_features_returns_dict() -> None:
    result = get_features("arma3")
    assert isinstance(result, dict)


# ---------------------------------------------------------------------------
# ServerConfig sub-schemas
# ---------------------------------------------------------------------------

def test_server_config_identity_defaults() -> None:
    identity = ServerConfigIdentity()
    assert identity.hostname == ""
    assert identity.maxPlayers == 64
    assert identity.password is None


def test_server_config_admin_empty() -> None:
    admin = ServerConfigAdmin()
    assert admin.admins == []


def test_server_config_headless_empty() -> None:
    hc = ServerConfigHeadless()
    assert hc.headlessClients == []
    assert hc.localClient == []


def test_server_config_voting_defaults() -> None:
    v = ServerConfigVoting()
    assert v.voteThreshold == 0.5
    assert v.voteMissionPlayers == 1


def test_server_config_network_quality_defaults() -> None:
    nq = ServerConfigNetworkQuality()
    assert nq.kickDuplicate == 0
    assert nq.MaxPing == -1


# ---------------------------------------------------------------------------
# WsEnvelope
# ---------------------------------------------------------------------------

def test_ws_envelope_defaults() -> None:
    e = WsEnvelope(type="servers")
    assert e.serverId is None
    assert e.payload is None


def test_ws_envelope_with_all_fields() -> None:
    e = WsEnvelope(type="status", serverId="srv-1", payload={"pid": 1234})
    assert e.type == "status"
    assert e.serverId == "srv-1"
    assert e.payload["pid"] == 1234
