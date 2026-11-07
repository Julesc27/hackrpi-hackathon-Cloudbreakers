// Keep painted sprites, game hit areas, plots and bridge anchors in the same world space.
// The outer islands move outward to leave room for the expanded home terraces.
export const ISLAND_OFFSETS = {
  verdant: [-70, -440], rain: [250, 5], prism: [940, 745], mercy: [-155, 35], hearth: [220, 0],
}

// Stable slot indexes preserve buildings in existing saves. Each terrace holds two shelters.
export const STARTER_PLOTS = [
  [738, 495], [795, 507], // central residential terrace
  [928, 430], [981, 446], // upper-right residential terrace
  [952, 594], [1002, 610], // lower-right residential terrace
  [679, 344], [721, 352], // upper clearing, clear of the stairs and beacon
]

// Smaller clearings need smaller footprints; saved buildings keep their slot indexes.
export const STARTER_PLOT_WIDTHS = [58, 58, 56, 56, 54, 54, 42, 42]

export const STARTER_BEACON = [798, 236]

// Hit areas follow visible resource landmarks in the painted island sprites.
export const INTERACTION_POINTS = {
  grove: [550, 432], stone: [590, 536], garden: [842, 644], collector: [934, 553],
  forest: [300, 125], forage: [440, 175], lumber: [300, 210],
  falls: [1175, 200], fishing: [1260, 225],
  crystals: [1360, 890], salvage: [1450, 970],
}
