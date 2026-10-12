"""Library (``library.*`` — per-profile folders, Notion-style pages and saved files) and the
``library.consent`` server request the agent's library tool asks before acting.

Every method is profile-scoped (the desktop adds ``profile``) so a pooled or multiplexed backend
reads the focused profile's ``library.db``.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from .base import Params, Result
from .common import ProfileParams
from .registry import method, server_request
from .server_requests import ServerRequestParams

LibraryVisibility = Literal["private", "ask", "open"]
LibraryKind = Literal["page", "file", "folder"]
LibrarySort = Literal["updated", "created", "name", "size", "kind"]
LibraryOnDuplicate = Literal["ask", "keep", "replace", "skip"]


class LibraryDeckCover(Result):
    """A presentation page's theme and first slide, for its thumbnail."""

    theme: str
    slide: str


class LibraryItemInfo(Result):
    """``hermes_cli/library_db.py::LibraryItem.to_dict``. ``content`` / ``markdown`` ride only
    on single-item answers (``library.get`` and writes)."""

    id: str
    kind: LibraryKind
    title: str
    icon: str | None = None
    parent_id: str | None = None
    visibility: LibraryVisibility
    favorite: bool = False
    mime: str | None = None
    file_name: str | None = None
    size: int | None = None
    path: str | None = None
    created_by: str = "user"
    created_at: int
    updated_at: int
    trashed_at: int | None = None
    excerpt: str = ""
    content: str | None = None
    markdown: str | None = None
    # Files: processing state, the thumbnail JPEG's path, and what processing learned
    # (width / height, pages, chars).
    status: Literal["pending", "ready", "failed"] | None = None
    thumb: str | None = None
    meta: dict[str, int | None] | None = None
    # Listings only: a container's live children, the name of the container an item is in, and
    # where a search matched the item's text (U+E000 / U+E001 around each hit).
    child_count: int | None = None
    parent_title: str | None = None
    snippet: str | None = None
    tags: list[str] = Field(default_factory=list)
    # Pages: ``gradient:<name>`` or ``image:<item id>``, optionally ``@<0-100>`` (vertical focus).
    cover: str | None = None
    # The conversation Hermes last made or changed the item in (the Library's "From chats").
    session_id: str | None = None
    # Presentation pages only.
    deck: LibraryDeckCover | None = None


class LibraryListParams(ProfileParams):
    """``parent_id`` browses the tree: absent lists across it, ``""`` the root, an id that container
    (folders first)."""

    kind: LibraryKind | None = None
    query: str | None = None
    scope: Literal["all", "favorites", "trash"] = "all"
    tag: str | None = None
    parent_id: str | None = None
    sort: LibrarySort = "updated"
    order: Literal["asc", "desc"] | None = None
    limit: int = Field(default=500, ge=1, le=5000)


class LibraryListResult(Result):
    items: list[LibraryItemInfo]
    # When browsing a container: its breadcrumb, outermost first, ending with the container.
    trail: list[LibraryItemInfo] = Field(default_factory=list)


class LibraryIdParams(ProfileParams):
    id: str = Field(min_length=1)


class LibraryItemResult(Result):
    item: LibraryItemInfo


class LibraryGetResult(LibraryItemResult):
    """The item plus the containers above it, outermost first."""

    trail: list[LibraryItemInfo] = Field(default_factory=list)


class LibraryCreateFolderParams(ProfileParams):
    title: str = ""
    parent_id: str | None = None
    visibility: LibraryVisibility = "private"


class LibraryCopyParams(ProfileParams):
    """Duplicate items (and all below them) into ``parent_id`` (``""`` the root), or each beside
    itself with ``in_place``."""

    ids: list[str] = Field(min_length=1)
    parent_id: str = ""
    in_place: bool = False


class LibraryMoveParams(ProfileParams):
    """Re-home items; ``parent_id`` ``""`` is the root."""

    ids: list[str] = Field(min_length=1)
    parent_id: str = ""


class LibraryItemsResult(Result):
    items: list[LibraryItemInfo]


class LibraryCreatePageParams(ProfileParams):
    title: str = ""
    icon: str | None = None
    parent_id: str | None = None
    content: str | None = None
    markdown: str = ""
    visibility: LibraryVisibility = "private"


class LibraryUpdateParams(ProfileParams):
    """Only the keys present are written; ``markdown`` without ``content`` retires the block document."""

    id: str = Field(min_length=1)
    title: str | None = None
    icon: str | None = None
    cover: str | None = Field(default=None, max_length=200)
    content: str | None = None
    markdown: str | None = None
    visibility: LibraryVisibility | None = None
    favorite: bool | None = None
    parent_id: str | None = None


