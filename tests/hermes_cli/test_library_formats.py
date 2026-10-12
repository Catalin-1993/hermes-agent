"""Archives, mail and notebooks in the Library: what their viewers are given, and that extraction
never writes outside the folder it makes."""

import base64
import io
import json
import tarfile
from email.message import EmailMessage
from pathlib import Path

import pytest

from hermes_cli import library_archive, library_db as ldb, library_formats


@pytest.fixture
def conn():
    with ldb.connect_closing() as c:
        yield c


def _tar(path: Path, members: dict[str, bytes]) -> None:
    with tarfile.open(path, "w:gz") as tf:
        for name, data in members.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            tf.addfile(info, io.BytesIO(data))


def test_an_archive_unpacks_beside_itself_and_a_hostile_one_writes_nothing(conn, tmp_path):
    good = tmp_path / "reports.tar.gz"
    _tar(good, {"q1/summary.txt": b"up", "q2/summary.txt": b"flat"})
    item = ldb.save_file(conn, file_name=good.name, source_path=str(good))

    assert {e["name"] for e in library_archive.preview(Path(item.path), "gz")["entries"]} >= {"q1/summary.txt"}
    result = library_archive.extract(conn, item)

    assert result["folder"].title == "reports" and result["imported"] == 2
    assert {i.title for i in ldb.list_items(conn, parent_id=result["folder"].id)} == {"q1", "q2"}

    hostile = tmp_path / "evil.tar.gz"
    _tar(hostile, {"../../escaped.txt": b"x"})
    bad = ldb.save_file(conn, file_name=hostile.name, source_path=str(hostile))
    with pytest.raises(ValueError):
        library_archive.extract(conn, bad)
    assert not any(p.name == "escaped.txt" for p in tmp_path.parent.rglob("escaped.txt"))


def test_mail_shows_its_headers_inline_pictures_and_attachments(tmp_path):
    message = EmailMessage()
    message["Subject"], message["From"], message["To"] = "Q3 numbers", "ana@example.com", "dan@example.com"
    message.set_content("plain")
    message.add_alternative('<p>See <img src="cid:chart@x"></p>', subtype="html")
    message.get_payload()[1].add_related(b"\x89PNG", maintype="image", subtype="png", cid="<chart@x>")
    message.add_attachment(b"%PDF", maintype="application", subtype="pdf", filename="deck.pdf")
    path = tmp_path / "q3.eml"
    path.write_bytes(message.as_bytes())

    shown = library_formats.email_preview(path)

    assert shown["email"]["subject"] == "Q3 numbers" and shown["email"]["sender"] == "ana@example.com"
    assert "cid:" not in shown["html"] and "data:image/png;base64," in shown["html"]
    assert [a["name"] for a in shown["entries"]] == ["deck.pdf"]


def test_a_notebook_reads_as_cells_with_their_outputs(tmp_path):
    picture = base64.b64encode(b"\x89PNG").decode()
    path = tmp_path / "analysis.ipynb"
    path.write_text(json.dumps({
        "metadata": {"kernelspec": {"language": "python"}},
        "cells": [
            {"cell_type": "markdown", "source": ["# Results"]},
            {"cell_type": "code", "source": "print(2 + 2)", "outputs": [
                {"output_type": "stream", "text": ["4\n"]},
                {"output_type": "display_data", "data": {"image/png": picture, "text/plain": "<Figure>"}},
            ]},
        ],
    }))

    shown = library_formats.notebook_preview(path)

    assert [c["kind"] for c in shown["cells"]] == ["markdown", "code"] and shown["language"] == "python"
    assert shown["cells"][1]["outputs"] == [{"text": "4\n"}, {"image": f"data:image/png;base64,{picture}"}]
