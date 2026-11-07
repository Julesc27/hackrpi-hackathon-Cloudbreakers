# Painted game assets

Reference: `concept/command-center-no-people-final.png` (the people-free concept).
Generated using the built-in image generation tool, then integrated as transparent sprite atlases, not a flattened map screenshot.

## Atlas layout

- `islands-civic.png`: original reference atlas, 2 columns by 2 rows. New Haven, Mistral Heights, Rain Island, Mercy Rise.
- `islands-civic-layered.png`: same grid with Mistral rotor blades removed. The active Rain Island and Mercy Rise sprites use this sheet in both the map and cards.
- `islands-settlement.png`: 2 columns by 2 rows. Hearthside, Verdant Reach, Glass Gardens, Skyport.
- `buildings.png`: 4 columns by 3 rows. Shelter, bridge anchor, garden, water collector; storage house, solar farm, market, clinic; community hall, wind turbine, battery, greenhouse.

Rows are ordered left to right. The map measures the alpha bounds of each cell once at load. Art positions are in `components/world/paintedArt.js`; gameplay hit areas and plots remain in `game/data.js`.

`PAINTED_ATLASES` is the shared source registry for the world and every preview. `PaintedSprite.jsx` fits each alpha-bounded sprite into its card and clips neighboring cells. The quest book, journal cover, advisor, island drawers, chart, workshop and bridge routes reuse the current island/building images. The workshop upgrade uses a hammer badge rather than the retired decorative anchor model.

## Generation prompts

### Civic atlas

Create one transparent 2 by 2 sprite atlas based faithfully on the reference painting. Top left: the central tiered pale stone island with its gold and cobalt astronomical beacon, blue banners, stairs and long cyan waterfall. Top right: energy island with blue solar arrays, three ivory turbines with gold blades, pines and an orange-roof cottage. Bottom left: three round water reservoirs and cascading aqueducts. Bottom right: the curved pale stone hospital with blue roofs, red cross and airship dock. Match the reference's isometric camera, painterly watercolor/gouache textures, cream clouds, lavender rock undersides and warm lamplight. Isolate each island inside its equal quadrant with transparent margins. No sky background, UI, words, people or connecting bridges.

### Settlement atlas

Create one transparent 2 by 2 sprite atlas matching the same reference. Top left: clustered cream cottages with purple, cobalt and terracotta roofs. Top right: pine-covered market grove with orange pavilion, stalls, crates and dock. Bottom left: glass greenhouse, windmill, vegetable rows, shed and waterfall. Bottom right: timber airship pier with cream and gold dirigible, blue banners, crates and lanterns. Preserve the painterly architecture, colors, lighting and view angle. One complete island per equal quadrant. No sky, UI, words, people or connecting bridges.

### Construction atlas

Create one transparent sprite atlas with exactly 4 columns and 3 rows of twelve isolated buildable structures: cottage, bridge anchor, garden, water collector; storehouse, solar panels, market, clinic; community hall, wind turbine, crystal battery, greenhouse. Match the reference's hand-painted isometric cream stone, golden details, warm windows and blue/terracotta roofs. Each sprite stands on a small stone base with generous cell padding. No people, text, labels, UI or scenery. A background-removal pass preserves this grid and removes all white/translucent paper between objects to true alpha-zero transparency.

### Turbine layer preparation

Preserve the exact civic atlas dimensions, positions, architecture and colors. In its top-right cell only, remove the three turbine rotor blades while keeping the ivory poles and golden hubs in the same positions. Preserve true transparency and every other island detail. The game supplies the moving blades separately.

## Runtime behavior

Each island has independent floating motion and selection state. Water spray, energy glints, window lights, rotors, birds and beacon light animate separately. Player-built structures use the construction atlas and animate into their plot. Bridge geometry, conditions and interactions remain live. Reduced-motion preferences disable decorative motion. If artwork is unavailable, the procedural map remains a playable fallback.


## Expanded starter island

`starter-island-expanded.png` replaces the main-island sprite. Its reference is `concept/command-center-expanded-starter-island.png`. It is a separate transparent sprite, with the original civic atlas retained for the other islands.

Built-in image generation brief: isolate only the central expanded starter island from the reference, preserving the beacon, terraces, pine grove, blue-roof cottage, cistern, farm, dock, cliffs and waterfalls. Keep the three large residential pads and upper clearing empty. Remove hammer signposts, dotted pad outlines, surrounding islands, sky, UI and people. Preserve the reference's painted style and supply a complete island with true transparency.

Eight stable gameplay slots occupy four clear terraces, with two shelters per terrace. Existing save slot indexes are retained. `game/mapLayout.js` shares surrounding-island offsets with the painting positions, hit areas, plots and bridge anchors so the expanded main island has real space in the world.


## Four-island chapter assets

The built-in image generation tool produced two independent transparent sprites, referencing `concept/command-center-expanded-starter-island.png`:

- `verdant-forest.png`: isolate a forest/farming island matching the reference's upper-left island; dense pine and golden trees, lumber shed, log piles, vegetable and seed beds, clear front terrace, cream paths, right-hand bridge dock, lavender hanging cliffs and cyan waterfalls. Preserve the painted perspective and palette; no people, sky, UI, words or connecting bridges.
- `prism-shelf.png`: isolate the reference's lower-right crystal island; tiered pale stone shelves, luminous blue energy crystals, gold/brass pylons, component workshop, four clear building pads and upper-left bridge landing. Preserve the reference style and palette; no people, sky, UI, words or off-island bridges.

Both are game sprites with true alpha transparency. The resource loop uses the expanded starter island, forest, water island and crystal shelf. The hospital (Mercy Rise) and village (Hearthside) are also active destinations, restored from the original civic and settlement atlases. Older atlas assets remain available as reference material.
