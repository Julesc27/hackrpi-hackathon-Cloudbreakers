# Cloudbreakers — HackRPI

```
.
├── frontend/          React + Vite app
├── backend/           (empty — to be added)
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

Keep credentials (e.g. MongoDB Atlas) in `backend/.env` once the backend exists.
`.env` files are git-ignored — never commit them or put DB credentials in the frontend.
