"""Library processing and previews: a file's text becomes searchable (with the hit marked), images get
a thumbnail, decks are read without trusting their XML, and an office file without LibreOffice still
previews as its text."""

import zipfile
from pathlib import Path

import pytest

from hermes_cli import library_db as ldb
from hermes_cli import library_preview, library_processing


@pytest.fixture
def conn(monkeypatch):
    # Text recognition is host-specific (Vision compiles a helper); it has its own test below.
    from hermes_cli import library_ocr

    monkeypatch.setattr(library_ocr, "recognize", lambda path: "")
    with ldb.connect_closing() as c:
        yield c


def _save(conn, tmp_path, name, data: bytes):
    src = tmp_path / name
    src.write_bytes(data)
    item = ldb.save_file(conn, file_name=name, source_path=str(src))
    library_processing.process_item(item.id)
    return ldb.get_item(conn, item.id)


def _pptx(path: Path, slide_xml: bytes) -> None:
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("ppt/slides/slide1.xml", slide_xml)


def test_file_text_is_searchable_and_the_hit_is_marked(conn, tmp_path):
    report = _save(conn, tmp_path, "q3.csv", b"ticker,note\nNVDA,record datacenter revenue\n")
    ldb.create_page(conn, title="Unrelated", markdown="nothing here", visibility="private")

    hits = ldb.list_items(conn, query="datacen")

    assert report.status == "ready"
    assert [h.id for h in hits] == [report.id]
    assert "" in hits[0].snippet and "datacenter" in hits[0].snippet.replace("", "").replace("", "")


def test_images_get_a_thumbnail_and_their_size(conn, tmp_path):
    PIL = pytest.importorskip("PIL.Image")
    src = tmp_path / "wide.png"
    PIL.new("RGB", (32, 16), "teal").save(src)

    photo = _save(conn, tmp_path, "wide.png", src.read_bytes())

    assert photo.thumb and Path(photo.thumb).is_file()
    assert photo.to_dict()["meta"] == {"width": 32, "height": 16}

    # JPEG has no alpha: a transparent picture's thumbnail stands on white, never on black.
    clear = tmp_path / "logo.png"
    PIL.new("RGBA", (16, 16), (0, 0, 0, 0)).save(clear)
    logo = _save(conn, tmp_path, "logo.png", clear.read_bytes())
    with PIL.open(logo.thumb) as thumb:
        assert min(thumb.convert("RGB").getpixel((8, 8))) > 240


def test_deck_text_is_read_but_a_dtd_is_never_parsed(conn, tmp_path):
    good = tmp_path / "deck.pptx"
    _pptx(good, b'<p:sld xmlns:a="urn:a" xmlns:p="urn:p"><a:t>Semiconductor outlook</a:t></p:sld>')
    assert "Semiconductor outlook" in library_processing.pptx_text(good)

    hostile = tmp_path / "hostile.pptx"
    _pptx(hostile, b'<!DOCTYPE x [<!ENTITY e "boom">]><p:sld xmlns:a="urn:a" xmlns:p="urn:p"><a:t>&e;</a:t></p:sld>')
    assert "boom" not in library_processing.pptx_text(hostile)


def test_office_preview_falls_back_to_text_without_libreoffice(conn, tmp_path, monkeypatch):
    monkeypatch.setattr(library_processing, "soffice", lambda: None)
    monkeypatch.setattr(library_preview, "_quicklook_preview", lambda path, item_id: None)
    deck = tmp_path / "plan.pptx"
    _pptx(deck, b'<p:sld xmlns:a="urn:a" xmlns:p="urn:p"><a:t>Roadmap</a:t></p:sld>')
    item = ldb.save_file(conn, file_name="plan.pptx", source_path=str(deck))

    shown = library_preview.preview(item)

    assert shown["type"] == "text" and shown["converter_missing"] and "Roadmap" in shown["text"]


def test_sheets_and_archives_preview_as_data(conn, tmp_path):
    table = _save(conn, tmp_path, "prices.csv", b"ticker;price\nNVDA;120\n")
    assert library_preview.preview(table)["sheets"][0]["rows"] == [["ticker", "price"], ["NVDA", "120"]]

    bundle = tmp_path / "bundle.zip"
    with zipfile.ZipFile(bundle, "w") as zf:
        zf.writestr("docs/readme.txt", "hi")
    archive = _save(conn, tmp_path, "bundle.zip", bundle.read_bytes())
    assert [e["name"] for e in library_preview.preview(archive)["entries"]] == ["docs/readme.txt"]


def test_quick_look_html_arrives_self_contained(conn, tmp_path, monkeypatch):
    """The sealed preview frame has no network and no file access: every attachment rides inline."""
    def fake_quicklook(args, timeout=0):
        bundle = Path(args[args.index("-o") + 1]) / "memo.doc.qlpreview"
        bundle.mkdir()
        (bundle / "Attachment1.css").write_text("p { color: red }")
        (bundle / "Preview.html").write_text('<link href="Attachment1.css" rel="stylesheet"><p>Memo</p>')
        return True

    monkeypatch.setattr(library_processing, "soffice", lambda: None)
    monkeypatch.setattr(library_processing, "_tool", lambda name, *dirs: name)
    monkeypatch.setattr(library_processing, "_run", fake_quicklook)
    doc = tmp_path / "memo.doc"
    doc.write_bytes(b"doc")
    item = ldb.save_file(conn, file_name="memo.doc", source_path=str(doc))

    shown = library_preview.preview(item)

    assert shown["type"] == "html" and "Attachment1.css" not in shown["html"]
    assert "data:text/css;base64," in shown["html"] and "<p>Memo</p>" in shown["html"]

