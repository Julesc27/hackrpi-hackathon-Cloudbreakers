# --- dev: Vite dev server with hot reload (used by docker-compose) ---
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# --- build: compile static files ---
FROM dev AS build
# Vite bakes this into the bundle at build time. On Railway, set VITE_API_URL on the
# frontend service (e.g. https://<backend>.up.railway.app); Railway passes it as a build arg.
ARG VITE_API_URL
RUN npm run build

# --- prod (final stage, used by Railway): serve the static build on $PORT ---
FROM node:20-alpine AS prod
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/dist ./dist
EXPOSE 3000
# -s = single-page-app fallback to index.html
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT:-3000}"]
