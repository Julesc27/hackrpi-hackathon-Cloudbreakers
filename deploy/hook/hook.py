"""Deploy hook: the manual "Deploy" GitHub Actions workflow calls this; it redeploys the VM.

Auth uses GitHub's OIDC tokens (no shared secret anywhere):
  - the workflow requests a short-lived JWT signed by GitHub (permissions: id-token: write)
  - we verify the signature against GitHub's public keys and check the claims:
    right repository (by numeric id), branch main, our deploy workflow file as it exists on
    main, started by hand or on a main push (workflow_dispatch/push) on a GitHub-hosted runner, our audience
So a stranger who finds this URL can't trigger anything. Forks have a different repository id,
and other branches/workflows/events (pull requests etc.) are refused.

Deploys only the commit the run was for, and only if it is still the tip of main
(an older run never rolls the site back). One deploy at a time.

Stdlib HTTP server + PyJWT. Configure with environment variables (see CONFIG below).
"""

import json
import logging
import os
import re
import secrets
import subprocess
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import jwt

CONFIG = {
    # Docker's bridge address: reachable from containers (Caddy), not from the internet.
    "listen_host": os.getenv("HOOK_HOST", "172.17.0.1"),
    "listen_port": int(os.getenv("HOOK_PORT", "9000")),
    "repo_dir": os.getenv("REPO_DIR", "/opt/cloudbreakers"),
    # GitHub's numeric repo id survives renames and transfers (owner/name does not).
    "repository_id": os.getenv("EXPECTED_REPOSITORY_ID", "1446312525"),
    "branch": os.getenv("DEPLOY_BRANCH", "main"),
    "workflow_file": os.getenv("DEPLOY_WORKFLOW", ".github/workflows/deploy.yml"),
    "audience": os.getenv("OIDC_AUDIENCE", "cloudbreakers-deploy"),
    "issuer": os.getenv("OIDC_ISSUER", "https://token.actions.githubusercontent.com"),
    "jwks_url": os.getenv("OIDC_JWKS_URL", "https://token.actions.githubusercontent.com/.well-known/jwks"),
    "deploy_cmd": os.getenv(
        "DEPLOY_CMD",
        "docker compose -f deploy/docker-compose.prod.yml up -d --build --remove-orphans",
    ),
    "deploy_timeout": int(os.getenv("DEPLOY_TIMEOUT", "1200")),
}

MAX_TOKEN_LEN = 8192
SHA_RE = re.compile(r"^[0-9a-f]{40}$")

log = logging.getLogger("deploy-hook")
_deploy_lock = threading.Lock()
_seen_jti: dict[str, float] = {}  # token id -> expiry, to refuse replays
_seen_lock = threading.Lock()


class _Jwks:
    """GitHub's signing keys, cached for an hour. Tokens with an unknown key id trigger at most
    one refetch per minute, so junk tokens can't make us hammer GitHub."""

    def __init__(self, url: str):
        self.url, self.keys, self.fetched_at, self.lock = url, {}, 0.0, threading.Lock()

    def _fetch(self):
        with urllib.request.urlopen(self.url, timeout=10) as r:
            data = json.load(r)
        self.keys = {k["kid"]: jwt.PyJWK(k).key for k in data.get("keys", []) if "kid" in k}
        self.fetched_at = time.monotonic()

    def get(self, kid: str):
        with self.lock:
            age = time.monotonic() - self.fetched_at
            if age > 3600 or (kid not in self.keys and age > 60):
                self._fetch()
            if kid not in self.keys:
                raise jwt.InvalidTokenError("unknown signing key")
            return self.keys[kid]


_jwks = _Jwks(CONFIG["jwks_url"])


class HookError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def verify(token: str) -> dict:
    if len(token) > MAX_TOKEN_LEN:
        raise HookError(401, "invalid token: too long")
    try:
        header = jwt.get_unverified_header(token)
        if header.get("alg") != "RS256":
            raise jwt.InvalidTokenError("unexpected algorithm")
        key = _jwks.get(str(header.get("kid", "")))
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=CONFIG["audience"],
            issuer=CONFIG["issuer"],
            options={"require": ["exp", "iat", "nbf", "iss", "aud", "sub", "jti"]},
            leeway=30,
        )
    except (jwt.PyJWTError, OSError, ValueError, KeyError) as e:
        raise HookError(401, f"invalid token: {e}")

    want_ref = f"refs/heads/{CONFIG['branch']}"
    checks = {
        "repository_id": str(claims.get("repository_id")) == CONFIG["repository_id"],
        "ref": claims.get("ref") == want_ref,
        "ref_type": claims.get("ref_type") == "branch",
        # workflow_ref looks like "owner/repo/.github/workflows/deploy.yml@refs/heads/main"
        "workflow": str(claims.get("workflow_ref", "")).endswith(f"/{CONFIG['workflow_file']}@{want_ref}"),
        "event": claims.get("event_name") in ("workflow_dispatch", "push"),
        "runner": claims.get("runner_environment") == "github-hosted",
        "sha": isinstance(claims.get("sha"), str) and bool(SHA_RE.match(claims["sha"])),
    }
    failed = [k for k, ok in checks.items() if not ok]
    if failed:
        raise HookError(403, f"token not allowed to deploy (failed: {', '.join(failed)})")

    with _seen_lock:
        now = time.time()
        for jti, exp in list(_seen_jti.items()):
            if exp < now:
                del _seen_jti[jti]
        if claims["jti"] in _seen_jti:
            raise HookError(409, "token already used")
        _seen_jti[claims["jti"]] = float(claims["exp"])
    return claims


