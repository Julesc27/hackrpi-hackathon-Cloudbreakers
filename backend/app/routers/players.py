from fastapi import APIRouter, HTTPException

from app.auth import CurrentPlayer
from app.models import Player, PlayerOut

router = APIRouter(tags=["players"])


@router.get("/me", response_model=PlayerOut)
async def get_me(player: CurrentPlayer):
    return PlayerOut.from_doc(player)


@router.get("/players/{username}", response_model=PlayerOut)
async def get_player(username: str):
    """Public profile lookup (e.g. leaderboards). No login needed."""
    player = await Player.find_one(Player.username == username)
    if player is None:
        raise HTTPException(404, "Player not found")
    return PlayerOut.from_doc(player)
