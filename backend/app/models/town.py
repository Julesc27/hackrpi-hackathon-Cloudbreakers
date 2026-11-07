"""Server-side shape of a game save (mirrors frontend/src/game/engine.js createInitialState).

Validation here only rejects malformed or impossible values (negative stock, happiness 120,
etc.). It does NOT re-run game rules, so a determined player can still edit their own save.
extra="allow" keeps fields the frontend adds later instead of silently dropping them.
"""

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field

NonNegInt = Annotated[int, Field(ge=0)]


class _Loose(BaseModel):
    model_config = ConfigDict(extra="allow")


class Resources(_Loose):
    wood: NonNegInt
    water: NonNegInt
    food: NonNegInt
    energy: NonNegInt
    coins: NonNegInt


class Building(_Loose):
    id: str
    type: str
    island: str
    slot: NonNegInt
    builtTurn: NonNegInt


class Bridge(_Loose):
    route: str
    type: str
    condition: int = Field(ge=0, le=100)
    builtTurn: NonNegInt


class JournalEntry(_Loose):
    id: str
    turn: NonNegInt
    type: str
    title: str
    text: str = ""


class TownSave(_Loose):
    version: int = Field(ge=1)
    townName: str = Field(max_length=60)
    turn: int = Field(ge=1)
    actionsLeft: NonNegInt
    resources: Resources
    happiness: int = Field(ge=0, le=100)
    population: NonNegInt
    sustainability: int = Field(ge=0, le=100)
    sustainPenalty: NonNegInt
    xp: NonNegInt
    blueprints: list[str] = []
    flags: dict[str, bool] = {}
    buildings: list[Building] = []
    beaconRestored: bool = False
    connected: list[str] = []
    discovered: list[str] = []
    bridges: list[Bridge] = []
    weather: str
    forecast: str
    completed: list[str] = []  # mission ids
    counters: dict[str, int] = {}
    journal: list[JournalEntry] = Field(default=[], max_length=2000)
    journalUnread: NonNegInt
    report: dict[str, Any] | None = None
    showReport: bool = False
    seenIntro: bool = False
    nextId: NonNegInt
