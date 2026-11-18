[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/AhmadTurki182/gta6-01-entry3/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/AhmadTurki182/gta6-01-entry3/reward.svg)](https://make.fun/c/gta6-01)

# PALOMA BAY: Crimson Tide

An original open-world crime game in a sun-soaked coastal city, built for the
[Make GTA 6](https://make.fun/c/gta6-01) bounty on make.fun. Lena “Vex”
Marlowe is back in Paloma Bay — the Vultures took her streets, her crew, and
her name. Take them all back.

## The game

- **A living coastal city** — five districts (Old Town, Neon Strip, Harbor
  Docks, Marina Bay, Coral Hills), a beach, a pier, a lighthouse, and the open
  ocean; grid streets full of traffic that brakes and pulls over for sirens,
  and pedestrians who scatter when gunfire starts.
- **15 story missions in 3 acts** — car theft, deliveries, tailing, ambushes,
  heists, harbor sieges, and three street races, with a crew (Rico, June,
  Sal), dialogue, and a finale on the beach at sunrise.
- **A 5-star police force that thinks** — patrol cars chase, flank, and PIT;
  roadblocks and spike strips from 3 stars; a helicopter with a searchlight
  from 4; and a SEARCH mode: break line of sight and the heat cools off.
- **Smarter enemies** — rival gunmen take cover, fire in bursts, and flank
  while their squad pins you down.
- **Progression** — cash, district standing and respect, weapon and car
  shops, a clinic, and autosaves.
- **Feel and polish** — day/night cycle with golden hour and neon nights,
  three procedural radio stations (all sound is synthesized — no audio
  files), a live minimap, wanted stars, speedometer, and a HUD that shows
  the mission, the heat, and the bay at a glance.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

WASD move & drive · E enter / steal cars · Click to shoot · 1–4 weapons ·
M missions · B shop · Q radio · Shift sprint · Space handbrake / jump ·
Esc pause. No build step, no network: every file the game loads lives under
`game/`, and three.js is vendored at `game/vendor/three/three.module.min.js`.

## Repo layout

- `game/` — the game itself (`index.html`, `src/` split by system)
- `game/src/main.js` — boot, game loop, camera, mission engine, shops
- `game/src/city.js` — the five districts, roads, docks, marina, beach
- `game/src/police.js` — wanted system, pursuit, roadblocks, spikes, helicopter, SEARCH
- `game/src/missions.js` — the 15-mission, 3-act story catalog
- `game/src/vehicles.js`, `traffic.js`, `pedestrians.js` — cars, traffic AI, crowds
- `game/src/enemies.js`, `combat.js` — cover/flanking gunmen, hitscan weapons
- `game/src/economy.js`, `daynight.js`, `audio.js`, `effects.js`, `hud.js`, `save.js`
- `screenshots/` — four real renders of the game running
- `main.ts` — the entry program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`

## License

MIT — see [LICENSE](LICENSE).
