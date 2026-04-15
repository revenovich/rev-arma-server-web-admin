"""Tests for preset_parser — parse Arma Launcher .html exports."""
from __future__ import annotations

import textwrap
from pathlib import Path

from app.services.preset_parser import parse_modlist_html

# Minimal but realistic Arma 3 Launcher preset HTML
_PRESET_HTML = textwrap.dedent("""\
    <html>
    <head><title>My Test Preset</title></head>
    <body>
    <table>
      <tr data-type="ModContainer">
        <td data-type="DisplayName">@CBA_A3</td>
        <td>
          <span class="from-steam"></span>
          <a data-type="Link" href="https://steamcommunity.com/sharedfiles/filedetails/?id=450814997">Steam</a>
        </td>
      </tr>
      <tr data-type="ModContainer">
        <td data-type="DisplayName">@ACE</td>
        <td>
          <span class="from-steam"></span>
          <a data-type="Link" href="https://steamcommunity.com/sharedfiles/filedetails/?id=463939057">Steam</a>
        </td>
      </tr>
      <tr data-type="ModContainer">
        <td data-type="DisplayName">@LocalMod</td>
        <td>
          <span class="from-local"></span>
        </td>
      </tr>
    </table>
    </body>
    </html>
""")

# Preset with no title — should fall back to filename stem
_NO_TITLE_HTML = textwrap.dedent("""\
    <html>
    <head></head>
    <body>
    <table>
      <tr data-type="ModContainer">
        <td data-type="DisplayName">@SomeMod</td>
        <td><span class="from-steam"></span></td>
      </tr>
    </table>
    </body>
    </html>
""")


def test_parse_mod_count(tmp_path: Path) -> None:
    f = tmp_path / "preset.html"
    f.write_text(_PRESET_HTML, encoding="utf-8")
    preset = parse_modlist_html(f)
    assert preset.mod_count == 3
    assert len(preset.mods) == 3


def test_parse_mod_names(tmp_path: Path) -> None:
    f = tmp_path / "preset.html"
    f.write_text(_PRESET_HTML, encoding="utf-8")
    preset = parse_modlist_html(f)
    names = [m.name for m in preset.mods]
    assert "@CBA_A3" in names
    assert "@ACE" in names
    assert "@LocalMod" in names


def test_parse_steam_ids(tmp_path: Path) -> None:
    f = tmp_path / "preset.html"
    f.write_text(_PRESET_HTML, encoding="utf-8")
    preset = parse_modlist_html(f)
    cba = next(m for m in preset.mods if m.name == "@CBA_A3")
    ace = next(m for m in preset.mods if m.name == "@ACE")
    local = next(m for m in preset.mods if m.name == "@LocalMod")

    assert cba.steam_id == "450814997"
    assert ace.steam_id == "463939057"
    assert local.steam_id is None


def test_parse_source_classification(tmp_path: Path) -> None:
    f = tmp_path / "preset.html"
    f.write_text(_PRESET_HTML, encoding="utf-8")
    preset = parse_modlist_html(f)
    cba = next(m for m in preset.mods if m.name == "@CBA_A3")
    local = next(m for m in preset.mods if m.name == "@LocalMod")

    assert cba.source == "steam"
    assert local.source == "local"


def test_parse_preset_name_from_title(tmp_path: Path) -> None:
    f = tmp_path / "myfile.html"
    f.write_text(_PRESET_HTML, encoding="utf-8")
    preset = parse_modlist_html(f)
    assert preset.preset_name == "My Test Preset"


def test_parse_preset_name_falls_back_to_stem(tmp_path: Path) -> None:
    f = tmp_path / "fallback_preset.html"
    f.write_text(_NO_TITLE_HTML, encoding="utf-8")
    preset = parse_modlist_html(f)
    assert preset.preset_name == "fallback_preset"


def test_parse_source_file_is_filename(tmp_path: Path) -> None:
    f = tmp_path / "preset.html"
    f.write_text(_PRESET_HTML, encoding="utf-8")
    preset = parse_modlist_html(f)
    assert preset.source_file == "preset.html"


def test_parse_empty_preset(tmp_path: Path) -> None:
    html = "<html><head><title>Empty</title></head><body><table></table></body></html>"
    f = tmp_path / "empty.html"
    f.write_text(html, encoding="utf-8")
    preset = parse_modlist_html(f)
    assert preset.mod_count == 0
    assert preset.mods == []


def test_parse_url_preserved(tmp_path: Path) -> None:
    f = tmp_path / "preset.html"
    f.write_text(_PRESET_HTML, encoding="utf-8")
    preset = parse_modlist_html(f)
    cba = next(m for m in preset.mods if m.name == "@CBA_A3")
    assert cba.url is not None
    assert "450814997" in cba.url


def test_parse_non_container_rows_ignored(tmp_path: Path) -> None:
    """Header rows or other <tr> elements without data-type=ModContainer are skipped."""
    html = textwrap.dedent("""\
        <html><head><title>T</title></head><body><table>
          <tr data-type="HeaderRow"><td>Name</td></tr>
          <tr data-type="ModContainer">
            <td data-type="DisplayName">@CBA_A3</td>
            <td><span class="from-steam"></span></td>
          </tr>
        </table></body></html>
    """)
    f = tmp_path / "p.html"
    f.write_text(html, encoding="utf-8")
    preset = parse_modlist_html(f)
    assert preset.mod_count == 1
