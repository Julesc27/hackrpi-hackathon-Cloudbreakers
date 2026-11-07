from typing import Annotated

from beanie import Document, Indexed
from pydantic import Field


class Player(Document):
    username: Annotated[str, Indexed(unique=True)]
    experience: int = Field(default=0, ge=0)
    coins: int = Field(default=0, ge=0)
    food: int = Field(default=0, ge=0)
    # mission name -> completed? e.g. {"tutorial": True, "boss_1": False}
    completion: dict[str, bool] = Field(default_factory=dict)

    class Settings:
        name = "players"  # MongoDB collection name
