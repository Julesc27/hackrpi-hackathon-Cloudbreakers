// Keep painted sprites, game hit areas, plots and bridge anchors in the same world space.
// The outer islands move outward to leave room for the expanded home terraces.
export const ISLAND_OFFSETS = {
  verdant: [-70, -440], rain: [250, 5], prism: [940, 745], mercy: [-155, 35], hearth: [220, 0],
}

// Stable slot indexes preserve buildings in existing saves. Each terrace holds two shelters.
export const STARTER_PLOTS = [
  [740, 505], [802, 518], // central residential terrace
  [918, 430], [978, 450], // upper-right residential terrace
  [944, 600], [998, 615], // lower-right residential terrace
  [661, 357], [713, 371], // upper clearing
]

export const STARTER_BEACON = [798, 236]

// Hit areas follow visible resource landmarks in the painted island sprites.
export const INTERACTION_POINTS = {
  grove: [550, 432], stone: [590, 536], garden: [842, 644], collector: [934, 553],
  forest: [300, 125], forage: [440, 175], lumber: [300, 210],
  falls: [1175, 200], fishing: [1260, 225],
  crystals: [1360, 890], salvage: [1450, 970],
}
