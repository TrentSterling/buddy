# Changelog

Behavior changes on the live line. Protocol stays 06 unless noted.

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