class LibraryImportParams(ProfileParams):
    """Save a file into the Library: ``path`` copies a file already on the backend host (a local
    backend's disk), ``data_url`` carries the bytes (any backend). Exactly one is required.
    ``on_duplicate`` decides a collision with identical bytes or a same-named file in the target
    container (``ask`` answers the conflict and stores nothing)."""

    file_name: str = ""
    path: str | None = None
    data_url: str | None = None
    mime: str | None = None
    parent_id: str | None = None
    visibility: LibraryVisibility = "private"
    on_duplicate: LibraryOnDuplicate = "keep"


class LibraryConflict(Result):
    """``content``: the same bytes are already saved; ``name``: the container has that file name."""

    type: Literal["content", "name"]
    item: LibraryItemInfo


class LibraryImportResult(Result):
    """The stored (or, with ``skipped``, the existing) item — or the conflict awaiting an answer."""

    item: LibraryItemInfo | None = None
    conflict: LibraryConflict | None = None
    skipped: bool = False


class LibraryImportFolderParams(ProfileParams):
    """Mirror a directory on the backend host as a folder tree."""

    path: str = Field(min_length=1)
    parent_id: str | None = None
    visibility: LibraryVisibility = "private"


class LibraryImportFolderResult(Result):
    folder: LibraryItemInfo
    imported: int = 0
    failed: list[str] = Field(default_factory=list)
    truncated: bool = False


class LibraryUploadBeginParams(ProfileParams):
    file_name: str = Field(min_length=1)
    size: int = Field(ge=0)
    mime: str | None = None


class LibraryUploadOffsetResult(Result):
    upload_id: str | None = None
    offset: int = 0


class LibraryUploadChunkParams(ProfileParams):
    """``data`` is base64; ``offset`` is where it starts (a repeated chunk is accepted once)."""

    upload_id: str = Field(min_length=1)
    offset: int = Field(ge=0)
    data: str


class LibraryUploadFinishParams(ProfileParams):
    upload_id: str = Field(min_length=1)
    file_name: str = ""
    mime: str | None = None
    parent_id: str | None = None
    visibility: LibraryVisibility = "private"
    on_duplicate: LibraryOnDuplicate = "keep"


class LibraryUploadIdParams(ProfileParams):
    upload_id: str = Field(min_length=1)


class LibraryOkResult(Result):
    ok: bool = True


class LibrarySheet(Result):
    name: str
    rows: list[list[str]]


class LibraryArchiveEntry(Result):
    name: str
    size: int = 0
    dir: bool = False


class LibraryEmail(Result):
    subject: str = ""
    sender: str = ""
    to: str = ""
    cc: str = ""
    date: str = ""


class LibraryNotebookOutput(Result):
    text: str | None = None
    # A data: URI picture.
    image: str | None = None


class LibraryNotebookCell(Result):
    kind: str
    source: str
    outputs: list[LibraryNotebookOutput] = Field(default_factory=list)


class LibraryPreviewResult(Result):
    """How to show a file: ``native`` (the renderer can), ``image`` / ``pdf`` (a rendition, read with
    ``library.read`` and ``rendition``), ``video`` (an MP4 rendition at ``path``), ``html`` (an office
    document as Quick Look shows it, or an ePub — self-contained), ``email`` (headers, ``html`` or
    ``text``, attachments as ``entries``), ``notebook`` (``cells``), ``sheet``, ``text``, ``archive``,
    or ``none``. ``converter_missing`` says an
    office document would preview fully with LibreOffice installed."""

    type: Literal["native", "image", "pdf", "html", "sheet", "text", "archive", "email", "notebook", "video", "none"]
    # A rendition the renderer loads by path (a video's MP4).
    path: str | None = None
    html: str | None = None
    email: LibraryEmail | None = None
    cells: list[LibraryNotebookCell] = Field(default_factory=list)
    language: str | None = None
    sheets: list[LibrarySheet] = Field(default_factory=list)
    text: str | None = None
    entries: list[LibraryArchiveEntry] = Field(default_factory=list)
    truncated: bool = False
    converter_missing: bool = False
    # Which tool would show it: LibreOffice (office documents) or ffmpeg (videos).
    converter: Literal["libreoffice", "ffmpeg"] | None = None


class LibraryExportResult(Result):
    path: str


class LibraryVersion(Result):
    id: str
    created_at: int
    title: str = ""
    size: int = 0
    # A page version's text (capped), for its preview; files carry none.
    markdown: str | None = None


