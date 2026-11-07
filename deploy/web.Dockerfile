# Builds the frontend, then ships it inside Caddy. Build context: repo root.
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
ARG VITE_API_URL
RUN npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
