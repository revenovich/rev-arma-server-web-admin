from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from pathlib import Path

from app.schemas.preset import ModEntry, Preset


def _extract_steam_id(url: str) -> str | None:
    m = re.search(r"[?&]id=(\d+)", url)
    return m.group(1) if m else None


def _source_from_class(css_class: str) -> str:
    if "from-steam" in css_class:
        return "steam"
    if "from-local" in css_class:
        return "local"
    return "unknown"


def _parse_mod_entry(tr: ET.Element) -> ModEntry | None:
    if tr.get("data-type") != "ModContainer":
        return None

    name = ""
    source = "unknown"
    url: str | None = None
    steam_id: str | None = None

    for td in tr.iter("td"):
        dt = td.get("data-type", "")
        if dt == "DisplayName":
            name = (td.text or "").strip()

        span = td.find(".//span")
        if span is not None:
            source = _source_from_class(span.get("class", ""))

        link = td.find(".//a[@data-type='Link']")
        if link is not None:
            href = link.get("href", "")
            url = href or None
            if url:
                steam_id = _extract_steam_id(url)

    if not name:
        return None
    return ModEntry(name=name, source=source, url=url, steam_id=steam_id)


def parse_modlist_html(filepath: Path) -> Preset:
    """Parse a single Arma 3 Launcher .html preset export."""
    text = filepath.read_text(encoding="utf-8", errors="replace")
    tree = ET.fromstring(text)

    mods: list[ModEntry] = []
    for tr in tree.iter("tr"):
        entry = _parse_mod_entry(tr)
        if entry is not None:
            mods.append(entry)

    # Preset name from <title> or filename
    title_el = tree.find(".//title")
    preset_name = (title_el.text or "").strip() if title_el is not None else filepath.stem
    if not preset_name:
        preset_name = filepath.stem

    return Preset(
        preset_name=preset_name,
        source_file=filepath.name,
        mod_count=len(mods),
        mods=mods,
    )


def parse_modlist_dir(directory: Path) -> list[Preset]:
    """Parse all .html files in a directory, sorted by filename."""
    if not directory.is_dir():
        raise NotADirectoryError(str(directory))
    files = sorted(directory.glob("*.html"), key=lambda p: p.name)
    return [parse_modlist_html(f) for f in files]
