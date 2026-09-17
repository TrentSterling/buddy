# CLAUDE.md, Buddy Bonk

Read `BUDDY_BONK_CLAUDE_HANDOFF.md` first. It is the tribal knowledge from the ChatGPT-built line: product direction, UX rules, cursor rules, mallet contact rules, physics intent, network budgets, save keys, caps. Everything there still applies to this repo unless this file says otherwise.

## Two lineages, one live site

This repo is the LIVE line. It is what https://tront.xyz/buddy/ serves, deployed by GitHub Pages from `main` root.

| | Live line (this repo) | ChatGPT source package (handoff) |
|---|---|---|
| Base | ChatGPT v0.6 single `index.html` (commit `cbae609`) | `baseline.html` + `models.js`, `world.js`, `render.js`, `catalogue.js`, `catalogue.css`, `shop.html`, `ui_patch.py`, built by `build.py` |
| Tools | 23 | 31 (adds SMG, burst rifle, double-barrel, minigun, grenade launcher, shuriken, frying pan, water pistol) |
| Catalogue | shop dialog + tool drawer | unified five-department catalogue |
| Lobby | auto lobby, bare link = shared `LOBBY`, guests re-host when the host leaves | host leaves = room ends, no migration |
| Extras | welcome dialog, v0.7.0 physical mallet, hoop carry rule, input hardening, diagnostics trace | Python Playwright QA suites, `evidence/`, `VERIFICATION.md` |

The handoff's verified index SHA `238b69df...` matches no commit here. The source package itself was never delivered (only the .md reached Downloads on 2026-09-17). When it arrives, the job is a merge, not a swap: bring its content (tools, catalogue, themes, QA suites) onto this line, or port this line's lobby, welcome, mallet, hoop and input work into its build inputs. Either way, keep protocol compatibility in mind: this line is still Protocol 06 and the handoff's 31-bit tool ownership limit is real.

Until then: `index.html` IS the source. Edit it directly, keep it a single file, and back-port nothing (there is nothing to back-port into).

## Working rules on this repo

- One deployable `index.html`. No build step, no npm on Pages.
- Never em dashes in copy. Discord link is always `tront.xyz/discord/`.
- Version lives in three places: the fineprint, the credits footer, and `__buddy.version`. Bump all three. Minor bump for a new mechanic, patch for fixes.
- The file is CRLF in the working copy (`i/lf w/crlf`). Patch scripts must normalize or they silently fail to match.
- No pointer lock, no pointer capture, system cursor by default. Read handoff section 3.3 before touching the input layer, then run `tools/verify-swing.mjs` and the real-mouse flow.
- Host authority, absolute snapshots, compact events, local FX. Do not network particles.

## Verify before shipping

```
node tools/verify-lobby.mjs                       # two real Chromes, real Trystero, host death re-host
PW_DIR=<dir with playwright> node tools/verify-swing.mjs both [https://tront.xyz/buddy/]
```

`verify-swing` needs Playwright with its Firefox build (`npm i playwright && npx playwright install firefox` in any scratch dir, pass it as `PW_DIR`). Chrome runs through the installed Google Chrome (`channel: 'chrome'`). Deploy check: push, poll the live page for the new version string, rerun `verify-swing` against the live URL.

For animation or contact changes, look at consecutive frames of one action, not two unrelated screenshots (handoff section 4).

## Regression map for the mallet (v0.7.0)

The canned swing (wind-up, downswing, strike-face contact, hold, recoil, recovery) is untouched and still fires on a stationary click. The physical swing added in v0.7.0 reuses the same striking-face capsule (`malletHit`) at the rest pose, swept along the glove path each 120 Hz tick with sub-steps, so only the visible face can hit and damage happens on overlap. No radial area. Whiffs produce nothing. Hits are tick-stamped (`mallet:1, at`) so guests show them when their rendered mallet arrives. The per-node cooldown is 160 ms and jumps over 200 px in one tick are ignored as teleports.

## Open threads

- Daver 2.0 reported "can't aim anything on Firefox, right click just does grab" (2026-09-16). Not reproduced in Playwright Firefox in any configuration. Another Firefox (Zen) user reported controls fine. The D panel now logs the last six pointer decisions; ask for that if it comes up again.
- Add the game to the games page on tront.xyz.
- Both lobby players default to "Captain Grab"; random names wanted.
- Contraption mode (Daver's Rube Goldberg idea) is parked in the README.
