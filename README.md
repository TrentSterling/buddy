# Buddy Bonk

Multiplayer ragdoll sandbox by Tront. Grab a friend, grab a limb, make a mess.

Play: https://tront.xyz/buddy/

Single deployable `index.html`, no build step on Pages. Multiplayer is browser-to-browser over WebRTC via Trystero. One browser hosts the physics at 120 Hz; up to four hands share the room.

## Playing

- Left button uses the selected tool. Right button is always a quick grab, so you can drag Buddy or a prop no matter what you are holding.
- The mallet and frying pan are physical: whip the cursor through Buddy or a prop and the hit comes from how fast you swung. A stationary click is a tap.
- Basketballs only score when they are actually shot. A ball still in a glove, or released a blink before the rim, is being carried.
- The Toybox (Shop, or **E** for owned gear) has five departments: Weapons, Toys, Buddy (bodies and hats), Your hand, Room. Click to preview, then Equip, Wear or Use. Purchases are shared room cash. Sandbox opens everything.
- 31 tools. Shortcuts: 1 to 0 toys, Q W F X T heavy tools, J tether, V bumper, Z revolver, S SMG, I burst rifle, P double barrel, N minigun, `;` grenade launcher, `,` spear, Y shuriken, `.` frying pan, `]` water pistol.
- Sweep clears loose clutter and keeps held toys and contraptions. More holds stain cleaning, rope cutting and a host-only full clear.
- Press D for the diagnostics panel. Its last lines log recent pointer decisions (press, refused and why, release), which is what to paste into a bug report if clicks are not landing in your browser.

## Layout

| Path | What |
|---|---|
| `index.html` | The game. The deploy artifact and, on this line, the source of truth. |
| `source/` | The v0.6 catalogue package as delivered: `baseline.html` plus `models.js`, `world.js`, `render.js`, `catalogue.js`, `catalogue.css`, `shop.html`, `ui_patch.py`, assembled by `build.py`. Reproduces the pre-merge v0.6 artifact only. See CLAUDE.md for why. |
| `qa/` | Python Playwright suites (units, gameplay, catalogue, mallet UI, four-client network, mallet network, visual). |
| `evidence/` | Screenshots and JSON the QA suites write. The visual reference. |
| `tools/` | Node harnesses: `verify-lobby.mjs` (two real Chromes, public discovery), `verify-swing.mjs` (mallet swing and hoop rule, Chrome and Firefox). |

## Verifying

```
PYTHONUTF8=1 python qa/units.py
PYTHONUTF8=1 python qa/gameplay_review.py
PYTHONUTF8=1 python qa/catalogue_ui.py
PYTHONUTF8=1 python qa/mallet_ui.py
PYTHONUTF8=1 python qa/network.py
PYTHONUTF8=1 python qa/mallet_network.py
PYTHONUTF8=1 python qa/visual.py
node tools/verify-lobby.mjs [https://tront.xyz/buddy/]
PW_DIR=<dir with playwright installed> node tools/verify-swing.mjs both [https://tront.xyz/buddy/]
```

The Python suites need `pip install playwright`. They use `/usr/bin/chromium` when it exists and the installed Google Chrome otherwise. `PYTHONUTF8=1` matters on Windows.

## Ideas parked

- Contraption mode: tethers, bumpers, springs and bowling balls are already parts. A build/run toggle plus saving a layout would make Rube Goldberg machines of Buddy abuse possible.
