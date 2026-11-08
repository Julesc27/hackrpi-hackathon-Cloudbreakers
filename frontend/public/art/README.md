# Painted game assets

Reference: `concept/command-center-no-people-final.png` (the people-free concept).
Generated using the built-in image generation tool, then integrated as transparent sprite atlases, not a flattened map screenshot.

## Atlas layout

Shipped sprites are WebP (quality 88, lossless-quality alpha) to keep the download small. Keep the PNG masters outside `public/` if you need to edit them.

- `islands-civic-layered.webp`: 2 columns by 2 rows (New Haven, Mistral Heights, Rain Island, Mercy Rise), with Mistral rotor blades removed. (The original `islands-civic.png` was unused and has been removed.) The active Rain Island and Mercy Rise sprites use this sheet in both the map and cards.
- `islands-settlement.webp`: 2 columns by 2 rows. Hearthside, Verdant Reach, Glass Gardens, Skyport.
- `buildings.webp`: 4 columns by 3 rows. Shelter, bridge anchor, garden, water collector; storage house, solar farm, market, clinic; community hall, wind turbine, battery, greenhouse.

Rows are ordered left to right. Each cell's alpha bounds are precomputed and stored in `paintedArt.js` (`cells`), so the map never scans pixels at load. If you replace an atlas, regenerate those bounds. Art positions are in `components/world/paintedArt.js`; gameplay hit areas and plots remain in `game/data.js`.

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

`starter-island-expanded.webp` replaces the main-island sprite. Its reference is `concept/command-center-expanded-starter-island.png`. It is a separate transparent sprite, with the original civic atlas retained for the other islands.

Built-in image generation brief: isolate only the central expanded starter island from the reference, preserving the beacon, terraces, pine grove, blue-roof cottage, cistern, farm, dock, cliffs and waterfalls. Keep the three large residential pads and upper clearing empty. Remove hammer signposts, dotted pad outlines, surrounding islands, sky, UI and people. Preserve the reference's painted style and supply a complete island with true transparency.

Eight stable gameplay slots occupy four clear terraces, with two shelters per terrace. Existing save slot indexes are retained. `game/mapLayout.js` shares surrounding-island offsets with the painting positions, hit areas, plots and bridge anchors so the expanded main island has real space in the world.


## Four-island chapter assets

The built-in image generation tool produced two independent transparent sprites, referencing `concept/command-center-expanded-starter-island.png`:

- `verdant-forest.webp`: isolate a forest/farming island matching the reference's upper-left island; dense pine and golden trees, lumber shed, log piles, vegetable and seed beds, clear front terrace, cream paths, right-hand bridge dock, lavender hanging cliffs and cyan waterfalls. Preserve the painted perspective and palette; no people, sky, UI, words or connecting bridges.
- `prism-shelf.webp`: isolate the reference's lower-right crystal island; tiered pale stone shelves, luminous blue energy crystals, gold/brass pylons, component workshop, four clear building pads and upper-left bridge landing. Preserve the reference style and palette; no people, sky, UI, words or off-island bridges.

Both are game sprites with true alpha transparency. The resource loop uses the expanded starter island, forest, water island and crystal shelf. The hospital (Mercy Rise) and village (Hearthside) are also active destinations, restored from the original civic and settlement atlases. Older atlas assets remain available as reference material.


## Distant background islands

`background-islands.png` is a transparent 3-column, 2-row atlas generated with the built-in image tool using the supplied Stormfront, Cloudroot, Ancient Ruins, Skyport and Voidreach paintings as visual references. Cells: Stormfront, Cloudroot, Ancient Ruins; Skyport, Voidreach, a small ruined shrine. The original reference panoramas are not drawn as rectangular backdrops.

