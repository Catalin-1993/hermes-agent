"""Memory Atlas (``memory_atlas.*``, ``methods_memory_atlas.py``): read-only views of the active
external memory for the desktop Library home — counts, a graph per view, and one item's detail.

Every answer carries ``state``: ``ready`` with data, or why there is none (``provider``: the active
memory is not one the Atlas can read; ``asleep``: a local daemon that is not running; ``error``).
"""

from __future__ import annotations

from typing import Literal

from .base import Result
from .common import OpenModel, ProfileParams
from .registry import method

AtlasState = Literal["ready", "provider", "asleep", "error"]
AtlasGraphMode = Literal["entities", "world", "experience", "observation"]
AtlasDetailKind = Literal["memory", "entity", "document"]


class AtlasCounts(Result):
    memories: int
    links: int
    documents: int
    entities: int
    world: int
    experience: int
    observation: int


class AtlasActivity(Result):
    time: str | None = None
    count: int


class AtlasDocument(Result):
    id: str
    context: str
    platform: str
    created_at: str | None = None
    updated_at: str | None = None
    memories: int
    chars: int


class AtlasEntity(Result):
    id: str
    name: str
    mentions: int


class AtlasKnowledge(Result):
    id: str
    title: str
    kind: Literal["folder", "page", "model"]
    depth: int


class AtlasOverview(Result):
    bank: str
    counts: AtlasCounts
    last_write_at: str | None = None
    activity: list[AtlasActivity]
    documents: list[AtlasDocument]
    entities: list[AtlasEntity]
    knowledge: list[AtlasKnowledge]


class MemoryAtlasOverviewResult(Result):
    state: AtlasState
    message: str = ""
    overview: AtlasOverview | None = None


class AtlasNode(Result):
    id: str
    label: str
    text: str
    weight: int
    date: str | None = None


class AtlasLink(Result):
    source: str
    target: str
    type: str
    weight: float


class MemoryAtlasGraphParams(ProfileParams):
    mode: AtlasGraphMode = "entities"


class MemoryAtlasGraphResult(Result):
    state: AtlasState
    message: str = ""
    mode: AtlasGraphMode
    nodes: list[AtlasNode] = []
    links: list[AtlasLink] = []


class MemoryAtlasDetailParams(ProfileParams):
    kind: AtlasDetailKind
    id: str


class MemoryAtlasDetailResult(Result):
    state: AtlasState
    message: str = ""
    # Hindsight's own record for the item; its fields are the provider's.
    item: OpenModel | None = None


class MemoryAtlasWakeResult(Result):
    state: AtlasState
    message: str = ""


method("memory_atlas.overview", params=ProfileParams, result=MemoryAtlasOverviewResult,
       doc="Counts, 30-day activity, recent documents, top entities and knowledge pages of the active memory.")
method("memory_atlas.graph", params=MemoryAtlasGraphParams, result=MemoryAtlasGraphResult,
       doc="Nodes and links for one view of the memory: its entities, or its world / experience / observation facts.")
method("memory_atlas.detail", params=MemoryAtlasDetailParams, result=MemoryAtlasDetailResult,
       doc="One memory, entity or document as the memory provider stores it.")
method("memory_atlas.wake", params=ProfileParams, result=MemoryAtlasWakeResult,
       doc="Start the profile's local memory daemon if it exited on its idle timeout.")
