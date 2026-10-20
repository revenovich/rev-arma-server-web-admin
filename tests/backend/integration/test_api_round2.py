"""Integration tests for the bugs found by the second end-to-end round (PROJECT_HEALTH P29-P41).

Each test drives the real HTTP API of a real app, with a throwaway game directory.
"""
from __future__ import annotations

import base64
import json
import os
import stat
import time
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


def _make_app(tmp_path: Path, servers: list[dict] | None = None, auth: dict | None = None):
    from app.main import create_app

    config: dict = {"game": "arma3", "path": str(tmp_path), "type": "linux"}
    if auth:
        config["auth"] = auth
    config_file = tmp_path / "config.json"
    config_file.write_text(json.dumps(config, ensure_ascii=False), encoding="utf-8")
    servers_json = tmp_path / "servers.json"
    servers_json.write_text(json.dumps(servers or []), encoding="utf-8")
    return create_app(config_path=config_file), servers_json


@pytest.fixture()
def api(tmp_path: Path):
    app, servers_json = _make_app(tmp_path)
    with patch("app.domain.manager.SERVERS_JSON", servers_json):
        with TestClient(app, raise_server_exceptions=True) as c:
            yield c


def _fake_binary(tmp_path: Path, body: str) -> None:
    script = tmp_path / "arma3server"
    script.write_text("#!/bin/sh\n" + body + "\n", encoding="utf-8")
    script.chmod(script.stat().st_mode | stat.S_IEXEC)


# --- P29: default ports, port overlaps, failed starts and unexpected exits ---

def test_new_servers_without_a_port_get_free_ports(api: TestClient) -> None:
    a = api.post("/api/servers/", json={"title": "A"}).json()
    b = api.post("/api/servers/", json={"title": "B"}).json()
    assert a["port"] == 2302
    # Arma 3 uses game port .. game port + 4, so the next server must not overlap
    assert abs(b["port"] - a["port"]) >= 5


def test_create_with_overlapping_port_is_rejected(api: TestClient) -> None:
    api.post("/api/servers/", json={"title": "A", "port": 2302})
    resp = api.post("/api/servers/", json={"title": "B", "port": 2304})
    assert resp.status_code == 409
    assert "2302" in resp.json()["detail"]


def test_update_to_overlapping_port_is_rejected(api: TestClient) -> None:
    api.post("/api/servers/", json={"title": "A", "port": 2302})
    api.post("/api/servers/", json={"title": "B", "port": 2402})
    resp = api.put("/api/servers/b", json={"port": 2303})
    assert resp.status_code == 409
    assert api.get("/api/servers/b").json()["port"] == 2402


@pytest.mark.skipif(os.name == "nt", reason="uses a POSIX shell script as the server binary")
def test_start_with_missing_binary_returns_error(api: TestClient) -> None:
    api.post("/api/servers/", json={"title": "A"})
    resp = api.post("/api/servers/a/start")
    assert resp.status_code == 500
    assert "arma3server" in resp.json()["detail"]


@pytest.mark.skipif(os.name == "nt", reason="uses a POSIX shell script as the server binary")
def test_unexpected_exit_is_published(api: TestClient, tmp_path: Path) -> None:
    _fake_binary(tmp_path, "exit 3")
    api.post("/api/servers/", json={"title": "A"})
    with api.websocket_connect("/ws") as ws:
        for _ in range(4):  # initial snapshot: servers, mods, missions, settings
            ws.receive_json()
        assert api.post("/api/servers/a/start").json()["status"] == "ok"
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            msg = ws.receive_json()
            if msg["type"] == "server_exited":
                break
        assert msg["type"] == "server_exited"
        assert msg["serverId"] == "a"
        assert msg["payload"]["returncode"] == 3
        assert msg["payload"]["title"] == "A"


# --- P34 / P38 / P40 / P7: validation, runtime keys and duplicate titles ---

@pytest.mark.parametrize(
    "body",
    [
        {"title": 123},
        {"title": "x", "port": "abc"},
        {"title": "x", "mods": "@CBA"},
        {"title": "x", "missions": "x"},
        {"title": "x", "port": -5},
        {"title": "x", "port": 70000},
        {"title": "x", "port": 65535},
        {"title": "x", "max_players": -1},
        {"title": "x", "number_of_headless_clients": -3},
        {"title": "!!!"},
        {"title": "   "},
    ],
)
def test_invalid_create_bodies_get_422(api: TestClient, body: dict) -> None:
    resp = api.post("/api/servers/", json=body)
    assert resp.status_code == 422, resp.text
    assert api.get("/api/servers/").json() == []