class LibraryVersionsResult(Result):
    versions: list[LibraryVersion]


class LibraryRestoreVersionParams(ProfileParams):
    id: str = Field(min_length=1)
    version_id: str = Field(min_length=1)


TagColor = Literal["red", "orange", "yellow", "green", "blue", "purple", "gray"]


class LibraryTag(Result):
    name: str
    color: TagColor
    count: int = 0


class LibraryTagsResult(Result):
    tags: list[LibraryTag]


class LibraryTagParams(ProfileParams):
    """Put a tag on items (``on``) or take it off; a new name joins the registry."""

    ids: list[str] = Field(min_length=1)
    name: str = Field(min_length=1)
    on: bool = True
    color: TagColor | None = None


class LibraryTagUpdateParams(ProfileParams):
    name: str = Field(min_length=1)
    color: TagColor | None = None
    new_name: str | None = None


class LibraryTagNameParams(ProfileParams):
    name: str = Field(min_length=1)


class LibraryTagResult(Result):
    name: str
    color: TagColor


class LibrarySmartQuery(Result):
    query: str | None = None
    types: list[str] = Field(default_factory=list)
    access: list[str] = Field(default_factory=list)
    createdBy: list[str] = Field(default_factory=list)
    tag: str | None = None
    sort: str | None = None
    order: str | None = None


class LibrarySmart(Result):
    id: str
    title: str
    query: LibrarySmartQuery


class LibrarySmartListResult(Result):
    searches: list[LibrarySmart]


class LibrarySmartCreateParams(ProfileParams):
    title: str = Field(min_length=1)
    query: LibrarySmartQuery


class LibrarySmartIdParams(ProfileParams):
    id: str = Field(min_length=1)


# One `library.read` answer at most: viewers fetch big files as a run of these, showing progress.
LIBRARY_READ_CHUNK_BYTES = 8 * 1024 * 1024


class LibraryReadParams(ProfileParams):
    id: str = Field(min_length=1)
    offset: int = Field(default=0, ge=0)
    length: int = Field(default=LIBRARY_READ_CHUNK_BYTES, ge=1, le=LIBRARY_READ_CHUNK_BYTES)
    # The derived file instead of the original: a HEIC's JPEG, an office document's PDF.
    rendition: bool = False


class LibraryReadResult(Result):
    data: str
    mime: str | None = None
    offset: int = 0
    size: int = 0


class LibraryWriteTextParams(ProfileParams):
    id: str = Field(min_length=1)
    text: str


class LibraryWriteFileParams(ProfileParams):
    """New bytes for a saved file, as a base64 data URL."""

    id: str = Field(min_length=1)
    data_url: str = Field(min_length=1)


class LibrarySetViewParams(ProfileParams):
    """What the owner has open: the item, the slide in it, a selection. No item clears it."""

    item_id: str | None = None
    slide: int | None = None
    selection: str | None = None


class LibraryTrashParams(LibraryIdParams):
    restore: bool = False


class LibraryPurgeResult(Result):
    ok: bool = True
    removed: int = 0


method("library.list", params=LibraryListParams, result=LibraryListResult,
       doc="The profile's Library items, newest first (``scope``: all / favorites / trash).")
method("library.get", params=LibraryIdParams, result=LibraryGetResult,
       doc="One item with its body (page block document + markdown) and the containers above it.")
method("library.create_page", params=LibraryCreatePageParams, result=LibraryItemResult,
       doc="Create a page; answers the stored item.")
method("library.update", params=LibraryUpdateParams, result=LibraryItemResult,
       doc="Patch an item's title / icon / cover / body / visibility / favorite / parent.")
method("library.create_folder", params=LibraryCreateFolderParams, result=LibraryItemResult,
       doc="Create a folder (at the root or inside another folder).")
method("library.copy", params=LibraryCopyParams, result=LibraryItemsResult,
       doc="Duplicate items with everything below them; files copy their bytes.")
method("library.move", params=LibraryMoveParams, result=LibraryItemsResult,
       doc="Move items into a folder or page, or to the root.")
method("library.import", params=LibraryImportParams, result=LibraryImportResult,
       doc="Save a file (by backend path or data URL) as a Library item, resolving duplicates.")
method("library.export", params=LibraryIdParams, result=LibraryExportResult,
       doc="A path naming a file or page as the user knows it, to attach to a chat.")
method("library.versions", params=LibraryIdParams, result=LibraryVersionsResult,
       doc="An item's earlier versions, newest first.")
method("library.restore_version", params=LibraryRestoreVersionParams, result=LibraryItemResult,
       doc="Bring an earlier version back (the current state becomes a version).")
