"""The market-data environment's lifecycle: built once, and rebuilt only when its pins change."""

from pathlib import Path

from plugins.portfolio.core import runtime


def test_environment_built_from_older_pins_reports_outdated(tmp_path: Path, monkeypatch):
    requirements, lock = tmp_path / "requirements.txt", tmp_path / "requirements.lock"
    requirements.write_text("openbb-core==2.0.1\n", encoding="utf-8")
    lock.write_text("pandas==3.0.6\n", encoding="utf-8")
    monkeypatch.setattr(runtime, "REQUIREMENTS", requirements)
    monkeypatch.setattr(runtime, "LOCK", lock)

    assert runtime.env_phase() == "missing"

    runtime._python().parent.mkdir(parents=True)
    runtime._python().write_text("", encoding="utf-8")
    runtime._stamp_file().write_text(runtime.wanted_stamp(), encoding="utf-8")
    assert runtime.env_phase() == "ready"

    lock.write_text("pandas==3.0.7\n", encoding="utf-8")  # an update moved a pin
    assert runtime.env_phase() == "outdated"
    assert runtime.service_phase() == "off"  # an outdated environment is never started
