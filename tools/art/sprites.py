# Cuts the small background sprites (islets, moon, bird) out of out/decor.webp.
# Run after segment.py; copies go to frontend/public/art/sprite-*.webp and
# their sizes to frontend/src/game/spriteSizes.json.
import cv2, numpy as np, json
d = cv2.imread('out/decor.webp', cv2.IMREAD_UNCHANGED)
L = json.load(open('out/layout.json'))['decor']; ox, oy = L['x'], L['y']

def cut(name, x, y, w, h, pad=4):
    X0 = max(int((x - pad - ox) * 1.6), 0); Y0 = max(int((y - pad - oy) * 1.6), 0)
    X1 = int((x + w + pad - ox) * 1.6); Y1 = int((y + h + pad - oy) * 1.6)
    c = d[Y0:Y1, X0:X1].copy()
    m = (c[..., 3] > 30).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(m, np.ones((7, 7), np.uint8)), 8)
    if n > 1:
        k = 1 + np.argmax(st[1:, 4]); c[..., 3] = np.where(lab == k, c[..., 3], 0)
    cv2.imwrite(f'out/sprite-{name}.webp', c, [cv2.IMWRITE_WEBP_QUALITY, 90])
    return dict(w=round(c.shape[1] / 1.6, 1), h=round(c.shape[0] / 1.6, 1))

S = {
    'islet-a': cut('islet-a', 1186, 219, 115, 94), 'islet-b': cut('islet-b', 1375, 312, 101, 90),
    'islet-c': cut('islet-c', 621, 123, 98, 74), 'islet-d': cut('islet-d', 138, 655, 134, 129),
    'islet-e': cut('islet-e', 179, 194, 54, 45), 'moon': cut('moon', 1232, 115, 89, 86),
    'bird': cut('bird', 1144, 206, 44, 32),
}
json.dump(S, open('out/spriteSizes.json', 'w'), indent=1)
