"""Unit tests for config writer output — ensures server.cfg is well-formed."""
from __future__ import annotations

from pathlib import Path

from app.core.config import Settings
from app.domain.config_writer.server_config import write_server_cfg
from app.schemas.server import ServerSchema


def _make_server(**overrides) -> ServerSchema:
    """Create a minimal ServerSchema with defaults."""
    defaults = dict(
        title="Test Server",
        port=2302,
        password="",
        admin_password="",
        max_players=32,
        persistent=False,
        von=True,
        battle_eye=False,
        verify_signatures=0,
        allowed_file_patching=0,
        forcedDifficulty=None,
        missions=[],
        mods=[],
        motd=None,
        number_of_headless_clients=0,
        parameters=[],
        additionalConfigurationOptions=None,
        kick_duplicate=1,
        serverCommandPassword="",
    )
    defaults.update(overrides)
    return ServerSchema(**defaults)


def _make_settings(**overrides) -> Settings:
    """Create minimal Settings."""
    defaults = dict(
        game="arma3",
        path="/tmp/arma",
        port=2302,
        type="linux",
    )
    defaults.update(overrides)
    return Settings(**defaults)


class TestWriteServerCfg:
    def test_writes_hostname(self, tmp_path: Path) -> None:
        server = _make_server(title="My Arma Server")
        settings = _make_settings()
        dest = tmp_path / "server.cfg"
        write_server_cfg(server, settings, dest)

        content = dest.read_text()
        assert 'hostname = "My Arma Server";' in content

    def test_writes_password_fields(self, tmp_path: Path) -> None:
        server = _make_server(password="secret", admin_password="admin123")
        settings = _make_settings()
        dest = tmp_path / "server.cfg"
        write_server_cfg(server, settings, dest)

        content = dest.read_text()
        assert 'password = "secret";' in content
        assert 'passwordAdmin = "admin123";' in content

    def test_writes_max_players(self, tmp_path: Path) -> None:
        server = _make_server(max_players=64)
        settings = _make_settings()
        dest = tmp_path / "server.cfg"
        write_server_cfg(server, settings, dest)

        content = dest.read_text()
        assert "maxPlayers = 64;" in content

    def test_writes_mission_rotation(self, tmp_path: Path) -> None:
        server = _make_server(missions=["co_10.invasion.altis", "co_12_liberation.stratis"])
        settings = _make_settings()
        dest = tmp_path / "server.cfg"
        write_server_cfg(server, settings, dest)

        content = dest.read_text()
        assert "co_10.invasion.altis" in content
        assert "co_12_liberation.stratis" in content

    def test_prefix_suffix(self, tmp_path: Path) -> None:
        server = _make_server(title="Test")
        settings = _make_settings(prefix="[CLAN] ", suffix=" - Public")
        dest = tmp_path / "server.cfg"
        write_server_cfg(server, settings, dest)

        content = dest.read_text()
        assert 'hostname = "[CLAN] Test - Public";' in content

    def test_writes_motd_multiline(self, tmp_path: Path) -> None:
        server = _make_server(motd="Welcome\nEnjoy your stay")
        settings = _make_settings()
        dest = tmp_path / "server.cfg"
        write_server_cfg(server, settings, dest)

        content = dest.read_text()
        assert "Welcome" in content
        assert "Enjoy your stay" in content

    def test_writes_headless_clients(self, tmp_path: Path) -> None:
        server = _make_server(number_of_headless_clients=2)
        settings = _make_settings()
        dest = tmp_path / "server.cfg"
        write_server_cfg(server, settings, dest)

        content = dest.read_text()
        assert 'headlessClients[] = {"127.0.0.1"};' in content
        assert 'localClient[] = {"127.0.0.1"};' in content

    def test_file_created(self, tmp_path: Path) -> None:
        server = _make_server()
        settings = _make_settings()
        dest = tmp_path / "server.cfg"
        write_server_cfg(server, settings, dest)

        assert dest.exists()
        assert dest.stat().st_size > 0

    def test_writes_mission_with_difficulty(self, tmp_path: Path) -> None:
        server = _make_server(
            missions=[
                {"template": "co_10_escape.altis", "difficulty": "Veteran"},
            ],
        )
        settings = _make_settings()
        dest = tmp_path / "server.cfg"
        write_server_cfg(server, settings, dest)

        content = dest.read_text()
        assert 'template = "co_10_escape.altis";' in content
        assert 'difficulty = "Veteran";' in content

    def test_writes_mission_with_extra_params(self, tmp_path: Path) -> None:
        server = _make_server(
            missions=[
                {
                    "template": "co_10_escape.altis",
                    "difficulty": "Custom",
                    "params": ['viewDistance = 3000', 'respawn = "BASE"'],
                },
            ],
        )
        settings = _make_settings()
        dest = tmp_path / "server.cfg"
        write_server_cfg(server, settings, dest)

        content = dest.read_text()
        assert 'template = "co_10_escape.altis";' in content
        assert 'difficulty = "Custom";' in content
        assert "viewDistance = 3000" in content
        assert 'respawn = "BASE"' in content
