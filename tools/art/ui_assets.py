import cv2, numpy as np
from scipy import ndimage as ndi
def ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
Q=[cv2.IMWRITE_WEBP_QUALITY, 90]
def save(name, rgba, maxw=None):
    if maxw and rgba.shape[1] > maxw:
        s = maxw / rgba.shape[1]; rgba = cv2.resize(rgba, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'ui/{name}.webp', rgba, Q)

def key_icon(src, box, tol=(28, 60), name=None, size=128):
    im = cv2.imread(src)[..., :3]
    x0, y0, x1, y1 = box; c = im[y0:y1, x0:x1].astype(np.float32)
    lab = cv2.cvtColor(c.astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    border = np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])
    # distance to nearest of a few border colour samples (handles gradients)
    samples = border[np.random.default_rng(1).choice(len(border), 60)]
    d = np.min(np.linalg.norm(lab[:, :, None, :] - samples[None, None], axis=3), axis=2)
    bg = d < tol[0]
    # only background connected to the border
    lbl, n = ndi.label(bg)
    edge = set(np.unique(np.concatenate([lbl[0], lbl[-1], lbl[:, 0], lbl[:, -1]]))) - {0}
    ext = np.isin(lbl, list(edge))
    a = ss(tol[0], tol[1], d)
    a = np.where(ext, 0, np.maximum(a, ~ext * 1.0))
    a = np.where(ext, 0, a); a = np.maximum(a, (~ndi.binary_dilation(ext, iterations=2)) * 1.0)
    a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), 0.7)
    rgba = np.dstack([c.astype(np.uint8), (a * 255).astype(np.uint8)])
    save(name, cv2.resize(rgba, (size, int(size * (y1 - y0) / (x1 - x0))), interpolation=cv2.INTER_AREA))

M = 'main.png'
icons = {
 'energy': (630, 40, 710, 125), 'water': (985, 35, 1050, 125), 'happiness': (1300, 50, 1385, 125), 'wood': (1640, 55, 1730, 125),
 'coins': (1880, 50, 1960, 125), 'quest': (75, 350, 165, 445), 'build': (75, 595, 170, 690), 'cloud': (65, 825, 170, 895),
 'map': (925, 1290, 1020, 1385), 'journal': (1345, 1295, 1445, 1385), 'storage': (1795, 1295, 1885, 1385),
 'gear': (2440, 1330, 2512, 1402), 'sun': (2195, 280, 2300, 370), 'lvcloud': (2255, 70, 2330, 130),
}
for k, b in icons.items(): key_icon(M, b, name='icon-' + k)
key_icon(M, (470, 1295, 555, 1380), tol=(40, 70), name='icon-town')
# workshop + chart extras
key_icon('workshop.png', (1665, 625, 1745, 705), name='icon-hammer-gold')
key_icon('chart.png', (1220, 160, 1340, 265), tol=(30, 60), name='compass')
for k, b in {'leaf': (700, 410, 800, 510), 'drop': (1225, 410, 1330, 510), 'crystal': (1755, 410, 1860, 510)}.items():
    key_icon('chart.png', b, tol=(30, 60), name='badge-' + k)

def vignette(src, box, name, maxw=560, fx=0.12, fy=0.14, round_only=False):
    im = cv2.imread(src)[..., :3]; x0, y0, x1, y1 = box; c = im[y0:y1, x0:x1]
    h, w = c.shape[:2]; yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ex = np.minimum(xx, w - 1 - xx) / (w * fx); ey = np.minimum(yy, h - 1 - yy) / (h * fy)
    a = ss(0, 1, np.minimum(ex, ey))
    save(name, np.dstack([c, (a * 255).astype(np.uint8)]), maxw)

