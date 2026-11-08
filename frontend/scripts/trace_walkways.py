"""Regenerate src/components/world/walkGrid.js from the painted island art.

Residents walk on a coarse grid traced from each island painting: warm cream paving is cheap to
walk on, yellow-green lawn costs more, and everything else (trees, cliffs, water, clouds, painted
buildings) is blocked. Small separated patches are joined to the main area with short "steps"
links, and anything still unconnected is dropped.

Run it after repainting an island or moving one (PAINTED_ISLANDS in paintedArt.js):

    pip install pillow numpy scipy
    python3 scripts/trace_walkways.py

Then check the result in the game. If people walk across something they shouldn't, add a
polygon to EXCLUDE; to give them somewhere to linger, add a point to POI.
"""
import json, os, re
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'public')
CELL = 5    # world units per walk cell
SAMPLE = 2  # pixels per world unit when tracing

# Painted buildings whose walls are cream like the paving (world coordinates).
EXCLUDE = {
    'mercy': [[(73, 400), (125, 352), (255, 352), (288, 420), (272, 492), (215, 506), (125, 500), (73, 460)]],
}
# Spots where residents linger: sit (benches), tend (crop beds), look (docks, edges, fountains).
POI = {
    'newHaven': {'sit': [(670, 600)], 'tend': [(775, 620), (885, 615)], 'look': [(555, 625), (895, 570), (775, 425), (470, 530), (1085, 530)]},
    'verdant': {'tend': [(420, 170), (460, 160)], 'look': [(380, 120), (290, 170), (520, 240)]},
    'rain': {'look': [(1100, 220), (1180, 220)]},
    'prism': {'look': [(1370, 890), (1440, 940)]},
    'mercy': {'tend': [(175, 520)], 'look': [(45, 430)]},
    'hearth': {'tend': [(1450, 470)], 'look': [(1370, 540)]},
}
JOIN = {'prism': 48}  # max gap (world units) bridged by a steps link; default 32


def read_art():
    src = open(os.path.join(ROOT, 'src/components/world/paintedArt.js')).read()
    atlases = {}
    for m in re.finditer(r"(\w+): \{ cells: (\[\[.*?\]\]), src: '([^']+)'", src):
        atlases[m.group(1)] = (m.group(3), json.loads(m.group(2)))
    islands = {}
    for m in re.finditer(r"(\w+): \{ sheet: '(\w+)'(?:, src: '[^']+')?, cell: (\d+), rect: (\[[^\]]+\])", src):
        islands[m.group(1)] = (m.group(2), int(m.group(3)), json.loads(m.group(4)))
    return atlases, islands


def classify(im):
    a = np.asarray(im).astype(float) / 255
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    sat = (mx - mn) / (mx + 1e-6); d = mx - mn + 1e-6
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    solid = al > 0.95
    cream = nd.binary_opening(solid & (mx > 0.72) & (hue > 18) & (hue < 50) & (sat > 0.08) & (sat < 0.45), iterations=1)
    grass = nd.binary_opening(solid & (hue >= 40) & (hue < 85) & (sat >= 0.42) & (mx > 0.5), iterations=2)
    return cream, grass


def join(cost, maxd):
    while True:
        lab, n = nd.label(cost > 0, structure=np.ones((3, 3)))
        if n <= 1: return cost
        sizes = nd.sum(cost > 0, lab, range(1, n + 1)); main = int(np.argmax(sizes)) + 1
        mpts = np.argwhere(lab == main); best = None
        for c in range(1, n + 1):
            if c == main: continue
            pts = np.argwhere(lab == c)
            dd = ((pts[:, None, :] - mpts[None, :, :]) ** 2).sum(-1)
            i, j = np.unravel_index(np.argmin(dd), dd.shape)
            if best is None or dd[i, j] < best[0]: best = (dd[i, j], pts[i], mpts[j])
        if best[0] ** 0.5 * CELL > maxd: return cost
        a, b = best[1], best[2]
        for t in np.linspace(0, 1, int(best[0] ** 0.5 * 2) + 2):
            r, c = np.round(a + (b - a) * t).astype(int)
            if cost[r, c] == 0: cost[r, c] = 3


