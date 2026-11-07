"""Consult the Gods: the store item that returns a riddle about a real strategy."""

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app import oracle, ratelimit
from app.auth import CurrentPlayer
from app.models import TownSave

router = APIRouter(prefix="/advisor", tags=["advisor"])

MAX_BODY_BYTES = 200_000  # the frontend strips the journal; a town is a few KB


class OracleResponse(BaseModel):
    poem: str


@router.post("", response_model=OracleResponse)
async def consult_gods(town: TownSave, request: Request, player: CurrentPlayer):
    if int(request.headers.get("content-length") or 0) > MAX_BODY_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Town is too large")
    key = str(player.id)
    ratelimit.check("oracle_player", key)
    ratelimit.hit("oracle_player", key)  # counts failed calls too: each one still costs money
    try:
        reply = await oracle.consult(town.model_dump(exclude={"journal"}))
    except oracle.OracleUnavailable as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))
    return OracleResponse(poem=reply["poem"])
