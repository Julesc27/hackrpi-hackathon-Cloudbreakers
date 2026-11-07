from typing import Annotated

from beanie import Document, Indexed
from pydantic import BaseModel, Field


class Player(Document):
    username: Annotated[str, Indexed(unique=True)]
    password_hash: str  # argon2 hash, never the plain password; never returned by the API
    experience: int = Field(default=0, ge=0)
    coins: int = Field(default=0, ge=0)
    food: int = Field(default=0, ge=0)
    # mission name -> completed? e.g. {"tutorial": True, "boss_1": False}
    completion: dict[str, bool] = Field(default_factory=dict)

    class Settings:
        name = "players"  # MongoDB collection name


class PlayerOut(BaseModel):
    """What the API returns for a player (no password_hash)."""

    id: str
    username: str
    experience: int
    coins: int
    food: int
    completion: dict[str, bool]

    @classmethod
    def from_doc(cls, p: Player) -> "PlayerOut":
        return cls(
            id=str(p.id),
            username=p.username,
            experience=p.experience,
            coins=p.coins,
            food=p.food,
            completion=p.completion,
        )


class PlayerUpdate(BaseModel):
    """Fields a logged-in player may change on themselves. All optional."""

    experience: int | None = Field(default=None, ge=0)
    coins: int | None = Field(default=None, ge=0)
    food: int | None = Field(default=None, ge=0)
    # Merged into existing completion, e.g. {"boss_1": true} only flips boss_1
    completion: dict[str, bool] | None = None
