"""Password hashing, JWT tokens, and the get_current_player dependency."""

import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from beanie import PydanticObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash

from app.models import Player

ALGORITHM = "HS256"
TOKEN_TTL = timedelta(days=7)

_hasher = PasswordHash.recommended()  # argon2
_bearer = HTTPBearer(auto_error=False)


def _secret() -> str:
    secret = os.getenv("JWT_SECRET")
    if not secret or secret == "change-me":
        raise RuntimeError(
            "JWT_SECRET is not set (or still 'change-me'). Add a long random string "
            "to backend/.env and to the backend project's Vercel environment variables."
        )
    return secret


def check_config() -> None:
    """Called at startup so a missing secret fails the deploy loudly."""
    _secret()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _hasher.verify(password, password_hash)


def create_token(player: Player) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(player.id), "iat": now, "exp": now + TOKEN_TTL}
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not logged in or session expired",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_player(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Player:
    if creds is None:
        raise _UNAUTHORIZED
    try:
        payload = jwt.decode(creds.credentials, _secret(), algorithms=[ALGORITHM])
        player_id = PydanticObjectId(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError, TypeError):
        raise _UNAUTHORIZED
    player = await Player.get(player_id)
    if player is None:
        raise _UNAUTHORIZED
    return player


CurrentPlayer = Annotated[Player, Depends(get_current_player)]
