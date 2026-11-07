# Cloudbreakers — HackRPI

*Small choices. Higher tomorrows.*

A level-based sky-settlement game. You start on **New Haven** with nothing but a dormant beacon, build a shelter and a bridge anchor, then spend wood to bridge out to the islands around you.

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
4. Gather and build freely: each successful action earns **10 XP** and updates production and consumption automatically. Complete quests for bonus XP and **level up** to unlock buildings and bridges. Weather changes with your level.
5. **Cloud** (left rail) is the advisor: situation → recommendation → reason → trade-off → confidence.
6. Final goal (*Higher Tomorrows*): 3+ islands connected, water/food/energy/happiness ≥ 50 and sustainability ≥ 60.

Progress saves to the browser's localStorage, and to your account when logged in. Settings (gear) → *New game* resets it.

## Frontend layout

```
frontend/src/
├── game/                 ← all rules live here (no React)
│   ├── data.js           islands, routes, buildings, levels, missions, weather — tune balance here
│   ├── engine.js         pure reducer + helpers (automatic production, missions, XP)
│   ├── advisor.js        rule-based "Cloud" advice (swap for an AI call later)
│   ├── CloudSync.jsx     uploads the save to the backend while logged in
│   └── GameContext.jsx   React state + localStorage save, UI state (open panels, placement)
├── auth/AuthContext.jsx  login state (token in localStorage)
├── api/client.js         backend calls (login, register, load/save town)
├── components/
│   ├── map/              sky map: painted islands/bridges from the concept art + building sprites
│   ├── hud/              top resource bar, title, level badge, weather, rails, XP progress
│   └── panels/           drawers and modals: quests, build, advisor, island, bridge, journal…
├── artPaths.js           (in components/) helpers for painted card art and badges
├── index.css             design tokens + shared UI pieces
└── styles/               hud.css, panels.css, map.css
```

**Art:** `frontend/public/art/` holds pieces cut from the concept art: each island, each bridge, the background islets/moon (`decor.webp`), HUD icons and card art. `src/game/artLayout.json` says where each piece sits in the 1600×900 map. Swap a `.webp` for a new painting at the same position and the game picks it up. `tools/art/` has the scripts that made the cut-outs.

**Connecting to the backend:** the game saves locally and syncs logged-in towns to the cloud. Set `VITE_API_URL` for the frontend service to enable login and cloud saves. The game state shape is the `createInitialState()` object in `engine.js`; the server validates its shape in `backend/app/models/town.py` (update that if you add fields with constraints). If you change the save format, bump `version` in `createInitialState()`. Existing version 2 saves migrate automatically with their XP and town progress preserved. The reducer is deterministic, so the server can replay or validate actions; randomness is supplied as `roll` on `END_TURN`.

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
Backend needs `JWT_SECRET` in `backend/.env` (and in the backend's Vercel environment variables).

The frontend saves to localStorage on every change and, when logged in, uploads to
`PUT /town` every 30s, after each successful gameplay action, and when the tab closes (`frontend/src/game/CloudSync.jsx`).
It needs `VITE_API_URL` (set in docker-compose; on Vercel set it on the frontend project).

## Deploy (Vercel)

Two Vercel projects from this repo. Docker is for local dev only.

| Project | Root Directory | Framework preset | Domain |
|---|---|---|---|
| `cloudbreakers` | `frontend` | Vite | `cloudbreakers.club` (+ `www` redirect) |
| `cloudbreakers-api` | `backend` | FastAPI (finds `app` in `app/main.py`) | `api.cloudbreakers.club` |

Environment variables (Project → Settings → Environment Variables):

- **frontend:** `VITE_API_URL=https://api.cloudbreakers.club` — baked in at build time, redeploy after changing.
- **backend:** `MONGODB_URI`, `MONGODB_DB`, `JWT_SECRET` (long random string, not the local one),
  `ALLOWED_ORIGINS=https://cloudbreakers.club,https://www.cloudbreakers.club`

MongoDB Atlas → Network Access must allow `0.0.0.0/0` (Vercel has no fixed IPs).
Pushes to `main` deploy to production; other branches get preview URLs.
