"""Integration tests for /api/missions."""
from __future__ import annotations

import errno
import io
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    from app.main import create_app

    config_file = tmp_path / "config.json"
    config_file.write_text(
        json.dumps({"game": "arma3", "path": str(tmp_path), "type": "linux"}),
        encoding="utf-8",
    )
    app = create_app(config_path=config_file)
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture()
def client_with_mission(tmp_path: Path) -> tuple[TestClient, Path]:
    from app.main import create_app

    config_file = tmp_path / "config.json"
    config_file.write_text(
        json.dumps({"game": "arma3", "path": str(tmp_path), "type": "linux"}),
        encoding="utf-8",
    )
    missions_dir = tmp_path / "mpmissions"
    missions_dir.mkdir()
    (missions_dir / "co_10_escape.altis.pbo").write_bytes(b"fake pbo")

    app = create_app(config_path=config_file)
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c, tmp_path


# ---------------------------------------------------------------------------
# GET /api/missions/
# ---------------------------------------------------------------------------

def test_list_missions_empty(client: TestClient) -> None:
    resp = client.get("/api/missions/")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_missions_returns_mission(client_with_mission: tuple) -> None:
    c, _ = client_with_mission
    resp = c.get("/api/missions/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "co_10_escape.altis.pbo"
    assert "size" in data[0]
    assert "sizeFormatted" in data[0]


# ---------------------------------------------------------------------------
# POST /api/missions/ (upload)
# ---------------------------------------------------------------------------

def test_upload_mission_valid_pbo(client: TestClient, tmp_path: Path) -> None:
    resp = client.post(
        "/api/missions/",
        files=[("files", ("test.Altis.pbo", io.BytesIO(b"pbo data"), "application/octet-stream"))],
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "uploaded" in data
    assert "test.altis.pbo" in data["uploaded"]


def test_upload_mission_skips_non_pbo(client: TestClient) -> None:
    resp = client.post(
        "/api/missions/",
        files=[("files", ("notes.txt", io.BytesIO(b"text"), "text/plain"))],
    )
    assert resp.status_code == 201
    assert resp.json()["uploaded"] == []


def test_upload_mission_too_many_files(client: TestClient) -> None:
    files = [
        ("files", (f"mission_{i}.pbo", io.BytesIO(b"x"), "application/octet-stream"))
        for i in range(65)
    ]
    resp = client.post("/api/missions/", files=files)
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# GET /api/missions/{filename} (download)
# ---------------------------------------------------------------------------

def test_download_mission_returns_file(client_with_mission: tuple) -> None:
    c, _ = client_with_mission
    resp = c.get("/api/missions/co_10_escape.altis.pbo")
    assert resp.status_code == 200
    assert resp.content == b"fake pbo"


def test_download_mission_not_found(client: TestClient) -> None:
    resp = client.get("/api/missions/ghost.pbo")
    assert resp.status_code == 404


def test_download_mission_invalid_extension_not_found(client: TestClient) -> None:
    # Any filename that doesn't exist → 404.  Path traversal is neutralised at
    # the HTTP layer (URL normalization) before the handler sees it.
    resp = client.get("/api/missions/nonexistent.pbo")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/missions/{filename}
# ---------------------------------------------------------------------------

def test_delete_mission(client_with_mission: tuple) -> None:
    c, tmp_path = client_with_mission
    resp = c.delete("/api/missions/co_10_escape.altis.pbo")
    assert resp.status_code == 200
    assert resp.json()["deleted"] == "co_10_escape.altis.pbo"
    assert not (tmp_path / "mpmissions" / "co_10_escape.altis.pbo").exists()


def test_delete_mission_path_traversal_rejected(client: TestClient) -> None:
    # FastAPI normalizes URLs — traversal either gets rejected (400) or routes nowhere (404/405)
    resp = client.delete("/api/missions/../../etc/passwd")
    assert resp.status_code in (400, 404, 405)


# ---------------------------------------------------------------------------
# POST /api/missions/refresh
# ---------------------------------------------------------------------------

def test_refresh_missions(client_with_mission: tuple) -> None:
    c, _ = client_with_mission
    resp = c.post("/api/missions/refresh")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ---------------------------------------------------------------------------
# POST /api/missions/workshop
# ---------------------------------------------------------------------------

def test_workshop_requires_id(client: TestClient) -> None:
    resp = client.post("/api/missions/workshop", json={})
    assert resp.status_code == 400


def test_workshop_requires_numeric_id(client: TestClient) -> None:
    resp = client.post("/api/missions/workshop", json={"id": "not-a-number"})
    assert resp.status_code == 400


def test_workshop_download_success(client: TestClient) -> None:
    with patch(
        "app.services.workshop.download_workshop_mission",
        new_callable=AsyncMock,
        return_value=True,
    ):
        resp = client.post("/api/missions/workshop", json={"id": "450814997"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_workshop_download_failure_returns_502(client: TestClient) -> None:
    with patch(
        "app.services.workshop.download_workshop_mission",
        new_callable=AsyncMock,
        return_value=False,
    ):
        resp = client.post("/api/missions/workshop", json={"id": "450814997"})
    assert resp.status_code == 502


# ---------------------------------------------------------------------------
# Path traversal (S1): only the last component of the upload filename is used
# ---------------------------------------------------------------------------

def _upload(client: TestClient, filename: str, content: bytes = b"pbo") -> object:
    return client.post(
        "/api/missions/",
        files=[("files", (filename, io.BytesIO(content), "application/octet-stream"))],
    )


@pytest.mark.parametrize(
    ("filename", "stored"),
    [
        ("../escaped.pbo", "escaped.pbo"),
        ("mpmissions/../../Escaped.Altis.pbo", "escaped.altis.pbo"),
        ("..\\..\\win_escaped.pbo", "win_escaped.pbo"),
        ("C:\\Users\\me\\Desktop\\desk.pbo", "desk.pbo"),
    ],
)
def test_upload_mission_traversal_lands_in_mpmissions(
    client: TestClient, tmp_path: Path, filename: str, stored: str
) -> None:
    resp = _upload(client, filename)
    assert resp.status_code == 201
    assert resp.json()["uploaded"] == [stored]
    assert (tmp_path / "mpmissions" / stored).read_bytes() == b"pbo"
    assert sorted(p.name for p in tmp_path.iterdir()) == ["config.json", "mpmissions"]


def test_upload_mission_absolute_filename_lands_in_mpmissions(
    client: TestClient, tmp_path: Path
) -> None:
    resp = _upload(client, str(tmp_path / "abs_escaped.pbo"))
    assert resp.status_code == 201
    assert resp.json()["uploaded"] == ["abs_escaped.pbo"]
    assert (tmp_path / "mpmissions" / "abs_escaped.pbo").exists()
    assert not (tmp_path / "abs_escaped.pbo").exists()


@pytest.mark.skipif(sys.platform == "win32", reason="Creating symlinks needs privileges on Windows")
def test_upload_mission_rejects_symlink_out_of_mpmissions(
    client: TestClient, tmp_path: Path
) -> None:
    missions = tmp_path / "mpmissions"
    missions.mkdir()
    outside = tmp_path / "outside.pbo"
    outside.write_bytes(b"original")
    (missions / "evil.pbo").symlink_to(outside)
    resp = _upload(client, "evil.pbo")
    assert resp.status_code == 400
    assert outside.read_bytes() == b"original"


def test_upload_mission_survives_cross_device_move(client: TestClient, tmp_path: Path) -> None:
    # The temp dir and the game dir on different filesystems/drives (EXDEV / WinError 17).
    exdev = OSError(errno.EXDEV, "Invalid cross-device link")
    with patch("os.rename", side_effect=exdev):
        resp = _upload(client, "cross.pbo")
    assert resp.status_code == 201
    assert (tmp_path / "mpmissions" / "cross.pbo").read_bytes() == b"pbo"


# ---------------------------------------------------------------------------
# Path traversal (S6): download/delete must stay inside mpmissions, not just
# share its prefix (mpmissions_old)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("method", ["get", "delete"])
def test_mission_backslash_traversal_rejected(client_with_mission: tuple, method: str) -> None:
    # On Windows a single URL segment can carry ..\mpmissions_old\secret.pbo.
    c, tmp_path = client_with_mission
    secret = tmp_path / "mpmissions_old" / "secret.pbo"
    secret.parent.mkdir()
    secret.write_bytes(b"secret")
    resp = getattr(c, method)("/api/missions/..%5Cmpmissions_old%5Csecret.pbo")
    assert resp.status_code == 400
    assert secret.read_bytes() == b"secret"


@pytest.mark.skipif(sys.platform == "win32", reason="Creating symlinks needs privileges on Windows")
@pytest.mark.parametrize("method", ["get", "delete"])
def test_mission_resolving_into_sibling_dir_rejected(
    client_with_mission: tuple, method: str
) -> None:
    c, tmp_path = client_with_mission
    secret = tmp_path / "mpmissions_old" / "secret.pbo"
    secret.parent.mkdir()
    secret.write_bytes(b"secret")
    link = tmp_path / "mpmissions" / "link.pbo"
    link.symlink_to(secret)
    resp = getattr(c, method)("/api/missions/link.pbo")
    assert resp.status_code == 400
    assert secret.read_bytes() == b"secret"
    assert link.is_symlink()
