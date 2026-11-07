#!/usr/bin/env bash
# One-time setup for the production VM (Ubuntu 24.04). Safe to re-run.
#   curl -fsSL https://raw.githubusercontent.com/Julesc27/hackrpi-hackathon-Cloudbreakers/main/deploy/setup-vm.sh | bash
# or, from a clone:  bash deploy/setup-vm.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Julesc27/hackrpi-hackathon-Cloudbreakers.git}"
REPO_DIR="${REPO_DIR:-/opt/cloudbreakers}"
DEPLOY_USER="${DEPLOY_USER:-$(id -un)}"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

log "Packages"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git python3-venv curl ca-certificates >/dev/null

if ! command -v docker >/dev/null; then
  log "Docker"
  curl -fsSL https://get.docker.com | sudo sh >/dev/null
fi
sudo usermod -aG docker "$DEPLOY_USER"
sudo systemctl enable --now docker >/dev/null

# Small VMs (1 GB) need swap to build the frontend image.
if ! swapon --show | grep -q /swapfile; then
  log "2 GB swap"
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

log "Repo at $REPO_DIR"
if [ ! -d "$REPO_DIR/.git" ]; then
  sudo mkdir -p "$REPO_DIR"
  sudo chown "$DEPLOY_USER:$DEPLOY_USER" "$REPO_DIR"
  git clone --quiet "$REPO_URL" "$REPO_DIR"
fi
git -C "$REPO_DIR" config --global --add safe.directory "$REPO_DIR" || true

log "Deploy hook (systemd)"
python3 -m venv "$REPO_DIR/deploy/hook/.venv"
"$REPO_DIR/deploy/hook/.venv/bin/pip" install -q -r "$REPO_DIR/deploy/hook/requirements.txt"
sed -e "s#__USER__#$DEPLOY_USER#g" -e "s#__REPO__#$REPO_DIR#g" \
  "$REPO_DIR/deploy/hook/cloudbreakers-deploy-hook.service" \
  | sudo tee /etc/systemd/system/cloudbreakers-deploy-hook.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now cloudbreakers-deploy-hook >/dev/null
sudo systemctl restart cloudbreakers-deploy-hook

if [ ! -f "$REPO_DIR/backend/.env" ]; then
  cat <<EOF

backend/.env is missing. Create $REPO_DIR/backend/.env with:
  MONGODB_URI=...
  MONGODB_DB=cloudbreakers
  JWT_SECRET=<python3 -c "import secrets; print(secrets.token_urlsafe(48))">
then re-run this script.
EOF
  exit 1
fi
chmod 600 "$REPO_DIR/backend/.env"

log "Starting the site"
cd "$REPO_DIR"
sudo docker compose -f deploy/docker-compose.prod.yml up -d --build --remove-orphans
sudo docker compose -f deploy/docker-compose.prod.yml ps

log "Done. Hook: $(curl -s localhost:9000/health)"
