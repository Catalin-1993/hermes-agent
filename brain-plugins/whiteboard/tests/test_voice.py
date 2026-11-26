"""Dictation in the board's bar: a recorded clip becomes words, silence becomes an empty transcript, and
anything that is not an audio recording is refused before it reaches transcription."""

import base64
import importlib.util
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("hermes_whiteboard_voice_under_test", ROOT / "voice.py")
voice = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(voice)


def _clip(mime="audio/webm", data=b"fake-opus"):
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def test_a_clip_comes_back_as_words_and_leaves_no_file_behind():
    seen = {}

    def run(path):
        seen["path"] = path
        seen["bytes"] = Path(path).read_bytes()
        return {"success": True, "transcript": "  plan the offsite  "}

    assert voice.transcribe(_clip(), "audio/webm;codecs=opus", run=run) == {"transcript": "plan the offsite"}
    assert seen["bytes"] == b"fake-opus"
    assert seen["path"].endswith(".webm")
    assert not os.path.exists(seen["path"])


def test_silence_is_an_empty_transcript_and_a_failed_provider_is_an_error():
    assert voice.transcribe(_clip(), None, run=lambda _path: {"success": True, "transcript": "", "no_speech": True}) == {"transcript": ""}
    assert voice.transcribe(_clip(), None, run=lambda _path: {"success": False, "error": "no STT provider"}) == {"error": "no STT provider"}


def test_a_payload_that_is_not_a_recording_never_reaches_transcription():
    def run(_path):
        raise AssertionError("transcription must not run")

    assert "error" in voice.transcribe("not a data url", None, run=run)
    assert "error" in voice.transcribe(_clip("image/png"), "image/png", run=run)
    assert "error" in voice.transcribe("data:audio/webm;base64,@@@", None, run=run)
    assert "error" in voice.transcribe(_clip(data=b""), None, run=run)