def test_invalid_update_is_rejected_and_not_persisted(api: TestClient) -> None:
    api.post("/api/servers/", json={"title": "A"})
    resp = api.put("/api/servers/a", json={"port": "not-a-number", "max_players": "lots"})
    assert resp.status_code == 422
    assert api.get("/api/servers/a").json()["max_players"] == 32


def test_runtime_keys_are_not_persisted(api: TestClient, tmp_path: Path) -> None:
    api.post("/api/servers/", json={"title": "A", "id": "other", "pid": 999, "state": {"online": True}})
    api.put("/api/servers/a", json={"pid": 5, "state": None, "id": "zzz"})
    stored = json.loads((tmp_path / "servers.json").read_text(encoding="utf-8"))[0]
    assert not {"id", "pid", "state"} & stored.keys()
    assert api.get("/api/servers/a").json()["pid"] is None


def test_duplicate_title_is_rejected_on_create(api: TestClient) -> None:
    api.post("/api/servers/", json={"title": "A", "password": "first"})
    resp = api.post("/api/servers/", json={"title": "a"})  # same slug
    assert resp.status_code == 409
    assert api.get("/api/servers/a").json()["password"] == "first"


def test_rename_onto_another_server_is_rejected(api: TestClient) -> None:
    api.post("/api/servers/", json={"title": "A"})
    api.post("/api/servers/", json={"title": "B"})
    resp = api.put("/api/servers/b", json={"title": "A"})
    assert resp.status_code == 409
    assert [s["id"] for s in api.get("/api/servers/").json()] == ["a", "b"]


# --- P33: long titles ---

def test_long_title_gets_an_id_that_fits_a_file_name(api: TestClient) -> None:
    resp = api.post("/api/servers/", json={"title": "A" * 300})
    assert resp.status_code == 201
    server_id = resp.json()["id"]
    assert 0 < len(server_id) <= 100
    assert api.get(f"/api/servers/{server_id}").status_code == 200


# --- P39: config files left behind ---

@pytest.mark.skipif(os.name == "nt", reason="uses a POSIX shell script as the server binary")
def test_rename_and_delete_remove_old_config_files(api: TestClient, tmp_path: Path) -> None:
    _fake_binary(tmp_path, "sleep 30")
    api.post("/api/servers/", json={"title": "A", "password": "secret"})
    api.post("/api/servers/a/start")
    api.post("/api/servers/a/stop")
    assert (tmp_path / "a.cfg").exists()

    api.put("/api/servers/a", json={"title": "Renamed"})
    assert not (tmp_path / "a.cfg").exists()

    api.post("/api/servers/renamed/start")
    api.post("/api/servers/renamed/stop")
    assert (tmp_path / "renamed.cfg").exists()
    api.delete("/api/servers/renamed")
    assert not (tmp_path / "renamed.cfg").exists()


# --- P36: missing mods ---

@pytest.mark.skipif(os.name == "nt", reason="uses a POSIX shell script as the server binary")
def test_missing_and_unsafe_mods_are_left_out_of_the_launch(api: TestClient, tmp_path: Path) -> None:
    args_file = tmp_path / "args.txt"
    _fake_binary(tmp_path, f'printf "%s\\n" "$@" > "{args_file}"; sleep 30')
    (tmp_path / "@CBA_A3" / "addons").mkdir(parents=True)
    (tmp_path / "@My Mod;Evil" / "addons").mkdir(parents=True)
    api.post("/api/servers/", json={"title": "A", "mods": ["@CBA_A3", "@Gone", "@My Mod;Evil"]})

    resp = api.post("/api/servers/a/start").json()
    assert resp["skipped_mods"] == ["@Gone", "@My Mod;Evil"]
    for _ in range(50):
        if args_file.exists() and args_file.read_text():
            break
        time.sleep(0.1)
    api.post("/api/servers/a/stop")
    assert "-mod=@CBA_A3" in args_file.read_text().splitlines()


# --- P31 / P37: missions ---

def test_deleting_a_missing_mission_is_404(api: TestClient) -> None:
    assert api.delete("/api/missions/co.pbo").status_code == 404


