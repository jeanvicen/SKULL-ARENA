# Esquema de dados

Fonte de verdade dos tipos: `src/content/types.ts`. Tudo em `data/` é carregado por `src/content/load.ts` e validado por `src/content/validate.ts` (`npm test` falha com erro de conteúdo).

## Personagem — `data/characters/<id>.json`
| Campo | Exemplo | Notas |
|---|---|---|
| `id`, `name`, `title` | `"ossinho"`, `"Ossinho"`, `"O Recruta Incansável"` | |
| `rarity` | `comum` … `creator` | ver `rarities.json` |
| `role` | `tanque`, `assassino`, `atirador`, `suporte`, `lutador`, `controlador`, `artilheiro` | usado pela IA e pela UI |
| `lore`, `voiceLines.{select,victory,defeat,kill}` | texto | únicos por personagem |
| `voiceLines.audio` | `{ "select": "vo/x.mp3" }` | slot para áudio gravado |
| `stats.{hp,moveSpeed,attackInterval,radius?}` | `6500, 255, 0.55` | unidades/segundo |
| `basicAttack.projectile` | id de projétil | |
| `special.ability` | id de especial | |
| `art` | `{ skull, headwear, eyes, eyeColor, jaw, body, weapon, aura?, boneColor?, scale? }` | aparência procedural |
| `palette` | `[primária, escura, destaque]` | |
| `skins` | `["default","golden","void","neon"]` | + lendárias com `characterId` em `skins.json` |
| `obtain` | `starter`, `chest`, `shop`, `event`, `creator` | |
| `portrait`, `sprite` | `"procedural"` | troque por caminho de arte final |

Opções de `art`: crânio `round|long|wide|cracked|horned|tiny|square`; chapéu `none|hood|crown|tophat|horns|helmet|bandana|witch_hat|halo|mohawk|flame|cap|samurai|antlers|beanie|pharaoh`; olhos `glow|hollow|angry|cyclops|x|star|spiral|heart|visor`; mandíbula `grin|fangs|stitched|open|gold_tooth|beard`; roupa `robe|armor|jacket|ribs|cloak|suit|tunic|bandages|kimono|hoodie`; arma `scythe|pistols|staff|bow|hammer|daggers|cannon|lute|chain|book|claws|fist|katana|lantern|trident|guitar|flask|shield|shovel`; aura `none|flame|void|gold|creator|frost|toxic|electric`.

## Projétil — `data/projectiles/<id>.json`
| Campo | Efeito |
|---|---|
| `type` | `direct` (reto) · `lob` (arco, passa por cima de tudo) · `melee` (golpe em arco) |
| `range`, `speed`, `damage`, `radius`, `lifetime?` | básicos |
| `count` + `spreadDeg` | leque |
| `burst: {count, interval}` | rajada |
| `bounces`, `bounceOnEnemies` | ricochete em parede / em cadeia entre inimigos |
| `pierce` | atravessa N inimigos |
| `homing` | graus/s de curva até o alvo |
| `orbit: {radius, angularSpeed}` | gira em volta do dono |
| `aoeRadius`, `knockback` | explosão / empurrão |
| `meleeArcDeg` | abertura do golpe |
| `zone: {radius, duration, dps?, hps?, status?, color, look?}` | área persistente no impacto |
| `onHit: {effect, duration, dps?, amount?}` | status: `burn, poison, slow, stun, freeze, root, weaken, mark, haste, rage, regen, reveal, silence` |
| `lifesteal`, `falloffMul` | roubo de vida / mais dano de longe |
| `vfx: {shape, color, color2?, trail?, impact?, scale?}` | formas: `orb, dagger, bone, arrow, skull, flame, wave, shard, note, bolt, scythe, bubble` |
| `sfx: {fire, hit}` | nomes de receitas em `src/audio/audio.ts` |

## Especial — `data/abilities/<id>.json`
`type`, `cooldown`, `chargePerHit` (cada acerto do básico adianta a recarga), `ai` (dica para bots: `engage|escape|low_hp|enemies_near|in_range|allies_hurt`), `params`, `vfx`, `sfx`.

| Tipo | Parâmetros obrigatórios (+ opcionais) |
|---|---|
| `dash` | `distance` (+ `duration, invuln, damageOnPass, knockback, status`) |
| `aoe_burst` | `radius, damage` (+ `castRange, delay, knockback, status, zone`) |
| `shield` | `absorb, duration` (+ `reflect, speedMul, damageMul`) |
| `heal` | `radius` (+ `heal, hps, duration, status, zone`) |
| `summon` | `count, minion{name,hp,moveSpeed,radius,lifetime,projectile,attackInterval,look}` |
| `buff` | `duration` (+ `speedMul, damageMul, attackSpeedMul, lifesteal, heal, status`) |
| `debuff` | `radius, status` (+ `castRange, damage`) |
| `teleport` | `distance` (+ `radius, damage, invuln, status`) — atravessa paredes finas |
| `trap` | `radius, damage` (+ `count, castRange, delay, status`) |
| `beam` | `length, width, dps, duration` (+ `status`) |
| `transform` | `duration` (+ `hpMul, radiusMul, speedMul, damageMul, basicProjectile, heal`) |
| `multi_shot` | `projectile, waves, interval` (+ `spreadDeg`) |
| `zone` | `zone` (+ `castRange, damage`) |
| `pull` | `radius, pullStrength` (+ `damage, status`) |

## Mapa — `data/maps/<id>.json`
`size {w,h}` (retrato: 720×1280), `symmetry` (`none|mirror_x|mirror_y|point|quad` — o loader espelha obstáculos, mato e destrutíveis), `spawns[]`, `teamSpawns {a[], b[]}`, `obstacles[] {type,x,y,w,h}` (tipos em `obstacles.json`: `wall, tomb, pillar, crystal, statue, fence, water, bones` — `fence/water/bones` bloqueiam movimento mas não tiros), `brush[]`, `destructibles[] {type: crate|urn|coffin, x, y, hp}`, `modes[]`, `theme` (`crypt, graveyard, lava, ice, swamp, temple, neon, void`), `decorSeed`.

## Outros
- `rarities.json`: cor, peso no baú, preço direto, compensação de repetido, custo de upgrade.
- `chests.json`: rolagens, faixa de moedas, chance de diamantes, chance de personagem, multiplicadores por raridade.
- `pets/*.json`: `aura_heal | mirror_shot | reveal | shield_pulse` + parâmetros.
- `modes.json`: tipo (`ffa|team|duel`), jogadores, vitória, respawn, névoa, almas, recompensas, aviso de bots.
- `progression.json`: curva de XP, recompensas de nível, upgrades, iniciais, trilha de troféus.
- `events.json`, `achievements.json`, `titles.json`, `shop.json`, `skins.json`.
- `control.json`: cone de ataque, aim assist, joystick, regeneração, invulnerabilidade de spawn, mato, almas.
