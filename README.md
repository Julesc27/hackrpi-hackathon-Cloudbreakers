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

1. **Build** (left rail) → pick *Shelter* → click a glowing plot on New Haven. Choose *Unlock bridges* in the workshop to enable crossings without using a plot.
2. Click **New Haven** to *gather wood* (or restore the beacon later).
3. Click a glowing **+** between islands to plan a bridge. Rope bridges are cheap but storms damage them; reinforced stone unlocks at level 3.
4. Gather and build freely: each successful action earns **10 XP** and updates production and consumption automatically. Complete quests for bonus XP and **level up** to unlock buildings and bridges. Weather changes with your level.
5. **Cloud** (left rail) is the advisor: situation → recommendation → reason → trade-off → confidence.
6. Final goal (*Higher Tomorrows*): 3+ islands connected, water/food/energy/happiness ≥ 50 and sustainability ≥ 60.

Progress saves to the browser's localStorage, and to your account when logged in. Settings (gear) → *New game* resets it.

**Moving around:** drag the sky to pan (it glides), scroll or pinch to zoom, double-click to zoom in, and press `0` or the target button to fly back to New Haven. Arrow keys / WASD and `+`/`−` work too. Tapping an island flies the camera to it. Each action you take shows what your islands produced as bubbles you can tap.

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
│   ├── world/            the living map, drawn in code every frame (islands, buildings, bridges, residents)
│   ├── map/              camera (pan/zoom), clickable overlay (labels, bridge buttons, plots), effects
│   ├── hud/              top resource bar, title, level badge, weather, rails, XP progress
│   └── panels/           drawers and modals: quests, build, advisor, island, bridge, journal…
├── artPaths.js           (in components/) helpers for painted card art and badges
├── index.css             design tokens + shared UI pieces
└── styles/               hud.css, panels.css, map.css
```

**The map:** independent painted island and building sprites are animated on a canvas. `components/world/` draws it on a canvas every frame, styled after the concept art:
- `layout.js`: where every island, building, tree, path, waterfall and walkway is. Move things here.
- `props.js`: how each kind of thing is drawn (houses, beacon tower, turbines, reservoirs, clinic, greenhouse, windmill, stalls, banners…).
- `island.js`: rock undersides, cloud rims, grass, plazas, paths, fields, pools, decks.
- `people.js`: bridge curves. The town has a population count, but no characters are drawn.
- `WorldCanvas.jsx`: the render loop (static parts are cached as bitmaps per zoom level; moving parts redraw each frame).

Islands you haven't connected are drawn in a cool night tint. Player-built buildings appear on the plots listed in `game/data.js`.

**Art:** `frontend/public/art/` contains transparent island and building PNGs. `components/world/paintedArt.js` maps them to the world. Icons and panel scenes use drawn graphics; `concept/` holds the visual references.

**Connecting to the backend:** the game saves locally and syncs logged-in towns to the cloud. Set `VITE_API_URL` for the frontend service to enable login and cloud saves. The game state shape is the `createInitialState()` object in `engine.js`; the server validates its shape in `backend/app/models/town.py` (update that if you add fields with constraints). If you change the save format, bump `version` in `createInitialState()`. Existing version 2–5 saves migrate automatically with their XP and town progress preserved. The reducer is deterministic, so the server can replay or validate actions; gameplay advances after successful actions.

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

## Current island chapter

- **New Haven**: eight shelter/building plots, a finite grove (36 harvestable wood), finite stone (18), a starter garden, collector, workshop and bridge anchors.
- **Verdant Reach**: renewable wood, food, seeds and building materials.
- **Rain Island**: fresh water, fishing, irrigation supplies and stone for infrastructure.
- **Prism Shelf**: energy crystals, power, stone and advanced building materials. Solar farms, batteries and wind turbines consume these resources.
- **Mercy Rise**: the hospital island improves resident happiness and supports community buildings.
- **Hearthside**: the village provides eight additional homes and a small food supply.

Click the resource landmarks to gather. Leaves, stone chips, water splashes and crystal sparkles show successful interactions; rewards appear over the source. Depleted starter deposits reject further harvesting. Gardens consume seeds, so expansion supplies a sustainable crop cycle. The workshop opens building placement, structures appear on their selected plots, and new bridges animate into place. Reduced-motion preferences are respected.

The progression remains XP-based, with no End Turn control. Save version 5 migrates older towns into the current island chapter, retaining resources, XP, missions and structures; buildings from retired island layouts relocate to available plots on the corresponding resource island.

Storm Island, Cloudroot Island, Ancient Ruins, Skyport Island and Void Island are future chapter ideas and are not active destinations in this map.


New towns start with no bridges. Route buttons offer construction choices, but no bridge geometry appears until a valid build action pays its cost. A new bridge reveals its entire deck, posts and rails together from New Haven toward the destination. Its endpoints follow both islands’ floating motion, and built spans can be selected along their full length.

Bridge access is a one-time workshop upgrade. It does not place a decorative bridge on the island or consume a shelter plot. Existing anchor buildings migrate to the plot-free upgrade. Use **Manage bridges** in the workshop to plan, reinforce or repair crossings.
