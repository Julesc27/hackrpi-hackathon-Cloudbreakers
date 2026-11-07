"""Copy the game rules the gods read into the backend.

The backend Docker image is built from ./backend only, so it can't see frontend/src/game.
Run this after changing data.js or engine.js (backend/tests/test_oracle.py fails until you do):

    python tools/sync_advisor_context.py
"""

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "frontend" / "src" / "game"
DEST = ROOT / "backend" / "advisor" / "game"
FILES = ("data.js", "engine.js")


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        shutil.copyfile(SOURCE / name, DEST / name)
        print(f"copied {name}")


if __name__ == "__main__":
    main()