def trace(atlases, sheet, cell, rect, iid):
    path, cells = atlases[sheet]
    x, y, w, h = rect
    cx, cy, cw, ch = cells[cell]
    im = Image.open(os.path.join(ART, path.lstrip('/'))).convert('RGBA').crop((cx, cy, cx + cw, cy + ch)).resize((w * SAMPLE, h * SAMPLE), Image.LANCZOS)
    cream, grass = classify(im)
    gw, gh, k = -(-w // CELL), -(-h // CELL), CELL * SAMPLE
    def frac(m):
        pad = np.zeros((gh * k, gw * k), bool); pad[:m.shape[0], :m.shape[1]] = m
        return pad.reshape(gh, k, gw, k).mean(axis=(1, 3))
    fc, fg = frac(cream), frac(grass)
    cost = np.zeros((gh, gw), np.uint8)
    cost[(fc + fg) > 0.6] = 2; cost[fc > 0.5] = 1
    for poly in EXCLUDE.get(iid, []):
        ex = Image.new('L', (gw, gh), 0)
        ImageDraw.Draw(ex).polygon([((px - x) / CELL, (py - y) / CELL) for px, py in poly], fill=255)
        cost[np.asarray(ex) > 0] = 0
    lab, n = nd.label(cost > 0, structure=np.ones((3, 3)))
    sizes = nd.sum(cost > 0, lab, range(1, n + 1))
    cost[~np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 60])] = 0
    cost = join(cost, JOIN.get(iid, 32))
    lab, n = nd.label(cost > 0, structure=np.ones((3, 3)))
    sizes = nd.sum(cost > 0, lab, range(1, n + 1))
    cost[lab != int(np.argmax(sizes)) + 1] = 0
    walk = np.argwhere(cost > 0); poi = []
    for tag, pts in POI.get(iid, {}).items():
        for px, py in pts:
            g = np.array([(py - y) / CELL, (px - x) / CELL]); r, c = walk[np.argmin(((walk - g) ** 2).sum(1))]
            poi.append([int(c), int(r), tag])
    return dict(x=x, y=y, cols=gw, rows=gh, cells=''.join(map(str, cost.ravel())), poi=poi)


def rle(s):
    out, i = [], 0
    while i < len(s):
        j = i
        while j < len(s) and s[j] == s[i] and j - i < 35: j += 1
        out.append(s[i] + '0123456789abcdefghijklmnopqrstuvwxyz'[j - i]); i = j
    return ''.join(out)


def main():
    atlases, islands = read_art()
    lines = [
        '// Generated by scripts/trace_walkways.py from the painted island art. Do not edit by hand.',
        '// Each island is a grid of CELL x CELL world-unit cells, row-major, run-length encoded as pairs of',
        '// <cost><run length in base 36>. Cost 0 = blocked, 1 = paved path, 2 = lawn, 3 = steps/short links.',
        "// `poi` marks spots where residents linger: [col, row, 'sit' | 'tend' | 'look'].",
        f'export const CELL = {CELL}', 'export const WALK = {',
    ]
    for iid, (sheet, cell, rect) in islands.items():
        v = trace(atlases, sheet, cell, rect, iid)
        print(f"{iid}: {v['cells'].count('1')} paved, {v['cells'].count('2')} lawn, {v['cells'].count('3')} steps cells")
        lines.append(f"  {iid}: {{ x: {v['x']}, y: {v['y']}, cols: {v['cols']}, rows: {v['rows']}, poi: {json.dumps(v['poi'])},")
        lines.append(f"    cells: '{rle(v['cells'])}' }},")
    lines.append('}')
    open(os.path.join(ROOT, 'src/components/world/walkGrid.js'), 'w').write('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main()
