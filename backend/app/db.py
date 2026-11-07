import os

from beanie import init_beanie
from pymongo import AsyncMongoClient

from app.models import DOCUMENT_MODELS

_client: AsyncMongoClient | None = None


async def connect() -> None:
    global _client
    uri = os.getenv("MONGODB_URI")
    if not uri:
        raise RuntimeError(
            "MONGODB_URI is not set. Copy backend/.env.example to backend/.env "
            "and fill in your Atlas connection string."
        )
    client = AsyncMongoClient(uri)
    _client = client
    db = client[os.getenv("MONGODB_DB", "cloudbreakers")]
    # Registers models and creates their indexes (e.g. unique username).
    await init_beanie(database=db, document_models=DOCUMENT_MODELS)


async def disconnect() -> None:
    if _client is not None:
        await _client.close()
