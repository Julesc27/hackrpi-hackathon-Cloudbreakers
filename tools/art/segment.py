import cv2, numpy as np, json
from scipy import ndimage as ndi
from skimage.segmentation import watershed

S = 1.6  # grid(1600x900) -> source(2560x1440)
im = cv2.imread('main.png', cv2.IMREAD_UNCHANGED)[..., :3]
H_, W_ = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(np.float32)
H, Sat, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]

def ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

hue = ss(92, 100, H) * (1 - ss(126, 134, H))
skyness = hue * ss(70, 115, Sat) * (1 - ss(125, 170, V))
alpha = 1 - skyness

# fill enclosed sky holes (banners, shadows) — only sky connected to big exterior regions stays
skybin = (alpha < 0.5).astype(np.uint8)
n, lab, stats, _ = cv2.connectedComponentsWithStats(skybin, 4)
big = np.zeros(n, bool); big[0] = False
for i in range(1, n):
    if stats[i, cv2.CC_STAT_AREA] > 2500: big[i] = True
exterior = big[lab]
alpha = np.where(exterior, alpha, 1.0)

def poly(pts):
    m = np.zeros((H_, W_), np.uint8)
    cv2.fillPoly(m, [np.round(np.array(pts) * S).astype(np.int32)], 1)
    return m.astype(bool)
def rect(x0, y0, x1, y1): return poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
def circle(cx, cy, r):
    m = np.zeros((H_, W_), np.uint8); cv2.circle(m, (int(cx * S), int(cy * S)), int(r * S), 1, -1); return m.astype(bool)

# HUD regions in the concept art (grid coords)
def rrect(x0, y0, x1, y1, r=14):
    m = np.zeros((H_, W_), np.uint8)
    X0, Y0, X1, Y1, R = [int(v * S) for v in (x0, y0, x1, y1, r)]
    cv2.rectangle(m, (X0 + R, Y0), (X1 - R, Y1), 1, -1); cv2.rectangle(m, (X0, Y0 + R), (X1, Y1 - R), 1, -1)
    for cx, cy in ((X0 + R, Y0 + R), (X1 - R, Y0 + R), (X0 + R, Y1 - R), (X1 - R, Y1 - R)): cv2.circle(m, (cx, cy), R, 1, -1)
    return m.astype(bool)
hud = (rect(0, 0, 345, 165) | rect(365, 0, 1325, 96) | rect(1365, 0, 1600, 128) | rect(1352, 148, 1590, 300)
       | rect(0, 185, 140, 625)
       | rrect(250, 790, 512, 884) | rrect(542, 790, 784, 884) | rrect(812, 790, 1054, 884) | rrect(1082, 790, 1344, 884)
       | circle(232, 837, 14) | circle(527, 837, 14) | circle(798, 837, 14) | circle(1068, 837, 14) | circle(1352, 837, 14)
       | circle(1547, 850, 38))

fg = alpha > 0.5
cloudy = (Sat < 55) & (V > 175)

bridges = {
    'mistral-haven': [(586, 203), (640, 208), (700, 226), (728, 230), (728, 262), (716, 266), (738, 300), (738, 336), (706, 338), (670, 276), (628, 262), (586, 250)],
    'rain-haven': [(850, 300), (930, 238), (962, 245), (962, 268), (880, 336), (848, 345), (838, 330)],
    'mercy-haven': [(476, 418), (598, 392), (628, 396), (628, 428), (502, 466), (476, 462)],
    'hearth-haven': [(934, 432), (1045, 410), (1062, 420), (1062, 455), (950, 485), (934, 478)],
    'verdant-haven': [(588, 562), (640, 518), (692, 522), (692, 548), (652, 578), (622, 622), (590, 636), (566, 620)],
    'gardens-haven': [(852, 588), (872, 578), (945, 628), (945, 660), (915, 662), (852, 610)],
    'hearth-skyport': [(1220, 545), (1242, 532), (1366, 598), (1364, 634), (1330, 628), (1220, 572)],
}
bmask = {}
taken = np.zeros((H_, W_), bool)
for k, p in bridges.items():
    m = poly(p) & fg & ~hud & ~cloudy
    m = ndi.binary_opening(m, iterations=1)
    bmask[k] = m; taken |= m

