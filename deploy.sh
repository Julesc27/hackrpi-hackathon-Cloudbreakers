#!/usr/bin/env bash
# Deploy what's on GitHub main to https://cloudbreakers.club
# Starts the "Deploy" GitHub Actions pipeline (build checks -> server redeploy) and follows it.
# Needs the GitHub CLI logged in with push access:  gh auth login
set -euo pipefail

REPO="Julesc27/hackrpi-hackathon-Cloudbreakers"
WORKFLOW="deploy.yml"

command -v gh >/dev/null || { echo "Install the GitHub CLI first: https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Run: gh auth login"; exit 1; }

# Deploys use GitHub's main, not your local files. Warn about work that isn't pushed.
if git rev-parse --git-dir >/dev/null 2>&1; then
  git fetch -q origin main || true
  ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
  dirty=$(git status --porcelain | wc -l | tr -d ' ')
  if [ "$ahead" != "0" ] || [ "$dirty" != "0" ]; then
    echo "Heads up: you have $ahead unpushed commit(s) and $dirty uncommitted change(s)."
    echo "Only what's on GitHub main gets deployed."
    read -r -p "Deploy GitHub main anyway? [y/N] " ok
    [[ "$ok" =~ ^[Yy]$ ]] || exit 1
  fi
fi

tip=$(gh api "repos/$REPO/commits/main" --jq '.sha[0:7] + "  " + (.commit.message | split("\n")[0])')
echo "Deploying main @ $tip"

before=$(gh run list -R "$REPO" -w "$WORKFLOW" -L 1 --json databaseId --jq '.[0].databaseId // 0')
gh workflow run "$WORKFLOW" -R "$REPO" --ref main

# Wait for the new run to show up, then follow it until it finishes.
for _ in $(seq 1 30); do
  run=$(gh run list -R "$REPO" -w "$WORKFLOW" -L 1 --json databaseId --jq '.[0].databaseId // 0')
  [ "$run" != "$before" ] && [ "$run" != "0" ] && break
  sleep 2
done
[ "$run" != "$before" ] || { echo "Couldn't find the new run; check the Actions tab."; exit 1; }

echo "Run: https://github.com/$REPO/actions/runs/$run"
if gh run watch "$run" -R "$REPO" --exit-status --interval 5; then
  echo "Deployed. https://cloudbreakers.club"
else
  echo "Deploy failed. Logs:"; gh run view "$run" -R "$REPO" --log-failed | tail -40
  exit 1
fi