def run(cmd: str, timeout: int = 300) -> str:
    log.info("$ %s", cmd)
    p = subprocess.run(
        cmd, shell=True, cwd=CONFIG["repo_dir"], capture_output=True, text=True, timeout=timeout,
    )
    out = (p.stdout + p.stderr).strip()
    if p.returncode != 0:
        raise HookError(500, f"`{cmd}` failed ({p.returncode}):\n{out[-3000:]}")
    return out


def _changed(old: str, new: str, path: str) -> bool:
    try:
        return bool(run(f"git diff --name-only {old} {new} -- {path}"))
    except HookError:
        return True


def deploy(sha: str) -> dict:
    branch = CONFIG["branch"]
    with _deploy_lock:  # queue behind any running deploy
        run(f"git fetch --quiet origin {branch}")
        tip = run(f"git rev-parse origin/{branch}")
        if tip != sha:
            return {"status": "skipped", "reason": f"{sha[:7]} is no longer the tip of {branch} ({tip[:7]})"}
        current = run("git rev-parse HEAD")
        run(f"git reset --hard --quiet {sha}")  # untracked files like backend/.env are kept
        started = time.time()
        output = run(CONFIG["deploy_cmd"], timeout=CONFIG["deploy_timeout"])
        try:
            run("docker image prune -f", timeout=120)
        except Exception:  # cleanup is best-effort
            pass
        return {
            "status": "deployed",
            "from": current[:7],
            "to": sha[:7],
            "seconds": round(time.time() - started, 1),
            "log_tail": output[-1500:],
            "_hook_changed": _changed(current, sha, "deploy/hook"),
        }


# ---- async jobs ----------------------------------------------------------------------------
# A deploy rebuilds the Caddy container that carries the caller's connection, so we can't hold
# the request open until it finishes. POST /hook answers 202 with a random job id right away;
# the workflow polls GET /status/<id>. The id is unguessable and only handed to the verified
# caller. Job state is kept in a small file so it survives the hook restarting itself.

STATE_FILE = os.getenv("STATE_FILE", "/var/tmp/cloudbreakers-deploy-jobs.json")
MAX_JOBS = 20
_jobs_lock = threading.Lock()


def _load_jobs() -> dict:
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _save_job(job_id: str, job: dict) -> None:
    with _jobs_lock:
        jobs = _load_jobs()
        jobs[job_id] = job
        for old in sorted(jobs, key=lambda k: jobs[k].get("created", 0))[:-MAX_JOBS]:
            del jobs[old]
        tmp = STATE_FILE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(jobs, f)
        os.replace(tmp, STATE_FILE)


def _run_job(job_id: str, sha: str, actor: str) -> None:
    job = {"status": "running", "sha": sha[:7], "actor": actor, "created": time.time()}
    restart = False
    try:
        _save_job(job_id, job)
        result = deploy(sha)
        restart = result.pop("_hook_changed", False)
        job.update(result)
    except HookError as e:
        job.update(status="failed", error=str(e))
    except subprocess.TimeoutExpired as e:
        job.update(status="failed", error=f"timed out: {e.cmd}")
    except Exception as e:  # never leave a job stuck in "running"
        job.update(status="failed", error=f"{type(e).__name__}: {e}")
    job["finished"] = time.time()
    _save_job(job_id, job)
    log.info("job %s: %s", job_id[:6], {k: v for k, v in job.items() if k != "log_tail"})
    if restart:
        # The deploy changed this hook's code: exit so systemd starts the new version.
        log.info("hook code changed, restarting")
        time.sleep(1)
        os._exit(0)


class Handler(BaseHTTPRequestHandler):
    server_version = "cloudbreakers-deploy-hook"

    def _send(self, status: int, body: dict):
        data = json.dumps(body, indent=2).encode()
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            log.info("client went away before the response was sent")

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"status": "ok"})
        if self.path.startswith("/status/"):
            job = _load_jobs().get(self.path[len("/status/"):])
            if job is None:
                return self._send(404, {"error": "unknown job"})
            return self._send(200, job)
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/hook":
            return self._send(404, {"error": "not found"})
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return self._send(401, {"error": "missing bearer token"})
        try:
            claims = verify(auth[len("Bearer "):].strip())
        except HookError as e:
            log.warning("rejected (%s): %s", e.status, str(e).splitlines()[0])
            return self._send(e.status, {"error": str(e)})
        job_id = secrets.token_urlsafe(24)
        log.info("deploy %s requested by %s for %s (run %s)", job_id[:6], claims.get("actor"), claims["sha"][:7], claims.get("run_id"))
        _save_job(job_id, {"status": "queued", "sha": claims["sha"][:7], "created": time.time()})
        threading.Thread(target=_run_job, args=(job_id, claims["sha"], str(claims.get("actor"))), daemon=True).start()
        self._send(202, {"status": "queued", "job": job_id, "status_url": f"/status/{job_id}"})

    def log_message(self, format, *args):  # noqa: A002 - must match the base class signature
        log.info("%s %s", self.address_string(), format % args)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    srv = ThreadingHTTPServer((CONFIG["listen_host"], CONFIG["listen_port"]), Handler)
    log.info("listening on %s:%s, repo %s", CONFIG["listen_host"], CONFIG["listen_port"], CONFIG["repo_dir"])
    srv.serve_forever()


if __name__ == "__main__":
    main()