# card art
vignette('chart.png', (525, 470, 985, 810), 'card-verdant', fx=0.06, fy=0.08)
vignette('chart.png', (1050, 470, 1500, 810), 'card-rain', fx=0.06, fy=0.08)
vignette('chart.png', (1580, 470, 2030, 810), 'card-prism', fx=0.06, fy=0.08)
vignette('workshop.png', (1425, 905, 1735, 1105), 'build-shelter', fx=0.1, fy=0.12)
vignette('workshop.png', (1785, 905, 2105, 1105), 'build-waterCollector', fx=0.1, fy=0.12)
vignette('workshop.png', (2155, 905, 2485, 1105), 'build-solarFarm', fx=0.1, fy=0.12)
vignette('log.png', (170, 790, 650, 1340), 'log-illustration', fx=0.12, fy=0.1)
vignette('log.png', (770, 810, 1070, 1000), 'quest-shelter', fx=0.12, fy=0.14)
vignette('log.png', (715, 1390, 945, 1520), 'quest-bridge', fx=0.12, fy=0.14)
vignette('log.png', (715, 1630, 1000, 1800), 'quest-garden', fx=0.12, fy=0.14)
# other building art from the main map (soft vignette)
for k, b in {
  'market': (540, 950, 860, 1130), 'clinic': (330, 560, 690, 800), 'greenhouse': (1640, 960, 1880, 1110),
  'windTurbine': (500, 140, 790, 380), 'garden': (1400, 1110, 1700, 1290), 'storageHouse': (2290, 1000, 2520, 1110),
  'communityHall': (1800, 520, 2120, 760), 'bridgeAnchor': (830, 440, 990, 560), 'battery': (1640, 960, 1880, 1110),
}.items():
    vignette(M, b, 'build-' + k, fx=0.16, fy=0.18)
vignette('chart.png', (1640, 500, 1980, 790), 'build-battery', fx=0.12, fy=0.14)

# advisor header: cloud + "Cloud's Notes" ribbon, sky keyed out
im = cv2.imread('advisor.png')[..., :3]; x0, y0, x1, y1 = 760, 225, 1535, 665
c = im[y0:y1, x0:x1]; hsv = cv2.cvtColor(c, cv2.COLOR_BGR2HSV).astype(np.float32)
H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
sky = ss(90, 100, H) * (1 - ss(130, 140, H)) * ss(40, 80, S) * (1 - ss(95, 140, V))
a = 1 - sky
lbl, n = ndi.label(a < 0.5); edge = set(np.unique(np.concatenate([lbl[0], lbl[-1], lbl[:, 0], lbl[:, -1]]))) - {0}
a = np.where(np.isin(lbl, list(edge)), a, 1.0)
a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), 0.8)
save('advisor-header', np.dstack([c, (a * 255).astype(np.uint8)]), 700)
c = im[770:945, 780:1015]; save('advisor-rain', np.dstack([c, np.full(c.shape[:2], 255, np.uint8)]))
key_icon('advisor.png', (785, 1285, 945, 1455), tol=(25, 50), name='icon-scales')
# map/journal icons for the advisor buttons
key_icon('advisor.png', (790, 1745, 870, 1820), tol=(25, 50), name='icon-chart-small')
print('done')

def lum_icon(src, box, name, t=(95, 140), size=128):
    im = cv2.imread(src)[..., :3]; x0, y0, x1, y1 = box; c = im[y0:y1, x0:x1]
    L = cv2.cvtColor(c, cv2.COLOR_BGR2LAB)[..., 0].astype(np.float32)
    a = ss(t[0], t[1], L); a = cv2.GaussianBlur(a, (0, 0), 0.6)
    rgba = np.dstack([c, (a * 255).astype(np.uint8)])
    save(name, cv2.resize(rgba, (size, int(size * (y1 - y0) / (x1 - x0))), interpolation=cv2.INTER_AREA))
def circ_icon(src, box, name, size=128, inset=1.0):
    im = cv2.imread(src)[..., :3]; x0, y0, x1, y1 = box; c = im[y0:y1, x0:x1]
    h, w = c.shape[:2]; yy, xx = np.mgrid[0:h, 0:w]
    d = np.hypot(xx - w / 2, yy - h / 2) / (min(w, h) / 2 * inset)
    a = 1 - ss(0.94, 1.0, d)
    save(name, cv2.resize(np.dstack([c, (a * 255).astype(np.uint8)]), (size, size), interpolation=cv2.INTER_AREA))
lum_icon(M, (2440, 1330, 2512, 1402), 'icon-gear', t=(90, 130))
lum_icon(M, (2255, 70, 2330, 130), 'icon-lvcloud', t=(100, 150))
lum_icon(M, (470, 1295, 555, 1380), 'icon-town', t=(150, 190))
circ_icon('chart.png', (702, 412, 798, 508), 'badge-leaf')
circ_icon('chart.png', (1228, 412, 1326, 510), 'badge-drop')
circ_icon('chart.png', (1758, 412, 1856, 510), 'badge-crystal')
lum_icon(M, (2449, 1338, 2503, 1392), 'icon-gear', t=(90, 130))
key_icon('workshop.png', (1440, 858, 1510, 922), tol=(30, 60), name='icon-town')
