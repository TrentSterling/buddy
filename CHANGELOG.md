# Changelog

Behavior changes on the live line. Protocol stays 06 unless noted.

## v0.8.1, 2026-09-17

- Public discovery pins six measured relays (nos.lol, relay.primal.net, bucket.coracle.social, nostr.mom, nostr-relay.corb.net, nostr.sathoarder.com) instead of three hash-picked ones. Probe over forty relays, then an in-game run with relay warnings on; damus rate-limited and purplerelay was out of disk, so both were dropped. Six open instead of one, lobby pairs in about two seconds.
- Diagnostics panel lists every relay with its socket state.
- First visit draws a hand name from a pool of twenty-four and saves it, so a room is no longer four Captain Grabs. Settings still lets you rename.
- `tools/probe-relays.mjs` checked in for the next relay audit.

## v0.8.0, 2026-09-17

- Merged the ChatGPT catalogue package onto the live line. 31 tools (adds SMG, burst rifle, double-barrel shotgun, minigun, grenade launcher, shuriken, frying pan, water pistol), the Toybox catalogue with Weapons, Toys, Buddy, Your hand and Room departments, six Buddy bodies, fourteen hats, six hand styles, six room themes, Sweep and More cleanup, shared gun magazine and reload logic, spears that embed, water that extinguishes and washes.
- Everything from the live line survives: auto lobby with re-host, welcome dialog, physical mallet swing (now also the frying pan), hoop carry rule, input hardening, diagnostics pointer trace.
- Protocol 07. The package changed the wire format (hand style, theme, looks) without bumping, so v0.8 rooms are isolated from stale v0.7 tabs via the Trystero room id. The Trystero appId stays on v4 because a renamed appId picked dead relays.
- Package QA suites checked in under `qa/` with `evidence/`, made to run on Windows against the installed Chrome. Unit expectation updated to protocol 7.
- Fixed a catalogue crash from the merge: thumbnail preview renderers skip the main constructor, so the swing state is allocated lazily.

## v0.7.1, 2026-09-17

- Physical mallet hits are tick-stamped like the canned swing, so guests show the impact when their rendered mallet reaches Buddy rather than a network beat early.
- Meta, OpenGraph and about copy say 23 tools (was 21).
- Handoff notes, CLAUDE.md and this changelog added to the repo.

## v0.7.0, 2026-09-17

- Mallet is physical. The idle mallet rides the glove; whipping the cursor through Buddy or a prop hits with force from the smoothed glove velocity (swept striking face, per-node 160 ms cooldown, teleport guard). A stationary click still performs the canned tap swing. Idle mallet leans against motion and streaks when fast.
- Basketballs no longer score while held or within a quarter second of release. Ends the carry-through-the-rim money loop.
- Input hardening after a Firefox report: a fresh primary press with no other button held clears stale wait-for-release and active-pointer latches; missed-mouse-up recovery needs three consecutive moves without the button; canvas events trust the browser's own hit-test over elementFromPoint.
- Diagnostics panel (D) logs the last six pointer decisions; also on `__buddy.pointer.trace`.
- `tools/verify-swing.mjs`: Playwright harness for the swing and hoop rules in Chrome and Firefox, local or live.

## v0.6.0 (live line), 2026-09-16

- Auto lobby: a bare link lands everyone in one shared room; first arrival hosts; guests re-host when the host leaves.
- First-run welcome dialog, new about UX, empty clicks no longer collapse Buddy, bandaid moved to forehead.
- OG image and copy rewrite, versioned og:image URL for Discord.
- Initial Pages deploy of the ChatGPT-built v0.6 single-file game.
