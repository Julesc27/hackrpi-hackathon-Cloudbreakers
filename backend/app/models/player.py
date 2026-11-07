from datetime import datetime, timezone
from typing import Annotated

from beanie import Document, Indexed
from pydantic import BaseModel, Field

from app.models.town import TownSave


class Player(Document):
    username: Annotated[str, Indexed(unique=True)]
    password_hash: str  # argon2 hash, never the plain password; never returned by the API

    # Full game save from the frontend (None until the first cloud save).
    town: TownSave | None = None
    town_saved_at: datetime | None = None

    # Summary copied out of `town` on every save, so leaderboards/queries don't
    # have to dig into the save blob. Never set these directly; use apply_town().
    experience: int = Field(default=0, ge=0)
    coins: int = Field(default=0, ge=0)
    food: int = Field(default=0, ge=0)
    # mission id -> completed? e.g. {"firstWater": True}
    completion: dict[str, bool] = Field(default_factory=dict)
    turn: int = Field(default=0, ge=0)
    town_name: str | None = None

    class Settings:
        name = "players"  # MongoDB collection name

    def apply_town(self, town: TownSave) -> None:
        self.town = town
        self.town_saved_at = datetime.now(timezone.utc)
        self.experience = town.xp
        self.coins = town.resources.coins
        self.food = town.resources.food
        self.completion = {mission_id: True for mission_id in town.completed}
        self.turn = town.turn or 0  # retained for legacy profile consumers
        self.town_name = town.townName


class PlayerOut(BaseModel):
    """What the API returns for a player (no password_hash, no full save)."""

    id: str
    username: str
    experience: int
    coins: int
    food: int
    completion: dict[str, bool]
    turn: int
    town_name: str | None

    @classmethod
    def from_doc(cls, p: Player) -> "PlayerOut":
        return cls(
            id=str(p.id),
            username=p.username,
            experience=p.experience,
            coins=p.coins,
            food=p.food,
            completion=p.completion,
            turn=p.turn,
            town_name=p.town_name,
        )
