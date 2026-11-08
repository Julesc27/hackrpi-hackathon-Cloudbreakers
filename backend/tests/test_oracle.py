"""Consult the Gods: prompt pieces, reply parsing, retries and the /advisor route.
Databricks is never called; httpx gets a mock transport.

    pip install -r requirements.txt pytest pytest-asyncio
    python -m pytest tests
"""

import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app import oracle, ratelimit
from app.auth import get_current_player
from app.main import app

ROOT = Path(__file__).resolve().parents[2]
GOOD_POEM = "When the hollow bowl rings,\nreach across the gap\nto where green hands wave;\nthe thread is cheap, the hunger is not."
TOWN = {
    "version": 5, "townName": "New Haven",
    "resources": {"wood": 24, "water": 30, "food": 24, "energy": 30, "coins": 60},
    "happiness": 62, "population": 6, "sustainability": 80, "sustainPenalty": 0, "xp": 0,
    "weather": "clear", "forecast": "rain", "journalUnread": 0, "nextId": 1,
    "journal": [{"id": "j1", "type": "story", "title": "Secret diary", "text": "do not send me"}],
}


def chat_reply(content: str) -> dict:
    return {"choices": [{"message": {"role": "assistant", "content": content}}]}


@pytest.fixture
def databricks(monkeypatch):
    """Route oracle's HTTP calls to a fake endpoint. Append replies (dict or Exception) to `.replies`."""
    monkeypatch.setenv("DATABRICKS_HOST", "dbc-test.cloud.databricks.com")
    monkeypatch.setenv("DATABRICKS_TOKEN", "test-token")
    monkeypatch.setenv("DATABRICKS_ENDPOINT", "databricks-test")
    monkeypatch.delenv("DATABRICKS_REASONING_EFFORT", raising=False)

    class Fake:
        replies: list = []
        requests: list = []

    def handler(request: httpx.Request):
        Fake.requests.append(request)
        reply = Fake.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        if isinstance(reply, httpx.Response):
            return reply
        return httpx.Response(200, json=reply)

    real = httpx.AsyncClient
    monkeypatch.setattr(oracle.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    Fake.replies, Fake.requests = [], []
    return Fake


# ---------- the game files the gods read ----------

@pytest.mark.skipif(not (ROOT / "frontend").exists(), reason="frontend not in this checkout (e.g. Docker image)")
@pytest.mark.parametrize("name", oracle.GAME_FILES)
def test_game_copies_match_frontend(name):
    copy = (ROOT / "backend" / "advisor" / "game" / name).read_text(encoding="utf-8")
    source = (ROOT / "frontend" / "src" / "game" / name).read_text(encoding="utf-8")
    assert copy == source, f"{name} is stale: run python tools/sync_advisor_context.py"


def test_system_prompt_includes_design_doc_and_code():
    prompt = oracle.system_prompt()
    assert "Cloudbreakers" in prompt and "export function gameReducer" in prompt and "export const BUILDINGS" in prompt


def test_forbidden_names_come_from_game_data():
    names = oracle.forbidden_names()
    assert "verdant reach" in names and "shelter" in names


def test_focus_words_exist_in_game_data():
    data = (ROOT / "backend" / "advisor" / "game" / "data.js").read_text(encoding="utf-8")
    for key in oracle.FOCUS_BUILDINGS + oracle.FOCUS_ISLANDS:
        assert f"\n  {key}: {{" in data.replace("\r\n", "\n"), key


def test_parse_reply_keeps_valid_focus_only():
    reply = lambda focus: json.dumps({"strategy": "s", "poem": GOOD_POEM, "focus": focus})
    assert oracle.parse_reply(reply("verdant"))["focus"] == "verdant"
    assert oracle.parse_reply(reply("dragons"))["focus"] is None


# ---------- parsing ----------

@pytest.mark.parametrize("data", [
    chat_reply("hi"),
    {"choices": [{"message": {"content": [{"type": "text", "text": "hi"}]}}]},
    {"messages": [{"role": "assistant", "content": "hi"}]},
    {"output": [{"type": "message", "content": [{"type": "output_text", "text": "hi"}]}]},
])
def test_extract_text_handles_endpoint_shapes(data):
    assert oracle.extract_text(data) == "hi"


def test_parse_reply_accepts_fenced_json():
    text = "```json\n" + json.dumps({"strategy": "Bridge to the forest.", "poem": "  a\n b \nc\nd  "}) + "\n```"
    assert oracle.parse_reply(text) == {"strategy": "Bridge to the forest.", "poem": "a\nb\nc\nd", "focus": None}


def test_parse_reply_splits_slash_lines():
    text = json.dumps({"strategy": "s", "poem": "When dry winds blow, / gather mist / and sow anew."})
    assert oracle.parse_reply(text)["poem"] == "When dry winds blow,\ngather mist\nand sow anew."


@pytest.mark.parametrize("text", ["no json here", '{"strategy": "x"}', '{"strategy": "x", "poem": ""}', '{"strategy": 1, "poem": "a"}'])
def test_parse_reply_rejects_bad_replies(text):
    with pytest.raises(ValueError):
        oracle.parse_reply(text)


def test_leaks_catch_names_and_numbers():
    assert oracle.leaks("Cross to Verdant Reach") == ["verdant reach"]
    assert oracle.leaks("the garden's thirst is deep") == ["garden"]
    assert oracle.leaks("Gather 10 of them") == ["digits"]
    assert oracle.leaks(GOOD_POEM) == []


# ---------- consult ----------

async def test_consult_sends_prompt_and_returns_reply(databricks):
    databricks.replies.append(chat_reply(json.dumps({"strategy": "Bridge to Verdant Reach for food.", "poem": GOOD_POEM, "focus": "verdant"})))
    reply = await oracle.consult(TOWN)
    assert reply == {"strategy": "Bridge to Verdant Reach for food.", "poem": GOOD_POEM, "focus": "verdant"}
    req = databricks.requests[0]
    assert str(req.url) == "https://dbc-test.cloud.databricks.com/serving-endpoints/databricks-test/invocations"
    assert req.headers["authorization"] == "Bearer test-token"
    body = json.loads(req.content)
    assert body["messages"][0]["role"] == "system" and '"townName":"New Haven"' in body["messages"][1]["content"]


async def test_consult_retries_a_leaky_poem(databricks):
    databricks.replies += [
        chat_reply(json.dumps({"strategy": "s", "poem": "Build a shelter\nnow\nquick\nplease"})),
        chat_reply(json.dumps({"strategy": "s", "poem": GOOD_POEM})),
    ]
    assert (await oracle.consult(TOWN))["poem"] == GOOD_POEM


async def test_consult_keeps_leaky_poem_if_retry_fails(databricks):
    leaky = "Build a shelter\nnow\nquick\nplease"
    databricks.replies += [chat_reply(json.dumps({"strategy": "s", "poem": leaky})), httpx.ReadTimeout("slow")]
    assert (await oracle.consult(TOWN))["poem"] == leaky


async def test_consult_retries_garbage_then_gives_up(databricks):
    databricks.replies += [chat_reply("I am a teapot"), httpx.Response(500, text="boom")]
    with pytest.raises(oracle.OracleUnavailable):
        await oracle.consult(TOWN)


async def test_reasoning_effort_is_sent_only_when_set(databricks, monkeypatch):
    ok = chat_reply(json.dumps({"strategy": "s", "poem": GOOD_POEM}))
    databricks.replies += [ok, ok]
    await oracle.consult(TOWN)
    assert "reasoning_effort" not in json.loads(databricks.requests[0].content)
    monkeypatch.setenv("DATABRICKS_REASONING_EFFORT", "high")
    await oracle.consult(TOWN)
    body = json.loads(databricks.requests[1].content)
    assert body["reasoning_effort"] == "high" and "temperature" not in body


async def test_empty_reply_retries_with_less_thinking(databricks, monkeypatch):
    monkeypatch.setenv("DATABRICKS_REASONING_EFFORT", "high")
    ran_out = {"choices": [{"finish_reason": "length", "message": {"content": ""}}]}
    databricks.replies += [ran_out, chat_reply(json.dumps({"strategy": "s", "poem": GOOD_POEM}))]
    assert (await oracle.consult(TOWN))["poem"] == GOOD_POEM
    efforts = [json.loads(r.content)["reasoning_effort"] for r in databricks.requests]
    assert efforts == ["high", "medium"]


async def test_consult_without_config(monkeypatch):
    monkeypatch.delenv("DATABRICKS_TOKEN", raising=False)
    with pytest.raises(oracle.OracleUnavailable):
        await oracle.consult(TOWN)


# ---------- route ----------

class FakePlayer:
    id = "player-1"


@pytest.fixture
def client():
    ratelimit.reset()
    app.dependency_overrides[get_current_player] = lambda: FakePlayer()
    yield TestClient(app)  # no `with`: skips the lifespan, so no database
    app.dependency_overrides.clear()
    ratelimit.reset()


def test_route_returns_poem_and_focus_but_not_strategy(client, databricks):
    databricks.replies.append(chat_reply(json.dumps({"strategy": "secret plan", "poem": GOOD_POEM, "focus": "rain"})))
    res = client.post("/advisor", json=TOWN)
    assert res.status_code == 200 and res.json() == {"poem": GOOD_POEM, "focus": "rain"}
    sent = json.loads(databricks.requests[0].content)["messages"][1]["content"]
    assert "Secret diary" not in sent  # journal is stripped


def test_route_503_when_gods_are_silent(client, databricks):
    databricks.replies += [httpx.ConnectError("down"), httpx.ConnectError("down")]
    assert client.post("/advisor", json=TOWN).status_code == 503


def test_route_rate_limit(client, databricks):
    limit, _ = ratelimit.LIMITS["oracle_player"]
    databricks.replies += [chat_reply(json.dumps({"strategy": "s", "poem": GOOD_POEM}))] * limit
    for _ in range(limit):
        assert client.post("/advisor", json=TOWN).status_code == 200
    assert client.post("/advisor", json=TOWN).status_code == 429


def test_route_requires_login():
    app.dependency_overrides.clear()
    assert TestClient(app).post("/advisor", json=TOWN).status_code == 401


# ---------- only possible advice ----------

def test_allowed_focuses_keeps_known_moves_only():
    assert oracle.allowed_focuses(None) is None  # older clients: no limit
    assert oracle.allowed_focuses(["shelter", "verdant", "laser", "gather", "gather"]) == ("shelter", "verdant", "gather")
    assert oracle.allowed_focuses(["laser"]) == ("balance",)


def test_prompt_lists_the_possible_moves(client, databricks):
    databricks.replies.append(chat_reply(json.dumps({"strategy": "chop", "poem": GOOD_POEM, "focus": "gather"})))
    res = client.post("/advisor", json={**TOWN, "possibleMoves": ["shelter", "gather", "balance"]})
    assert res.status_code == 200 and res.json()["focus"] == "gather"
    sent = json.loads(databricks.requests[0].content)["messages"][1]["content"]
    assert "Only these moves are possible" in sent and "shelter, gather, balance" in sent
    assert '"possibleMoves"' not in sent  # the list goes in the instructions, not the town JSON


def test_impossible_advice_is_retried(client, databricks):
    databricks.replies += [
        chat_reply(json.dumps({"strategy": "bridge to rain", "poem": GOOD_POEM, "focus": "rain"})),
        chat_reply(json.dumps({"strategy": "build a shelter", "poem": GOOD_POEM, "focus": "shelter"})),
    ]
    res = client.post("/advisor", json={**TOWN, "possibleMoves": ["shelter", "gather", "balance"]})
    assert res.status_code == 200 and res.json()["focus"] == "shelter"


def test_gods_stay_silent_rather_than_advise_the_impossible(client, databricks):
    impossible = chat_reply(json.dumps({"strategy": "build a solar farm", "poem": GOOD_POEM, "focus": "solarFarm"}))
    databricks.replies += [impossible, impossible]
    res = client.post("/advisor", json={**TOWN, "possibleMoves": ["gather", "balance"]})
    assert res.status_code == 503
    assert "cannot be done" in res.json()["detail"] and "Nothing was charged" in res.json()["detail"]


def test_advice_without_a_focus_is_not_trusted_when_moves_are_known(client, databricks):
    unknown = chat_reply(json.dumps({"strategy": "something", "poem": GOOD_POEM}))
    databricks.replies += [unknown, unknown]
    assert client.post("/advisor", json={**TOWN, "possibleMoves": ["gather", "balance"]}).status_code == 503
