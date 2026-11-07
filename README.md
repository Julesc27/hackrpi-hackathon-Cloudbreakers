# Cloudbreakers — HackRPI

```
.
├── frontend/          React + Vite app
├── backend/           FastAPI + Beanie (MongoDB Atlas)
│   └── app/
│       ├── models/    DB schema (one file per collection)
│       ├── routers/   API endpoints
│       └── db.py      Atlas connection
└── docker-compose.yml
```

## Run locally with Docker

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up --build
```

Open http://localhost:5173. Edits in `frontend/src` hot-reload.

Stop with `Ctrl+C`, or `docker compose down`.

If you add a new npm package, rebuild so the container picks it up:

```bash
docker compose up --build -V
```

## Run without Docker (optional)

```bash
cd frontend
npm install
npm run dev
```

## Secrets

Copy `backend/.env.example` to `backend/.env` and fill in the Atlas connection string.
API runs at http://localhost:8000 (docs at http://localhost:8000/docs).
`.env` files are git-ignored — never commit them or put DB credentials in the frontend.
