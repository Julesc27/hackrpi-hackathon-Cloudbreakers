"""The player's Captain avatar: validated in the save, copied onto the player and returned.
No database: the logged-in player is a Player built without Beanie, and save() is a no-op.

    python -m pytest tests/test_avatar.py
"""

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.auth import get_current_player
from app.main import app
from app.models import Player, TownSave

TOWN = {
    "version": 5, "townName": "New Haven",
    "resources": {"wood": 24, "water": 30, "food": 24, "energy": 30, "coins": 60},
    "happiness": 62, "population": 6, "sustainability": 80, "sustainPenalty": 0, "xp": 0,
    "weather": "clear", "forecast": "rain", "journalUnread": 0, "nextId": 1,
}
AVATAR = {
    "body": "man", "skin": "#a06a48", "eyes": "happy", "eyeColor": "#3a6fb8", "hairStyle": "curly",
    "hair": "#1f1a24", "beard": "beard", "outfit": "coat", "top": "#c0603e", "bottom": "#2b3a66", "hat": "captain",
}


def test_save_with_an_avatar_is_validated():
    town = TownSave.model_validate({**TOWN, "avatar": AVATAR, "avatarSet": True})
    assert town.avatar.body == "man" and town.avatar.hat == "captain" and town.avatarSet


def test_saves_from_before_avatars_still_load():
    town = TownSave.model_validate(TOWN)
    assert town.avatar is None and town.avatarSet is False


@pytest.mark.parametrize("bad", [
    {"body": "robot"},
    {"hat": "crown"},
    {"top": "javascript:alert(1)"},
    {"skin": "#12345"},
    {"eyes": "laser"},
])
def test_unknown_avatar_choices_are_rejected(bad):
    with pytest.raises(ValidationError):
        TownSave.model_validate({**TOWN, "avatar": {**AVATAR, **bad}})


@pytest.fixture
def player():
    p = Player.model_construct(username="captain", password_hash="x", town=None, town_saved_at=None,
                               experience=0, coins=0, food=0, completion={}, turn=0, town_name=None, avatar=None)
    p.id = "6543210fedcba98765432100"

    saves = []

    async def save():  # no database in tests
        saves.append(p.avatar)
    object.__setattr__(p, "save", save)
    object.__setattr__(p, "saves", saves)
    app.dependency_overrides[get_current_player] = lambda: p
    yield p
    app.dependency_overrides.clear()


def test_cloud_save_stores_the_avatar_on_the_player(player):
    res = TestClient(app).put("/town", json={**TOWN, "avatar": AVATAR, "avatarSet": True})
    assert res.status_code == 200, res.text
    assert len(player.saves) == 1
    assert player.avatar.model_dump() == AVATAR
    assert player.town.avatarSet is True
    assert res.json()["player"]["avatar"] == AVATAR


def test_a_save_without_an_avatar_keeps_the_one_on_record(player):
    TestClient(app).put("/town", json={**TOWN, "avatar": AVATAR, "avatarSet": True})
    TestClient(app).put("/town", json=TOWN)
    assert player.avatar.model_dump() == AVATAR


def test_bad_avatar_is_refused_and_nothing_is_stored(player):
    res = TestClient(app).put("/town", json={**TOWN, "avatar": {**AVATAR, "hat": "crown"}})
    assert res.status_code == 422
    assert player.avatar is None and player.town is None


def test_cloud_save_preserves_weather_schedule_and_damaged_upgraded_homes(player):
    cycle = {"phase": "warning", "remaining": 4, "seed": 3912381249,
             "events": 3, "lastWeather": "crosswind"}
    building = {"id": "house", "type": "shelter", "island": "newHaven", "slot": 0,
                "builtLevel": 1, "shelterLevel": 3, "condition": 0,
                "paidCost": {"wood": 26, "stone": 11, "materials": 2}}
    town = {**TOWN, "version": 7, "forecast": "solarStorm", "weatherCycle": cycle,
            "buildings": [building]}
    client = TestClient(app)
    response = client.put("/town", json=town)
    assert response.status_code == 200, response.text
    saved = player.town.model_dump()
    assert saved["weatherCycle"] == cycle
    assert saved["buildings"][0]["shelterLevel"] == 3
    assert saved["buildings"][0]["condition"] == 0
    assert saved["buildings"][0]["paidCost"] == building["paidCost"]
    loaded = client.get("/town").json()
    assert loaded["town"]["weatherCycle"] == cycle
    assert loaded["town"]["buildings"][0]["condition"] == 0
