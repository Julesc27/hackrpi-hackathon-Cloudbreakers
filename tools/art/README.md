# Concept-art cutter

Regenerates `frontend/public/art/*` from the concept images.

1. Put the concept PNGs here, named: `main.png` (town map), `chart.png` (Skyway Chart),
   `workshop.png` (Town Workshop), `advisor.png` (Cloud's Notes, portrait), `log.png` (Captain's Log, portrait).
2. `pip install opencv-python scipy scikit-image numpy`
3. `python segment.py` → islands, bridges, decor + `out/layout.json`
4. `python ui_assets.py` → icons and card art in `ui/`
5. Copy `out/*.webp` and `ui/*.webp` to `frontend/public/art/`, and `out/layout.json` to `frontend/src/game/artLayout.json`.

Island/bridge outlines and HUD boxes are hand-tuned coordinates in a 1600×900 frame at the top of `segment.py`.
