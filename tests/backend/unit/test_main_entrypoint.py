"""`python -m app.main` must not run uvicorn in reload mode (P22)."""
from __future__ import annotations

from unittest.mock import patch


def test_run_does_not_enable_reload() -> None:
    import app.main as main

    with patch("uvicorn.run") as run:
        main.run()

    run.assert_called_once()
    kwargs = run.call_args.kwargs
    assert not kwargs.get("reload", False)
    # Pass the app object, not an import string: `python -m app.main` would
    # otherwise import the module a second time and build a second app.
    assert run.call_args.args[0] is main.app
