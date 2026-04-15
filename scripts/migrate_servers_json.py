#!/usr/bin/env python3
"""Validate and migrate an existing servers.json to the new Pydantic schema.

Usage:
    python scripts/migrate_servers_json.py path/to/servers.json
    python scripts/migrate_servers_json.py path/to/servers.json --migrate -o path/to/output.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Add project root to sys.path so app module is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pydantic import ValidationError

from app.schemas.server import ServerSchema


def load_servers(path: Path) -> list[dict]:
    """Load servers.json as raw dicts."""
    if not path.exists():
        print(f"Error: {path} does not exist")
        sys.exit(1)

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"Error: invalid JSON in {path}: {e}")
        sys.exit(1)

    if not isinstance(data, list):
        print(f"Error: {path} should contain a JSON array, got {type(data).__name__}")
        sys.exit(1)

    return data


def validate_server(entry: dict, index: int) -> list[str]:
    """Try to validate a single server entry. Returns list of issues."""
    issues: list[str] = []
    try:
        ServerSchema(**entry)
    except ValidationError as e:
        for err in e.errors():
            loc = " → ".join(str(l) for l in err["loc"])
            issues.append(f"  Server #{index + 1}: {loc}: {err['msg']}")
    return issues


def migrate_entry(entry: dict) -> dict:
    """Apply field migrations to a single server entry.

    Known migrations from the Node.js app:
    - No structural changes needed; Pydantic schema allows extra fields
    """
    # ServerSchema accepts extra fields, so no key renames are needed
    # But we can set defaults for missing required fields
    defaults: dict = {
        "title": entry.get("title", "Unnamed Server"),
        "port": entry.get("port", 9520),
    }

    merged = {**defaults, **entry}
    return merged


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate/migrate servers.json")
    parser.add_argument("path", type=Path, help="Path to servers.json")
    parser.add_argument("--migrate", action="store_true", help="Apply migrations and write output")
    parser.add_argument("-o", "--output", type=Path, help="Output file (defaults to stdout)")

    args = parser.parse_args()

    raw_servers = load_servers(args.path)

    # Validate
    all_issues: list[str] = []
    for i, entry in enumerate(raw_servers):
        issues = validate_server(entry, i)
        all_issues.extend(issues)

    if all_issues:
        print(f"Found {len(all_issues)} validation issue(s):")
        for issue in all_issues:
            print(issue)
    else:
        print(f"All {len(raw_servers)} server(s) validate successfully.")

    # Migrate
    if args.migrate:
        migrated = [migrate_entry(entry) for entry in raw_servers]

        # Re-validate migrated entries
        post_issues: list[str] = []
        for i, entry in enumerate(migrated):
            issues = validate_server(entry, i)
            post_issues.extend(issues)

        if post_issues:
            print(f"\nAfter migration, {len(post_issues)} issue(s) remain:")
            for issue in post_issues:
                print(issue)
            sys.exit(1)
        else:
            print(f"Migrated {len(migrated)} server(s) — all validate successfully.")

        output = json.dumps(migrated, indent=2, ensure_ascii=False)
        if args.output:
            args.output.write_text(output + "\n", encoding="utf-8")
            print(f"Written to {args.output}")
        else:
            print("\n--- Migrated output ---")
            print(output)

    sys.exit(1 if all_issues and not args.migrate else 0)


if __name__ == "__main__":
    main()