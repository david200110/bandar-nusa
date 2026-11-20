// Bandar Nusa — submission program (Node 22, standard library only).
//
// The game itself lives in this directory as plain static files: game/
// (game/index.html plus its ES modules, with Three.js r160 vendored under
// game/vendor/, so a desktop browser plays it offline with no network
// request). This program hands it in: it copies game/ and screenshots/
// beside this file into the output directory and writes dossier.json,
// the summary the judge reads, using the vendored make.fun library.
//
// Run it from this directory with an output folder of your choice:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside a grader container MAKEFUN_OUTPUT_DIR stands in for /output.
//
// Serve the game locally while developing with:
//   node serve.ts
// then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Pre-flight checks: refuse to package an entry the scorer would refuse,
// and fail loudly instead of handing in a broken game.
const gameIndex = join(here, 'game', 'index.html');
if (!existsSync(gameIndex)) {
  throw new Error('game/index.html is missing — the game cannot be packaged');
}
const shotsDir = join(here, 'screenshots');
if (existsSync(shotsDir)) {
  const shots = readdirSync(shotsDir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
  if (shots.length > 4) throw new Error(`too many screenshots: ${shots.length} (max 4)`);
  for (const shot of shots) {
    const size = statSync(join(shotsDir, shot)).size;
    if (size > 262144) throw new Error(`screenshot ${shot} is ${size} bytes (max 262144)`);
  }
  console.log(`Pre-flight: ${shots.length} screenshot(s) within the size cap`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (from the kit's reference/gate.json): only
// text_max_bytes shapes the bytes; the other limits refuse an entry the
// scorer would refuse — more than 4 screenshots or one over 256 KiB,
// more than 993 files in game/ or 48 MiB of game files in all, or a path
// under game/ over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Bandar Nusa packaged into ${out}`);
