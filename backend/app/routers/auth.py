from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from app.auth import create_token, hash_password, verify_password
from app.models import Player, PlayerOut

router = APIRouter(prefix="/auth", tags=["auth"])


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=6, max_length=128)


class LoginBody(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    player: PlayerOut


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(body: Credentials):
    player = Player(username=body.username, password_hash=hash_password(body.password))
    try:
        await player.insert()
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")
    return AuthResponse(access_token=create_token(player), player=PlayerOut.from_doc(player))


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginBody):
    player = await Player.find_one(Player.username == body.username)
    if player is None or not verify_password(body.password, player.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong username or password")
    return AuthResponse(access_token=create_token(player), player=PlayerOut.from_doc(player))
