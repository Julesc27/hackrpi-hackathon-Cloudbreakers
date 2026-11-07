# Cloudbreakers — HackRPI

*Small choices. Higher tomorrows.*

A turn-based sky-settlement game. You start on **New Haven** with nothing but a dormant beacon, build a shelter and a bridge anchor, then spend wood to bridge out to the islands around you.

```
.
├── frontend/          React + Vite game client (fully playable on its own)
├── backend/           FastAPI + Beanie (MongoDB Atlas)
│   └── app/
│       ├── models/    DB schema (one file per collection)
│       ├── routers/   API endpoints
│       └── db.py      Atlas connection
├── tools/art/         scripts that cut the concept art into game pieces
└── docker-compose.yml
```

## Run locally with Docker

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up --build
```

Open http://localhost:5173. Edits in `frontend/src` hot-reload.

Stop with `Ctrl+C`, or `docker compose down`. If you add an npm package, rebuild with `docker compose up --build -V`.

Without Docker: `cd frontend && npm install && npm run dev`.

## How to play

1. **Build** (left rail) → pick *Shelter* or *Bridge Anchor* → click a glowing plot on New Haven.
2. Click **New Haven** to *gather wood* (or restore the beacon later).
3. Click a glowing **+** between islands to plan a bridge. Rope bridges are cheap but storms damage them; reinforced stone unlocks at level 3.
4. You get **3 actions per turn**. **End Turn** applies production, consumption and weather, then shows a report.
5. **Cloud** (left rail) is the advisor: situation → recommendation → reason → trade-off → confidence.
6. Final goal (*Higher Tomorrows*): 3+ islands connected, water/food/energy/happiness ≥ 50 and sustainability ≥ 60.

Progress saves to the browser's localStorage. Settings (gear) → *New game* resets it.

**Moving around:** drag the sky to pan (it glides), scroll or pinch to zoom, double-click to zoom in, and press `0` or the target button to fly back to New Haven. Arrow keys / WASD and `+`/`−` work too. Tapping an island flies the camera to it. After each turn, tap the bubbles over your islands to collect what they produced.

## Frontend layout

```
frontend/src/
├── game/                 ← all rules live here (no React)
│   ├── data.js           islands, routes, buildings, levels, missions, weather — tune balance here
│   ├── engine.js         pure reducer + helpers (END_TURN simulation, missions, XP)
│   ├── advisor.js        rule-based "Cloud" advice (swap for an AI call later)
│   └── GameContext.jsx   React state + localStorage save, UI state (open panels, placement)
├── api/client.js         stub for the future backend (login, load/save town, advisor)
├── components/
│   ├── map/              sky map: painted islands/bridges from the concept art + building sprites
│   ├── hud/              top resource bar, title, level badge, weather, rails, turn controls
│   └── panels/           drawers and modals: quests, build, advisor, island, bridge, journal…
├── artPaths.js           (in components/) helpers for painted card art and badges
├── index.css             design tokens + shared UI pieces
└── styles/               hud.css, panels.css, map.css
```

**Art:** `frontend/public/art/` holds pieces cut from the concept art: each island, each bridge, the background islets/moon (`decor.webp`), HUD icons and card art. `src/game/artLayout.json` says where each piece sits in the 1600×900 map. Swap a `.webp` for a new painting at the same position and the game picks it up. `tools/art/` has the scripts that made the cut-outs.

**Connecting to the backend:** the game currently saves to localStorage only. Set `VITE_API_URL` for the frontend service and point the calls in `src/api/client.js` at the FastAPI routes. The game state shape is the `createInitialState()` object in `engine.js`. The reducer is deterministic (randomness comes in as `roll` on `END_TURN`), so the server can replay or validate turns.

## Secrets

Copy `backend/.env.example` to `backend/.env` and fill in the Atlas connection string.
API runs at http://localhost:8000 (docs at http://localhost:8000/docs).
`.env` files are git-ignored — never commit them or put DB credentials in the frontend.

## Auth API

| Method | Path | Auth | What |
|---|---|---|---|
| POST | `/auth/register` | — | `{username, password}` → `{access_token, player}` |
| POST | `/auth/login` | — | `{username, password}` → `{access_token, player}` |
| GET | `/me` | Bearer | your player (summary) |
| GET | `/town` | Bearer | your full saved game → `{town, saved_at}` |
| PUT | `/town` | Bearer | save your full game (the frontend does this automatically) |
| GET | `/players/{username}` | — | public profile |

Send the token as `Authorization: Bearer <access_token>`. Tokens last 7 days.
Backend needs `JWT_SECRET` in `backend/.env` (and in Railway variables).

The frontend saves to localStorage on every change and, when logged in, uploads to
`PUT /town` every 30s, after each turn, and when the tab closes (`frontend/src/game/CloudSync.jsx`).
It needs `VITE_API_URL` (set in docker-compose; on Railway set it on the frontend service).
