"""Dictation for the Whiteboard's bar: the page records the microphone and sends the clip here.

The clip is transcribed the way the app's chat bar transcribes it (``tools.voice_mode.transcribe_recording``,
which filters Whisper hallucinations and reports silence as an empty transcript), so the board's bar and the
chat bar hear the same words. Nothing is kept: the clip lives in a temp file for the length of the call.
"""

from __future__ import annotations

import base64
import binascii
import os
import tempfile

MAX_BYTES = 25 * 1024 * 1024
EXTENSIONS = {"audio/mp4": ".m4a", "audio/mpeg": ".mp3", "audio/ogg": ".ogg", "audio/wav": ".wav", "audio/webm": ".webm", "video/webm": ".webm"}


def _decode(data_url: object, mime_type: object) -> tuple[bytes, str] | str:
    """The clip's bytes and file extension, or why the payload is not a recording."""
    text = str(data_url or "").strip()
    if not text.startswith("data:") or "," not in text:
        return "Invalid audio payload"
    header, encoded = text.split(",", 1)
    if ";base64" not in header:
        return "Audio payload must be base64 encoded"
    mime = (str(mime_type or "") or header[5:].split(";", 1)[0] or "audio/webm").split(";", 1)[0].strip().lower()
    if not (mime.startswith("audio/") or mime == "video/webm"):
        return "Payload must be an audio recording"
    try:
        audio = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        return "Audio payload is not valid base64"
    if not audio:
        return "Audio recording is empty"
    if len(audio) > MAX_BYTES:
        return "Audio recording is too large"
    return audio, EXTENSIONS.get(mime, ".webm")


def transcribe(data_url: object, mime_type: object, run=None) -> dict:
    """``{"transcript": str}`` on success (empty when no speech was heard), ``{"error": str}`` otherwise."""
    decoded = _decode(data_url, mime_type)
    if isinstance(decoded, str):
        return {"error": decoded}
    audio, suffix = decoded
    if run is None:
        from tools.voice_mode import transcribe_recording as run
    with tempfile.NamedTemporaryFile(prefix="hermes-whiteboard-voice-", suffix=suffix, delete=False) as tmp:
        tmp.write(audio)
        path = tmp.name
    try:
        result = run(path)
    finally:
        os.unlink(path)
    if not result.get("success"):
        return {"error": str(result.get("error") or "Transcription failed")}
    return {"transcript": str(result.get("transcript") or "").strip()}
