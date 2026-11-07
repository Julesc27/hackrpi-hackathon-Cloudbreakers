from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import db
from app.routers import players


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    yield
    await db.disconnect()


app = FastAPI(title="Cloudbreakers API", lifespan=lifespan)

# Comma-separated list of frontend origins allowed to call the API.
# On Railway set ALLOWED_ORIGINS=https://<your-frontend>.up.railway.app
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        o.strip()
        for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
        if o.strip()
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router)


@app.get("/health")
def health():
    return {"status": "ok"}
