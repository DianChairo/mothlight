// Mothlight's entry program (Node 22, standard library only).
//
// The game itself is the static site in game/ — plain files a desktop
// browser opens offline. This program hands it in: it copies game/ and
// screenshots/ into the output directory and writes dossier.json there
// with buildDossier from the vendored make.fun library, byte for byte
// the way the scorer rebuilds it. Run it locally with:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// MAKEFUN_OUTPUT_DIR stands in for /output outside the grader.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });

mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
const shotsDir = join(repoDir, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The caps below are the gate's own (reference/gate.json): at most four
// screenshots of 256 KiB, at most 993 entries and 48 MiB under game/, no
// path under game/ longer than 1000 bytes, and the dossier's source text
// capped at 160 KiB. Passing them here means the dossier this writes is
// the dossier the scorer accepts.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