Generation brief: six complete, isolated mini floating islands in equal cells with transparent gutters; painterly isometric cream stone, cobalt/gold details, lavender cliffs, soft cloud wisps and waterfalls; simplify the reference motifs for 80–130 pixel scenery. No people, UI, words, sky background or off-island bridges. Stormfront has a dome and turbine; Cloudroot has luminous roots and a great tree; Ancient Ruins has broken astronomical arches; Skyport has a lighthouse and airship dock; Voidreach has violet crystals and a contained portal; the sixth island has three mossy pillars.

`PAINTED_ATLASES.background` stores premeasured alpha bounds. The canvas varies the sprites across `FAR_ISLETS`, preserves their proportions and uses low opacity for distance. Gentle bobbing follows reduced-motion preferences. These remain decorative scenery and do not add destinations, routes or buildable plots.

Scenery positions are composed as uneven satellite groups rather than evenly spaced repeats. Each `FAR_ISLETS` entry specifies its theme cell, width and opacity: small companions range from 68–96 world units, while larger outer landmarks range from 150–240. Larger shapes frame the outer sky and leave playable terrain and bridge corridors clear.


## Painted airship

`airship-painted.png` replaces the simple canvas blimp with a transparent painted sprite generated using the built-in image tool. Its references are the supplied Skyport painting and the background-island atlas.

Generation brief: one complete left-facing airship in a gently elevated three-quarter view, matching the islands' gouache textures; ivory canvas envelope with cobalt panels and brass ribs, timber boat-shaped gondola, cobalt cabin roof, gold rails, rope rigging, amber windows and a lantern. No people, text, sky, island or dock; true transparency and clear margins. The alpha bounds are premeasured in `PAINTED_ATLASES.airship`.

The existing flight path remains live. Slow bobbing and a small rocking motion animate the craft, while docked fallback ships retain their mooring ropes. Reduced-motion preferences freeze ambient movement.


## Grounded shelter variants

`shelters-grounded.png` is a two-column transparent atlas generated with the built-in image tool from the starter island and original construction atlas references. The brief replaces the shelter's bright tile pedestal with walls meeting the paving, a narrow worn doorstep, irregular ivy and tiny plant tufts. Two modest cream-stone, weathered-terracotta cottages share the island's camera angle and softer palette; their porch, chimney and ivy differ subtly. No square platform, raised plinth, surrounding ground, people or text.

`buildingSprite(type, slot)` selects the same shelter variant in the canvas and placement preview. The workshop uses the first variant. Shelters use a smaller footprint, a tighter contact shadow and a ground anchor at 93% of the cropped image height. Stable saved plot indexes are preserved; the upper pair is staggered along the paving. Procedural window glows are omitted on painted structures so they no longer create a misplaced yellow halo at the foundations.


## Reference-style bridge materials

`bridge-materials.png` is a transparent 2x2 component atlas generated with the built-in image tool using `command-center-no-people.png` as its style reference. The prompt requests hand-painted honey-brown plank decking, a chunky carved timber handrail, a gold-capped wooden post and a cream-stone gateway pier with cobalt inset. No full map, sky, people or text. The deck is an eight-board top-down rectangle so the renderer can map individual boards to the crossing's live ground-plane projection.

`bridge.js` projects the painted boards onto the animated span and keeps posts upright, with timber rails, diagonal underside braces and a shallow arch. Reinforced spans retain timber decking and use stone piers/bracing. Bridge ends use the starter island's northwestern, northeastern, western and eastern stone openings; the crystal and village routes share the eastern entrance. Existing painted gateway pillars are retained rather than drawing duplicate posts over them. Short on-island paving blends into the existing pathways. Bridges are still absent until built and reveal their components together during construction.


The forest and crystal shelf are repositioned on this branch to give their crossings a diagonal run from the original gate openings, rather than a ladder-like drop. `BRIDGE_LAYOUT_SHIFTS` applies the same translation to painting bounds, plots, resource interactions, hit areas, fallback props, navigation anchors and approach paths. Existing buildings retain their island/slot identities. Both eastern routes share the eastern paved entrance, with the inner railing left open at their fork.
