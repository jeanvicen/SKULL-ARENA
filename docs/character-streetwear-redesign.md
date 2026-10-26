# Character streetwear redesign

Visual-only direction for the existing 17-character roster. Combat data, abilities, stats, controls, collision, and progression remain unchanged. Existing palette, weapon, skull/headwear, and aura data remain canonical; the renderer adds silhouettes/clothing details and individual motion accents.

| Character | Palette (primary / secondary / accent) | Streetwear silhouette | Existing power language | Motion signature |
|---|---|---|---|---|
| Anúbis Eterno | `#ffcf3a` / `#16255e` / `#4fb3ff` | Pharaoh-techwear, utility straps | Gold | Measured, deliberate idle and grounded steps |
| Lúgubre | `#2fb8a5` / `#0b3d38` / `#7ff7e4` | Ranger layers, loose practical trousers | Bow/teal identity | Precise, restrained aim-like posture |
| Barão Bomba | `#b3202e` / `#1a1a1a` / `#ffd84a` | Dapper dark suit and top hat | Explosive weapon identity | Elegant, poised motion |
| Bruxo Verde | `#5fd13a` / `#1d3d12` / `#c6ff9e` | Alchemist robe with cargo details | Flask/alchemy green | Swaying, curious alchemist idle |
| Ceifador Jr. | `#d81e3c` / `#14000a` / `#ff7a8f` | Punk hood, sharp silhouette | Void/scythe | Quick, sharp footwork and attack recoil |
| Coveiro | `#a07a45` / `#2e2112` / `#d6b37a` | Workwear, utility pocket | Shovel/earthy identity | Heavy, deliberate movement |
| JEANVICEN | `#ff2d95` / `#140a24` / `#3df2ff` | Street-artist hoodie, graphic patch | Creator | Relaxed swagger |
| Lanterneira | `#ffb52e` / `#3b1e05` / `#ffe27a` | Soft layered robe | Lantern/light | Floaty, gentle drift |
| Necromante Mirim | `#8fe33b` / `#1b2e0a` / `#e8ffd0` | Playful toybox layers | Toxic/book | Bouncy, mischievous idle |
| Ossinho | `#ff9d3c` / `#7a3a0e` / `#fff3d6` | Skate hoodie and roomy pants | Fist/melee | Springy, energetic bounce |
| Pó | `#e8a54b` / `#6b3410` / `#ffd27a` | Desert bandana and loose layers | Dual pistols | Quick, agile movement |
| Sombra Púrpura | `#6b2fb5` / `#2a0a4a` / `#c9a0ff` | Gothic hood and long silhouette | Void/daggers | Floaty, ghostlike motion |
| Rachada | `#5d7fbf` / `#1d2b4a` / `#9fc3ff` | Sport layers, cracked skull retained | Cracked identity | Heavy, weight-shifted stance |
| Rainha Gélida | `#5ac8ff` / `#0d2a4a` / `#e6fbff` | Regal layered streetwear | Frost | Elegant, controlled motion |
| Ricochete | `#f4ff52` / `#2b0a3d` / `#b84dff` | Punk jacket and mohawk retained | Ricochet/energy | Rhythmic, quick-feeling idle |
| Tambor | `#ff5fc8` / `#3a0d4a` / `#53f3ff` | Performer layers and beanie | Music/support identity | Rhythmic movement |
| Titã Blindado | `#ff8a1f` / `#2a2f38` / `#9ff3ff` | Industrial armor, utility straps | Electric/shield | Heavy, stable movement |

The in-game Canvas renderer and Canvas showcase share the same redesigned procedural sprites. The Three.js showcase remains outside this visual pass; it is not the source for combat sprites.

## 2.5D volume pass (October 2026)

The playable roster now receives a dedicated volume pass in the shared procedural Canvas sprite bake. At combat scale, clothing is modeled with rounded sleeve cross-sections, an occluded inner face, upper-left highlights, under-fold shadows, large garment folds and a convex torso light plane. A separate per-character silhouette map categorizes the cut as layered, roomy, tailored, heavy, or soft; this affects the sleeve width and depth, while each character's signature outer panels and canonical art/palette continue to distinguish the full outfit. These are vector-like Canvas paths and gradients drawn at sprite-bake time—not CSS filters, additional flat icon details, or claimed hand-painted/raster assets. Because the fight and Canvas showcase use the same baked sprite, the treatment appears in both places without altering combat data.

### Scope and explicit limits

- All 17 current playable IDs are explicitly represented in the silhouette map and tested against the content registry. Future roster additions must add a cut there.
- This remains a 2D Canvas renderer with layered shading and implied form, not a real 3D model, mesh, skeletal rig, hand-drawn sprite sheet, or physically accurate lighting. The visual direction is 2.5D rather than true 3D.
- The current head, weapon and effects retain their existing procedural art; this pass chiefly models apparel/shoulder volume. Existing skull, eyes, jaw, headwear, weapons, palettes, powers, animation, collision, stats and cooldowns are preserved.
- Shapes are designed for the small arena sprite and can simplify at tiny resolutions. Inspect actual device scale when tuning; avoid adding glows that impair silhouette readability.
- The Three.js showcase remains outside scope, as before. It is not used by the combat renderer or the Canvas portrait showcase.
- Validation covers source/build/tests when available; automated tests verify roster coverage and identity contracts, not subjective visual quality or screenshots on every display.

The treatment does not modify fighter dimensions, hitboxes, collision, balance, cooldowns, or simulation.