islands = {
    'mistral': circle(400, 225, 70), 'rain': circle(930, 200, 55) | circle(785, 210, 38) | circle(1085, 250, 30), 'newHaven': circle(765, 430, 85) | circle(765, 290, 42) | rect(745, 300, 790, 360),
    'mercy': circle(320, 470, 70), 'hearth': circle(1230, 440, 80), 'verdant': circle(470, 690, 60),
    'gardens': circle(1030, 690, 70), 'skyport': circle(1480, 650, 55) | circle(1450, 760, 30) | circle(1560, 540, 25),
}
names = list(islands)
markers = np.zeros((H_, W_), np.int32)
for i, k in enumerate(names): markers[islands[k] & fg] = i + 1
region = fg & ~hud & ~taken
dist = ndi.distance_transform_edt(region)
lab = watershed(-dist, markers, mask=region)

out = {}
def save(name, m, soft_alpha, extra=None):
    a = (soft_alpha * m).astype(np.float32)
    a = cv2.GaussianBlur(a, (0, 0), 0.8)
    ys, xs = np.where(a > 0.02)
    if not len(xs): return
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    rgba = np.dstack([im[y0:y1, x0:x1], (a[y0:y1, x0:x1] * 255).astype(np.uint8)])
    cv2.imwrite(f'out/{name}.webp', rgba, [cv2.IMWRITE_WEBP_QUALITY, 88])
    out[name] = dict(x=round(x0 / S, 2), y=round(y0 / S, 2), w=round((x1 - x0) / S, 2), h=round((y1 - y0) / S, 2))

# fade islands out toward the bottom nav line, and soften any straight cut left by the
# HUD boxes or the image border so pieces look natural when the camera pans past them
fade = 1 - ss(735 * S, 792 * S, np.arange(H_)[:, None].astype(np.float32))
fade = np.broadcast_to(fade, (H_, W_))
hud_dist = ndi.distance_transform_edt(~hud)
xx = np.arange(W_)[None, :].astype(np.float32)
border = np.minimum(xx, W_ - 1 - xx)
fade = fade * ss(0, 34 * S, hud_dist) * ss(0, 40 * S, np.broadcast_to(border, (H_, W_)))
for i, k in enumerate(names):
    m = (lab == i + 1)
    soft = cv2.GaussianBlur(ndi.binary_dilation(m, iterations=5).astype(np.float32), (0, 0), 3) * (fg & ~hud & ~taken | m)
    save('island-' + k, soft, alpha * fade)
for k, m in bmask.items():
    m2 = ndi.binary_dilation(m, iterations=1) & fg & ~hud
    save('bridge-' + k, m2, alpha)

# decor: everything else (distant islets, edge clouds, moon, birds, stars)
used = (lab > 0) | taken
decor = fg & ~hud & ~used
save('decor', decor, alpha)

# dormant-beacon variant of New Haven: dim the armillary orb
b = out['island-newHaven']; x0, y0 = int(round(b['x'] * S)), int(round(b['y'] * S))
hv = cv2.imread('out/island-newHaven.webp', cv2.IMREAD_UNCHANGED)
yy, xx = np.mgrid[0:hv.shape[0], 0:hv.shape[1]]
d = np.hypot(xx + x0 - 765 * S, yy + y0 - 287 * S) / S
w = (1 - ss(30, 52, d))[..., None]
rgb = hv[..., :3].astype(np.float32)
gray = rgb.mean(axis=2, keepdims=True)
dark = (0.55 * gray + 0.45 * rgb) * 0.5 + np.array([40, 18, 8])
hv[..., :3] = np.clip(rgb * (1 - w) + dark * w, 0, 255).astype(np.uint8)
cv2.imwrite('out/island-newHaven-dormant.webp', hv, [cv2.IMWRITE_WEBP_QUALITY, 88])

# debug overlay
vis = (im * 0.35).astype(np.uint8)
cols = [(255,80,80),(80,255,80),(80,80,255),(255,255,80),(255,80,255),(80,255,255),(255,160,60),(160,60,255)]
for i in range(len(names)):
    vis[lab == i + 1] = (0.5 * im[lab == i + 1] + 0.5 * np.array(cols[i])).astype(np.uint8)
for k, m in bmask.items(): vis[m] = (255, 255, 255)
cv2.imwrite('seg.jpg', cv2.resize(vis, (1600, 900)))
json.dump(out, open('out/layout.json', 'w'), indent=1)
print(json.dumps(out))
