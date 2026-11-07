"""Cloud save for the logged-in player's town (the whole game state)."""

from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.auth import CurrentPlayer
from app.models import PlayerOut, TownSave

router = APIRouter(prefix="/town", tags=["town"])

MAX_SAVE_BYTES = 1_000_000  # a real save is a few KB; this just blocks abuse


class TownResponse(BaseModel):
    town: TownSave | None
    saved_at: datetime | None


class SaveResponse(BaseModel):
    saved_at: datetime
    player: PlayerOut


@router.get("", response_model=TownResponse)
async def load_town(player: CurrentPlayer):
    return TownResponse(town=player.town, saved_at=player.town_saved_at)


@router.put("", response_model=SaveResponse)
async def save_town(town: TownSave, request: Request, player: CurrentPlayer):
    if int(request.headers.get("content-length") or 0) > MAX_SAVE_BYTES:
        raise HTTPException(413, "Save is too large")
    player.apply_town(town)
    await player.save()
    assert player.town_saved_at is not None
    return SaveResponse(saved_at=player.town_saved_at, player=PlayerOut.from_doc(player))
