from fastapi import APIRouter, HTTPException
from pymongo.errors import DuplicateKeyError

from app.models import Player

router = APIRouter(prefix="/players", tags=["players"])


@router.post("", response_model=Player, status_code=201)
async def create_player(player: Player):
    try:
        await player.insert()
    except DuplicateKeyError:
        raise HTTPException(409, "Username already taken")
    return player


@router.get("/{username}", response_model=Player)
async def get_player(username: str):
    player = await Player.find_one(Player.username == username)
    if player is None:
        raise HTTPException(404, "Player not found")
    return player
