from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import db
from app.routers import players


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    yield
    await db.disconnect()


app = FastAPI(title="Cloudbreakers API", lifespan=lifespan)
app.include_router(players.router)


@app.get("/health")
def health():
    return {"status": "ok"}
