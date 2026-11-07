"""Consult the Gods: an AI on Databricks reads the game's code and the player's town,
works out a real strategy, and answers with the vaguest possible poem about it.

Config (backend/.env): DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_ENDPOINT.
The endpoint can be a Foundation Model API endpoint or a deployed agent; both
request and response shapes are handled below.
"""

import json
import logging
import os
import re
from functools import lru_cache
from pathlib import Path

import httpx

log = logging.getLogger("uvicorn.error")  # uvicorn prints this logger; the root one is silent

ADVISOR_DIR = Path(__file__).resolve().parents[1] / "advisor"
GAME_FILES = ("data.js", "engine.js")  # copied by tools/sync_advisor_context.py
TIMEOUT_SECONDS = 45
ATTEMPTS = 2
MAX_POEM_CHARS = 1200
MIN_POEM_LINES = 4
MAX_POEM_LINES = 12

RULES = """You are the gods of Cloudbreakers, a game about building a sustainable town in the sky.
Below are the game's design document and its source code: the true laws beneath the sky.
You wrote them. (The developers are you.)

A player has lit a lantern and asked for your counsel. Do two things.

1. "strategy": study the code and this player's town and find the single best strategy for
   them right now: the move an expert who has read the source would make. Use real costs,
   unlock levels, production and upkeep, mission rewards, deposits and weather. Be specific
   and correct. Write it plainly. The player never sees this.

2. "poem": hide that strategy in a poem of 4 to 8 short lines, said in the vaguest way possible,
   like an oracle who enjoys being cryptic.
   - Speak only in metaphor: weather, birds, bones, threads, hearths, tides, seasons, stars.
     Never say what to build, gather or connect in plain words.
   - Never name, or nearly name, a building, island, resource, mission, level, button or menu.
     ("first step" is too close to the mission "First Steps"; "home" is too close to "shelter".)
   - No numbers, in digits or words.
   - Every line must still point at something real in the strategy, so a clever player could
     decode it, or recognise it in hindsight.
   - You may wink that the gods have read the scripture beneath the world, but never quote code
     or name files.
   - No title, no explanation, no plain-language hint.

   Too plain: "Plant a garden before the food runs out."
   Right:     "Before the larder echoes, / bury small suns in the wet dark; / the hungry season is patient."
   (That is only an example of tone. Never reuse its words.)

Reply with only a JSON object, no other text:
{"strategy": "...", "poem": "first line\\nsecond line\\n..."}"""


class OracleUnavailable(Exception):
    """The gods could not be reached or gave no usable answer."""


def _config() -> tuple[str, str, str]:
    host = os.getenv("DATABRICKS_HOST", "").strip().rstrip("/")
    token = os.getenv("DATABRICKS_TOKEN", "").strip()
    endpoint = os.getenv("DATABRICKS_ENDPOINT", "").strip()
    if not (host and token and endpoint):
        raise OracleUnavailable("The gods are not configured (DATABRICKS_* settings missing)")
    if not host.startswith("http"):
        host = f"https://{host}"
    return host, token, endpoint


@lru_cache
def system_prompt() -> str:
    parts = [RULES, "=== DESIGN DOCUMENT ===", (ADVISOR_DIR / "context.md").read_text(encoding="utf-8")]
    for name in GAME_FILES:
        parts += [f"=== SOURCE: {name} ===", (ADVISOR_DIR / "game" / name).read_text(encoding="utf-8")]
    return "\n\n".join(parts)


@lru_cache
def forbidden_names() -> tuple[str, ...]:
    """Island, building and mission names taken from the game data; poems must not say them."""
    data = (ADVISOR_DIR / "game" / "data.js").read_text(encoding="utf-8")
    names = {n.lower() for n in re.findall(r"\bname: '([^']+)'", data)}
    return tuple(sorted(names))


def build_messages(town: dict) -> list[dict]:
    state = json.dumps(town, separators=(",", ":"))
    return [
        {"role": "system", "content": system_prompt()},
        {"role": "user", "content": f"The player's town right now (game state JSON):\n{state}\n\nThe lantern is lit. Speak."},
    ]


def extract_text(data: dict) -> str:
    """Pull the reply text out of the shapes Databricks endpoints return."""
    def flatten(content) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):  # content parts: [{"type": "text", "text": ...}, ...]
            return "".join(p.get("text", "") for p in content if isinstance(p, dict))
        return ""

    if data.get("choices"):  # Foundation Model APIs (OpenAI chat format)
        return flatten(data["choices"][0].get("message", {}).get("content"))
    if data.get("messages"):  # ChatAgent
        return flatten(data["messages"][-1].get("content"))
    for item in reversed(data.get("output") or []):  # ResponsesAgent
        if isinstance(item, dict) and item.get("type") == "message":
            return "".join(p.get("text", "") for p in item.get("content", []) if isinstance(p, dict))
    return ""


def parse_reply(text: str) -> dict:
    """Return {"strategy", "poem"} or raise ValueError."""
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("no JSON object in reply")
    obj = json.loads(text[start : end + 1])
    strategy, poem = obj.get("strategy"), obj.get("poem")
    if not isinstance(strategy, str) or not isinstance(poem, str):
        raise ValueError("strategy and poem must be strings")
    lines = [line.strip() for line in poem.strip().splitlines()]
    poem = "\n".join(lines).strip()
    if not poem or len(poem) > MAX_POEM_CHARS or len([l for l in lines if l]) > MAX_POEM_LINES:
        raise ValueError("poem is empty or too long")
    return {"strategy": strategy.strip(), "poem": poem}


def short(poem: str) -> bool:
    return len([l for l in poem.splitlines() if l.strip()]) < MIN_POEM_LINES


def leaks(poem: str) -> list[str]:
    """Plain giveaways the rules forbid: digits and game names."""
    lower = poem.lower()
    found = [n for n in forbidden_names() if re.search(rf"\b{re.escape(n)}\b", lower)]
    if re.search(r"\d", poem):
        found.append("digits")
    return found


async def _call(client: httpx.AsyncClient, host: str, token: str, endpoint: str, messages: list[dict]) -> str:
    res = await client.post(
        f"{host}/serving-endpoints/{endpoint}/invocations",
        headers={"Authorization": f"Bearer {token}"},
        json={"messages": messages, "max_tokens": 1000, "temperature": 0.9},
    )
    if res.status_code != 200:
        log.warning("oracle: Databricks returned %s: %s", res.status_code, res.text[:300])
        raise OracleUnavailable(f"Databricks returned {res.status_code}")
    return extract_text(res.json())


async def consult(town: dict) -> dict:
    """Ask the gods. Returns {"strategy", "poem"}; raises OracleUnavailable."""
    host, token, endpoint = _config()
    messages = build_messages(town)
    best = None
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        for attempt in range(1, ATTEMPTS + 1):
            try:
                text = await _call(client, host, token, endpoint, messages)
                reply = parse_reply(text)
            except httpx.HTTPError as e:
                log.warning("oracle: request failed (attempt %s): %r", attempt, e)
                continue
            except (ValueError, json.JSONDecodeError) as e:
                log.warning("oracle: unusable reply (attempt %s): %s", attempt, e)
                continue
            leaked = leaks(reply["poem"])
            if short(reply["poem"]):
                leaked.append("too short")
            best = reply
            if not leaked:
                break
            log.info("oracle: poem gave away %s (attempt %s)", leaked, attempt)
    if best is None:
        raise OracleUnavailable("The gods are silent")
    log.info("oracle: strategy=%r", best["strategy"])
    return best
