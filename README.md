# mothlight

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/DianChairo/mothlight/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/DianChairo/mothlight/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Mothlight** is a 2D arena survival game for the browser, written in plain
JavaScript and Canvas with no build step and no network requests. You are the
last moth of light in a night garden: hold off ten waves of shadow creatures,
gather the nectar they drop, and bring back the dawn — or fall trying.

- **Move** with WASD or the arrow keys, **aim** with the mouse, **hold click or
  Space** to fire, **Shift** to dash through danger, **P** pauses, **M** mutes.
- Four enemy kinds (chasers, darters, splitters and spitters), five power-ups,
  a combo multiplier, particles, screen shake and a synthesized WebAudio
  soundtrack — every sound is generated in code, there are no audio files.
- Clear wave 10 to win and unlock endless mode; your best score is kept in
  `localStorage`.

The game is plain static files under `game/`; the entry program `main.ts`
(Node 22, standard library only) copies `game/` and `screenshots/` to the
output directory and writes the `dossier.json` the make.fun judge reads, using
the vendored `vendor/makefun-game.ts` library.

## Run it

```sh
node --experimental-strip-types -e "const http=require('node:http'),fs=require('node:fs'),path=require('node:path');const root=path.join(process.cwd(),'game');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css'};http.createServer((req,res)=>{const p=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);fs.readFile(p,(e,d)=>{if(e){res.writeHead(404);res.end()}else{res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});res.end(d)}})}).listen(8080,()=>console.log('http://localhost:8080'))"
```

Then open http://localhost:8080 in a desktop browser and play.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8tpwxchz&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
