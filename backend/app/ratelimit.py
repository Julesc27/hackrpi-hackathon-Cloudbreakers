"""Small in-memory rate limiter for the auth endpoints (single backend process).

Limits guessing passwords and mass sign-ups. Client IP comes from Caddy's X-Forwarded-For,
which uvicorn applies when FORWARDED_ALLOW_IPS is set (production compose does this; Caddy
ignores X-Forwarded-For sent by clients, so it can't be spoofed from outside).
"""

import time
from collections import deque
from threading import Lock

from fastapi import HTTPException, Request, status

# name: (max events, window seconds)
LIMITS = {
    "login_ip": (30, 10 * 60),          # login attempts per IP
    "login_fail_user": (50, 60 * 60),   # failed logins per username, from anywhere
    "register_ip": (10, 60 * 60),       # new accounts per IP
}
MAX_KEYS = 50_000  # memory cap; oldest entries are dropped past this

_events: dict[tuple[str, str], deque[float]] = {}
_lock = Lock()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _bucket(name: str, key: str, now: float) -> deque[float]:
    _, window = LIMITS[name]
    q = _events.get((name, key))
    if q is None:
        if len(_events) >= MAX_KEYS:
            for k in list(_events)[: MAX_KEYS // 10]:
                del _events[k]
        q = _events[(name, key)] = deque()
    while q and q[0] <= now - window:
        q.popleft()
    return q


def check(name: str, key: str) -> None:
    """Raise 429 if `key` already used up its `name` limit."""
    limit, window = LIMITS[name]
    now = time.monotonic()
    with _lock:
        q = _bucket(name, key.lower(), now)
        if len(q) >= limit:
            retry = int(q[0] + window - now) + 1
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many attempts, try again later",
                headers={"Retry-After": str(retry)},
            )


def hit(name: str, key: str) -> None:
    with _lock:
        _bucket(name, key.lower(), time.monotonic()).append(time.monotonic())


def reset() -> None:  # for tests
    with _lock:
        _events.clear()
