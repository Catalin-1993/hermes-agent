"""Staged Library uploads: the part file's length is the progress, so a repeated chunk (a retry after
a lost answer) lands once and a gap is refused."""

import pytest

from hermes_cli import library_uploads as uploads


def test_chunks_append_once_and_complete_the_declared_size():
    upload = uploads.begin(file_name="clip.mp4", size=10)
    uid = upload["upload_id"]

    assert uploads.append(uid, offset=0, data=b"01234") == 5
    assert uploads.append(uid, offset=0, data=b"01234") == 5  # retried chunk
    with pytest.raises(ValueError):
        uploads.append(uid, offset=7, data=b"789")
    assert uploads.append(uid, offset=5, data=b"56789") == 10

    part, meta = uploads.staged(uid)
    assert part.read_bytes() == b"0123456789" and meta["file_name"] == "clip.mp4"
    uploads.abort(uid)
    with pytest.raises(ValueError):
        uploads.staged(uid)


def test_upload_ids_cannot_name_paths_outside_the_staging_dir():
    with pytest.raises(ValueError):
        uploads.append("../../library", offset=0, data=b"x")