method("library.tags", params=ProfileParams, result=LibraryTagsResult,
       doc="The tag registry, with how many items wear each tag.")
method("library.tag", params=LibraryTagParams, result=LibraryTagResult,
       doc="Put a tag on items, or take it off.")
method("library.tag_update", params=LibraryTagUpdateParams, result=LibraryTagResult,
       doc="Recolour or rename a tag.")
method("library.tag_delete", params=LibraryTagNameParams, result=LibraryOkResult,
       doc="Retire a tag from the registry and every item.")
method("library.smart_list", params=ProfileParams, result=LibrarySmartListResult,
       doc="Saved searches (smart folders).")
method("library.smart_create", params=LibrarySmartCreateParams, result=LibrarySmart,
       doc="Save the current search and filters under a name.")
method("library.smart_delete", params=LibrarySmartIdParams, result=LibraryOkResult,
       doc="Remove a saved search.")
method("library.extract", params=LibraryIdParams, result=LibraryImportFolderResult,
       doc="Unpack an archive into a new folder beside it.")
method("library.import_folder", params=LibraryImportFolderParams, result=LibraryImportFolderResult,
       doc="Mirror a directory on the backend host as a Library folder tree.")
method("library.upload_begin", params=LibraryUploadBeginParams, result=LibraryUploadOffsetResult,
       doc="Open a staged upload for a file sent in chunks.")
method("library.upload_chunk", params=LibraryUploadChunkParams, result=LibraryUploadOffsetResult,
       doc="Append a base64 chunk to a staged upload; answers the new offset.")
method("library.upload_finish", params=LibraryUploadFinishParams, result=LibraryImportResult,
       doc="Save a complete staged upload as a Library item, resolving duplicates.")
method("library.upload_abort", params=LibraryUploadIdParams, result=LibraryOkResult,
       doc="Drop a staged upload.")
method("library.preview", params=LibraryIdParams, result=LibraryPreviewResult,
       doc="What the viewer needs to show a file the renderer cannot show by itself.")
method("library.read", params=LibraryReadParams, result=LibraryReadResult,
       doc="A slice of a file's bytes (base64) for in-app viewers — or of its rendition; `size` is the whole.")
method("library.write_file", params=LibraryWriteFileParams, result=LibraryItemResult,
       doc="Replace a file's bytes (an edited image); the earlier bytes stay in its versions.")
method("library.write_text", params=LibraryWriteTextParams, result=LibraryItemResult,
       doc="Replace a text file's contents (edited in the Library viewer).")
method("library.set_view", params=LibrarySetViewParams, result=LibraryOkResult,
       doc="Tell the agent what the owner is looking at in the Library (item, slide, selection).")
method("library.trash", params=LibraryTrashParams, result=LibraryItemResult,
       doc="Move an item and everything below it to the trash, or restore it.")
method("library.purge", params=LibraryIdParams, result=LibraryPurgeResult,
       doc="Delete a trashed item for good, with its stored bytes.")
method("library.empty_trash", params=ProfileParams, result=LibraryPurgeResult,
       doc="Delete every trashed item for good.")


# ── the agent's consent card ──────────────────────────────────────────────────────────────────


class LibraryConsentTarget(Params):
    """The item an action touches (absent for a search or a create)."""

    id: str | None = None
    title: str = ""
    kind: LibraryKind = "page"
    visibility: LibraryVisibility | None = None


class LibraryConsentParams(ServerRequestParams):
    """What the agent is about to do in the Library, spelled out for the owner's decision."""

    action: Literal["read", "search", "create", "update", "delete", "attach"]
    summary: str = Field(min_length=1)
    reason: str = ""
    target: LibraryConsentTarget | None = None
    query: str | None = None
    preview: str = ""
    changes: list[str] = Field(default_factory=list)


class LibraryConsentResult(Result):
    approved: bool = False
    note: str = ""


server_request("library.consent", params=LibraryConsentParams, result=LibraryConsentResult,
               doc="The library tool: ask the owner to approve one Library action before it runs.")


class LibrarySnapshotParams(ServerRequestParams):
    """The agent wants to see the item the owner has open, as a picture."""

    item_id: str = Field(min_length=1)
    slide: int | None = None


class LibrarySnapshotResult(Result):
    """A PNG data URL of what is on screen, or none when this item cannot be drawn."""

    data_url: str | None = None


server_request("library.snapshot", params=LibrarySnapshotParams, result=LibrarySnapshotResult,
               doc="The library tool: a picture of the item (the current slide of a presentation) as the owner sees it.")
