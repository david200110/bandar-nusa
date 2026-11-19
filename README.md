# Bandar Nusa — Kisah Raka

An open-world crime game set in the fictional Indonesian coastal city of
**Bandar Nusa**, built for the [make.fun](https://make.fun) **Make GTA 6**
bounty (`gta6-01`). Everything in it is original: the city, the characters,
the story, the art, the sound and the music. Nothing comes from Rockstar
Games or any other commercial game.

## The story

Raka, a young courier in Bandar Nusa, owes Rp 1,400,000 to Bos Jalak, a
harbour boss who collects through fear. Five jobs pay the debt off, one by
one: deliver a package, race a deadline, steal a car, survive a police
sweep, and settle the score at the harbour warehouse. After the story,
free roam stays open.

## How to play

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

The game is plain static files under `game/` — no build step, no network
requests at runtime. It also runs by opening `game/index.html` from any
static file server.

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk / drive |
| Shift | Run |
| E | Get in / out of a car (stealing one raises your wanted level) |
| F or mouse click | Punch |
| Space | Handbrake |
| Drag mouse | Orbit camera, wheel zooms |
| Esc / P | Pause |
| M | Mute |

## Features

- **A living city**: a procedural grid city with a downtown, a fish market,
  a beach and a pier; traffic that drives the streets and pedestrians who
  walk the sidewalks (and flee from speeding cars).
- **On foot and by car**: walk, run, steal parked and moving cars, drive
  with steering, braking and a handbrake.
- **Wanted level**: five stars. Stealing cars and hitting pedestrians raise
  it; police cars chase and ram you, and they bust you if they hold you on
  foot. Stay quiet and out of sight and the heat cools down.
- **Missions and a story**: five chained missions with briefings, timed
  deliveries, a car theft, a 60-second police evasion and a final fight
  against Bos Jalak's crew — plus cash pickups scattered around the city.
- **Combat**: punch gang members who attack you; your health regenerates
  when you stay out of trouble.
- **HUD and minimap**: money, health, wanted stars, the clock, the current
  objective with distance, a speedometer and a live top-down minimap.
- **Save and load**: progress autosaves after each mission; pause to save
  manually, continue from the title screen.
- **Sound**: all audio is synthesized live with WebAudio — an original
  groove, engine hum, police sirens, punches, crashes and jingles. No
  audio files, no licensed music.
- **Day cycle**: the sun moves with the game clock; streetlights come on
  after dark.

## Tech

- Three.js r160, vendored as `game/vendor/three.module.min.js`.
- Plain ES modules under `game/src/`, one job per file: `config`, `random`,
  `input`, `audio`, `city`, `world`, `missions`, `render`, `hud`, `save`,
  `shots`, `main`.
- `?seed=N` rebuilds the same city and traffic. `?shot=start|drive|chase|mission`
  stages a screenshot scene through the real rules.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with the vendored make.fun
library (`vendor/makefun-game.ts`, unchanged from the kit):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
