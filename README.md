[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/david200110/bandar-nusa/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/david200110/bandar-nusa/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Bandar Nusa — Open World Crime Game

An original low-poly 3D open-world crime game set in the coastal city of **Bandar Nusa**.
You are **Raka**, a driver who owes crime boss **Boss Jalak** Rp 1,400,000. Run his five
jobs, dodge the police, and pay the debt back — or the city owns you.

This is an entry for the **Make GTA 6** bounty
([gta6-01](https://make.fun/bounty/gta6-01)) on
[make.fun](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01).
Everything in it is original: the story, the city, the characters and the music are
written for this game and are not taken from any other game series.

## The Story

Raka borrowed money he could not repay. Boss Jalak gives him one way out: five jobs,
each one paying a slice of the debt. Collect a package from the old pier. Shake down
three shops for protection money. Steal a car and deliver it to the garage. Clear the
thugs off the harbor. Then walk into Boss Jalak's office and settle the debt — all
Rp 1,400,000 of it.

## Features

- **Open world** — a procedural grid city with a beach, the sea, a wooden pier, a
  harbor, a market, and Boss Jalak's tower, built with Three.js r160 (vendored locally,
  no network requests at runtime).
- **Day and night cycle** — the sun rises and sets, street lamps and windows light up
  after dark.
- **Traffic and pedestrians** — cars drive the city loops and people walk the sidewalks.
- **Wanted level 0–5 stars** — steal a car, hit a pedestrian or punch a cop and the
  police chase you. Get caught and you wake up at the hospital, 10% of your cash lighter.
- **Five chained missions** — rewards of Rp 150,000 / 250,000 / 200,000 / 300,000 /
  Rp 500,000, adding up to exactly the Rp 1,400,000 debt.
- **Combat** — fists only. Punch thugs, pedestrians and cops (the last two are a bad idea).
- **Stealable cars** — press E next to any parked car and drive it. Wanted stars included.
- **HUD and minimap** — money, debt left, wanted stars, health, mission objective, clock,
  and a live top-down map of the city.
- **Save and load** — progress is saved to localStorage automatically and can be
  continued from the title screen.
- **Original music** — a slow synth score generated live with WebAudio. No audio files,
  no copyrighted material.

## How to Play

Open `game/index.html` in a desktop browser (or serve the folder with
`node serve.ts` and open http://localhost:8080). No install step, no internet needed.

| Key | Action |
| --- | --- |
| W A S D | Move on foot / drive |
| Shift | Run |
| E | Enter or exit a car |
| F | Punch |
| Drag mouse | Look around |
| M | Music on / off |
| P | Save game |

Follow the golden marker to each mission target. Your current objective is always
shown at the top left. Keep an eye on the wanted stars at the top right — when they
are lit, the police are coming, and they do not give up easily. Lay low for a while
and the stars fade one by one; get caught and you wake up at the hospital, 10% of
your cash lighter.

## The Five Missions

| # | Mission | Job | Reward |
| --- | --- | --- | --- |
| 1 | First Errand | Pick up a package at the old pier, deliver it to the market | Rp 150,000 |
| 2 | Night Collection | Collect protection money from three shops | Rp 250,000 |
| 3 | The Getaway Driver | Steal a car and deliver it to the garage | Rp 200,000 |
| 4 | Harbor Trouble | Defeat three thugs shaking down the harbor | Rp 300,000 |
| 5 | Settle the Debt | Bring the money to Boss Jalak's office | Rp 500,000 |

The rewards add up to exactly Rp 1,400,000 — the full debt. Finish the fifth mission
and Raka is free.

## Project Layout

- `main.ts` — the submission program: copies `game/` and `screenshots/` into the
  output folder and writes `dossier.json` (run with `MAKEFUN_OUTPUT_DIR=out node main.ts`).
- `game/` — the playable game as static files: `index.html` plus ES modules under
  `game/src/`, with Three.js r160 vendored at `game/vendor/three.module.js`.
- `game/src/logic.js` — the pure game rules (missions, debt, wanted level, save data),
  covered by the logic checks in `tests/checks.mjs`.
- `screenshots/` — four screenshots of the game, described in `shots.json`.
- `serve.ts` — a tiny static server for local development.

## Development

```sh
node serve.ts            # serve the game at http://localhost:8080
node tests/checks.mjs    # run the logic checks (66 checks)
node tools/playtest.mjs  # headless play-test: movement, missions, cars, police, screenshots
```

The play-test drives the real game in headless Chromium: it walks, completes the
first mission, steals and drives a car, gets busted by the police, checks the save,
and captures the four screenshots in `screenshots/`.

## License

MIT — see [LICENSE](LICENSE). Copyright 2026 David Maulana.
