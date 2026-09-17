# CLAUDE.md, Buddy Bonk

Read `BUDDY_BONK_CLAUDE_HANDOFF.md` first. It is the tribal knowledge from the ChatGPT-built line: product direction, UX rules, cursor rules, mallet contact rules, physics intent, network budgets, save keys, caps. Everything there still applies unless this file says otherwise.

## Lineage (resolved 2026-09-17)

`source/baseline.html` is the raw v0.5 base. ChatGPT built two siblings from it:

1. **ui-polished v06** (23 tools, old shop panels). This is what first went live (commit `cbae609`). Claude added the auto lobby, the welcome dialog and the v0.7 mallet, hoop and input work on top of it.
2. **the catalogue package** (31 tools, Toybox catalogue, Sweep, themes, hand styles, Python QA). Delivered as `source/` plus its built `index.html` (SHA `238b69df...`).

**v0.8.0 is the merge:** the catalogue build with the live line's changes re-applied (auto lobby, welcome, physical mallet, hoop rule, input hardening, diagnostics trace). Protocol bumped to 7 because the package changed the wire format (10-field hand tuple with style, theme and looks in snapshots) under the same protocol number.

Consequences:

- `index.html` is the source of truth now. `source/build.py` reproduces the pre-merge v0.6 catalogue artifact (byte-identical modulo CRLF; needs `PYTHONUTF8=1` and the regenerated `source/baseline.js`), but it does not know about anything the live line added. Do not run it and copy its output over `index.html`. If a future ChatGPT drop arrives as a package, diff it against `source/` to see what changed, then port the delta by hand.
- The handoff says "host leaves ends the room, no migration". That is superseded: the live line has the auto lobby (bare link = shared `LOBBY`, guests re-host when the host leaves). Keep it.

## Working rules

- One deployable `index.html`. No build step on Pages. No em dashes in copy. Discord link is always `tront.xyz/discord/`.
- Version lives in the fineprint, the credits footer, `__buddy.version` and the JSON-LD `softwareVersion`. Bump all four.
- Working copy is CRLF (`i/lf w/crlf`). Patch scripts must normalize or they silently fail to match.
- No pointer lock, no pointer capture. Read handoff section 3.3 before touching the input layer, then run `tools/verify-swing.mjs` and `qa/mallet_ui.py`.
- Host authority, absolute snapshots, compact events, local FX. Do not network particles.
- Tool ownership is a 31-bit mask and all 31 bits are used. Redesign the encoding before adding tool 32.

## Discovery gotcha (cost a day once)

Trystero seeds its relay subset from the `appId`. Renaming the appId to `prototype.v7` picked three dead relays and discovery never opened ("Discovery waiting for a public relay"). Keep `xyz.tront.buddybay.prototype.v4`; protocol isolation rides on the Trystero room id (`room + '#p' + BB.VERSION`) and the BroadcastChannel name. v0.8.1 pins six measured relays via `relayConfig.urls` (see `PUBLIC_RELAYS`), which sidesteps the hash draw entirely. Re-audit with `node tools/probe-relays.mjs <list>` and then an in-game run with `warnOnRelayFailure:true` if discovery ever degrades; a relay can answer subscribes and still reject publishes (damus rate-limits, purplerelay ran out of disk).

## Verify before shipping

The Python suites (see README) plus `node tools/verify-lobby.mjs` and `PW_DIR=... node tools/verify-swing.mjs both`. Deploy check: push, poll the live page for the new version string, rerun `verify-swing` and `verify-lobby` against the live URL.

For animation or contact changes, look at consecutive frames of one action (handoff section 4).

## Mallet regression map

The canned swing (wind-up, downswing, strike-face contact, hold, recoil, recovery) is untouched and fires on a stationary click for both mallet and frying pan. The physical swing reuses the same striking-face capsule at the rest pose, swept along the glove path each 120 Hz tick with sub-steps, so only the visible face can hit and damage happens on overlap. Whiffs produce nothing. Hits are tick-stamped so guests show them when their rendered mallet arrives. Per-node cooldown 160 ms; jumps over 200 px in one tick are teleports and ignored. Catalogue thumbnails draw the mallet through a preview renderer that skips the main constructor, so per-renderer state must be allocated lazily.

## Open threads

- Daver 2.0's "can't aim on Firefox, right click just does grab" (2026-09-16) never reproduced in Playwright Firefox. Another Firefox user reported it fine. The D panel logs the last six pointer decisions; ask for that.
- Contraption mode (Daver's Rube Goldberg idea) is parked in the README.
