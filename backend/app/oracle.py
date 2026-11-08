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
TIMEOUT_SECONDS = 90  # high reasoning effort takes ~30-50s per attempt
ATTEMPTS = 2
MAX_POEM_CHARS = 1200
MIN_POEM_LINES = 4
MAX_POEM_LINES = 12

# What the strategy is mainly about, so Friendly Cloud can tell when the gods disagree with it.
# Building keys = build one; island ids = bridge to it. Keep in sync with data.js (tested).
FOCUS_BUILDINGS = ("shelter", "bridgeAnchor", "waterCollector", "garden", "storageHouse", "solarFarm",
                   "market", "clinic", "battery", "communityHall", "windTurbine")
FOCUS_ISLANDS = ("verdant", "rain", "prism", "mercy", "hearth")
FOCUS_OTHER = ("gather", "beacon", "repair", "balance")
FOCUSES = FOCUS_BUILDINGS + FOCUS_ISLANDS + FOCUS_OTHER

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

3. "focus": one word naming what the strategy is mainly about. Pick exactly one of:
   - a building key to build first: {buildings}
   - an island id to bridge to next: {islands}
   - "gather" (collect or mine), "beacon" (restore it), "repair" (fix bridges), "balance" (keep things steady)
   The player never sees this either.

Reply with only a JSON object, no other text:
{{"strategy": "...", "poem": "first line\\nsecond line\\n...", "focus": "..."}}""".format(
    buildings=", ".join(FOCUS_BUILDINGS), islands=", ".join(FOCUS_ISLANDS))


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
    names |= {k.lower() for k in FOCUS_BUILDINGS if k.isalpha() and k.islower()}  # "garden" for "Food Garden"
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
    if "\n" not in poem.strip() and " / " in poem:  # one-line poems with slash breaks, like the prompt's example
        poem = poem.replace(" / ", "\n")
    lines = [line.strip() for line in poem.strip().splitlines()]
    poem = "\n".join(lines).strip()
    if not poem or len(poem) > MAX_POEM_CHARS or len([l for l in lines if l]) > MAX_POEM_LINES:
        raise ValueError("poem is empty or too long")
    focus = obj.get("focus")
    # A bad focus isn't worth a retry; Cloud just won't compare.
    return {"strategy": strategy.strip(), "poem": poem, "focus": focus if focus in FOCUSES else None}


def short(poem: str) -> bool:
    return len([l for l in poem.splitlines() if l.strip()]) < MIN_POEM_LINES


def leaks(poem: str) -> list[str]:
    """Plain giveaways the rules forbid: digits and game names."""
    lower = poem.lower()
    found = [n for n in forbidden_names() if re.search(rf"\b{re.escape(n)}\b", lower)]
    if re.search(r"\d", poem):
        found.append("digits")
    return found


EFFORTS = ("low", "medium", "high")


async def _call(client: httpx.AsyncClient, host: str, token: str, endpoint: str, messages: list[dict],
                effort: str | None) -> str:
    # Reasoning models (e.g. databricks-gpt-oss-120b) think before answering: low ~3s, medium ~8s, high ~30-50s.
    # effort=None for models without thinking, like Llama.
    body = {"messages": messages, "max_tokens": 1000, "temperature": 0.9}
    if effort in EFFORTS:
        body = {"messages": messages, "max_tokens": 12000, "reasoning_effort": effort}  # thinking tokens count too
    res = await client.post(
        f"{host}/serving-endpoints/{endpoint}/invocations",
        headers={"Authorization": f"Bearer {token}"},
        json=body,
    )
    if res.status_code != 200:
        log.warning("oracle: Databricks returned %s: %s", res.status_code, res.text[:300])
        raise OracleUnavailable(f"Databricks returned {res.status_code}")
    data = res.json()
    text = extract_text(data)
    if not text.strip():
        log.warning("oracle: empty reply (effort %s), finish_reason=%s", effort,
                    (data.get("choices") or [{}])[0].get("finish_reason"))
    return text


async def consult(town: dict) -> dict:
    """Ask the gods. Returns {"strategy", "poem", "focus"}; raises OracleUnavailable."""
    host, token, endpoint = _config()
    messages = build_messages(town)
    effort = os.getenv("DATABRICKS_REASONING_EFFORT", "").strip().lower() or None
    best = None
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        for attempt in range(1, ATTEMPTS + 1):
            text = ""
            try:
                text = await _call(client, host, token, endpoint, messages, effort)
                reply = parse_reply(text)
            except httpx.HTTPError as e:
                log.warning("oracle: request failed (attempt %s): %r", attempt, e)
                continue
            except (ValueError, json.JSONDecodeError) as e:
                log.warning("oracle: unusable reply (attempt %s): %s | reply starts: %r", attempt, e, text[:200])
                if not text.strip() and effort in EFFORTS[1:]:
                    effort = EFFORTS[EFFORTS.index(effort) - 1]  # thought itself out of room: think less next time
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
    log.info("oracle: focus=%s strategy=%r", best["focus"], best["strategy"])
    return best
