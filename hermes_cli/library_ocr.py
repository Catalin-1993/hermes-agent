"""Text in pictures and scanned PDFs, for search: ``tesseract`` when it is installed, else on macOS
the OS's own Vision framework through a small helper compiled once with ``swiftc`` and kept with
the Library's derived files. With neither, nothing is recognized and nothing breaks.
"""

from __future__ import annotations

import subprocess
import threading
from pathlib import Path
from typing import Optional

from hermes_cli import library_db as ldb
from hermes_cli import library_processing as lp
from hermes_platform.host.facts import os_family

MAX_PAGES = 30
_OCR_TIMEOUT_S = 180
_COMPILE_TIMEOUT_S = 300
_compile_lock = threading.Lock()
# One attempt per process: a machine without a working swiftc should not retry on every file.
_helper_failed = False

_VISION_HELPER = r"""
import AppKit
import Foundation
import PDFKit
import Vision

func recognize(_ image: CGImage) -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    if #available(macOS 13.0, *) { request.automaticallyDetectsLanguage = true }
    try? VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
}

let arguments = CommandLine.arguments
guard arguments.count > 2, let maxPages = Int(arguments[2]) else { exit(2) }
let url = URL(fileURLWithPath: arguments[1])
var pages: [String] = []
if url.pathExtension.lowercased() == "pdf", let document = PDFDocument(url: url) {
    for index in 0..<min(document.pageCount, maxPages) {
        guard let page = document.page(at: index) else { continue }
        let box = page.bounds(for: .mediaBox)
        let picture = page.thumbnail(of: NSSize(width: box.width * 2, height: box.height * 2), for: .mediaBox)
        if let image = picture.cgImage(forProposedRect: nil, context: nil, hints: nil) { pages.append(recognize(image)) }
    }
} else if let picture = NSImage(contentsOf: url),
          let image = picture.cgImage(forProposedRect: nil, context: nil, hints: nil) {
    pages.append(recognize(image))
}
print(pages.joined(separator: "\n\n"))
"""


def _vision_helper() -> Optional[Path]:
    global _helper_failed
    if os_family() != "darwin" or _helper_failed:
        return None
    binary = ldb.library_derived_dir("tools") / "hermes-ocr"
    with _compile_lock:
        if binary.exists():
            return binary
        swiftc = lp._tool("swiftc")
        if not swiftc:
            _helper_failed = True
            return None
        binary.parent.mkdir(parents=True, exist_ok=True)
        source = binary.with_suffix(".swift")
        source.write_text(_VISION_HELPER, encoding="utf-8")
        if not lp._run([swiftc, "-O", "-o", str(binary), str(source)], timeout=_COMPILE_TIMEOUT_S):
            _helper_failed = True
            binary.unlink(missing_ok=True)
            return None
        return binary


def _output(args: list[str]) -> str:
    try:
        done = subprocess.run(args, capture_output=True, text=True, timeout=_OCR_TIMEOUT_S, check=False)
    except (OSError, subprocess.SubprocessError):
        return ""
    return done.stdout.strip() if done.returncode == 0 else ""


def recognize(path: Path) -> str:
    """The text a picture or a scanned PDF shows ("" when it cannot be read here)."""
    pdf = path.suffix.lower() == ".pdf"
    tesseract = lp._tool("tesseract")
    if tesseract and not pdf:
        text = _output([tesseract, str(path), "stdout"])
        if text:
            return text
    helper = _vision_helper()
    return _output([str(helper), str(path), str(MAX_PAGES)]) if helper else ""