def test_mission_with_hash_in_name_can_be_deleted_when_encoded(api: TestClient, tmp_path: Path) -> None:
    (tmp_path / "mpmissions").mkdir()
    (tmp_path / "mpmissions" / "co#1?x.altis.pbo").write_bytes(b"x")
    assert api.delete("/api/missions/co%231%3Fx.altis.pbo").status_code == 200
    assert not (tmp_path / "mpmissions" / "co#1?x.altis.pbo").exists()


def test_reupload_with_different_case_replaces_existing_file(api: TestClient, tmp_path: Path) -> None:
    (tmp_path / "mpmissions").mkdir()
    (tmp_path / "mpmissions" / "dm_test.VR.pbo").write_bytes(b"old")
    resp = api.post("/api/missions/", files=[("files", ("dm_test.VR.pbo", b"new"))])
    assert resp.json()["uploaded"] == ["dm_test.VR.pbo"]
    assert sorted(p.name for p in (tmp_path / "mpmissions").iterdir()) == ["dm_test.VR.pbo"]
    assert (tmp_path / "mpmissions" / "dm_test.VR.pbo").read_bytes() == b"new"


@pytest.mark.parametrize("name,data", [("empty.Altis.pbo", b""), (".pbo", b"x"), ("readme.txt", b"x")])
def test_bad_mission_uploads_are_rejected(api: TestClient, tmp_path: Path, name: str, data: bytes) -> None:
    resp = api.post("/api/missions/", files=[("files", (name, data))])
    assert resp.status_code == 400
    assert not (tmp_path / "mpmissions").exists() or not any((tmp_path / "mpmissions").iterdir())


# --- P35: presets ---

@pytest.mark.parametrize("data", [b"not html \x00\x01\xff\xfe", b"\xff" * 1000], ids=["binary", "invalid-utf8"])
def test_bad_preset_upload_is_400_and_leaves_no_temp_file(api: TestClient, data: bytes) -> None:
    import tempfile

    before = set(Path(tempfile.gettempdir()).glob("tmp*.html"))
    resp = api.post("/api/presets/upload", files=[("files", ("bad.html", data))])
    assert resp.status_code == 400
    assert set(Path(tempfile.gettempdir()).glob("tmp*.html")) == before


# --- P41: unknown API paths ---

def test_unknown_api_path_is_404_json_not_the_spa(api: TestClient, tmp_path: Path) -> None:
    import app.main as main_module

    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html>", encoding="utf-8")
    with patch.object(main_module, "_FRONTEND_DIST", dist):
        app, servers_json = _make_app(tmp_path)
        with patch("app.domain.manager.SERVERS_JSON", servers_json), TestClient(app) as c:
            assert c.get("/api/nope").status_code == 404
            assert c.get("/api/nope").headers["content-type"].startswith("application/json")
            assert c.get("/some/page").text == "<!doctype html>"


# --- P32: non-ASCII passwords ---

def test_non_ascii_password_works_over_http_and_ws(tmp_path: Path) -> None:
    import app.api as auth_module

    auth_module._fail_counts.clear()
    auth_module._fail_times.clear()
    app, servers_json = _make_app(tmp_path, auth={"username": "admin", "password": "пароль"})
    token = base64.b64encode("admin:пароль".encode()).decode()
    with patch("app.domain.manager.SERVERS_JSON", servers_json), TestClient(app) as c:
        assert c.get("/api/servers/", headers={"Authorization": f"Basic {token}"}).status_code == 200
        with c.websocket_connect(f"/ws?token={token}") as ws:
            assert ws.receive_json()["type"] == "servers"
        assert c.get("/api/servers/", auth=("admin", "wrong")).status_code == 401
    auth_module._fail_counts.clear()
    auth_module._fail_times.clear()


# --- P23: the /config route renames through the manager ---

def test_config_route_rename_rekeys_the_server(api: TestClient) -> None:
    api.post("/api/servers/", json={"title": "A"})
    resp = api.put("/api/servers/a/config", json={"title": "Renamed"})
    assert resp.status_code == 200
    assert resp.json()["id"] == "renamed"
    assert api.get("/api/servers/renamed").status_code == 200
    assert api.get("/api/servers/a").status_code == 404
    assert api.put("/api/servers/renamed/config", json={"port": "x"}).status_code == 422
