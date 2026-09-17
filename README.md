# Buddy Bonk

Multiplayer ragdoll sandbox by Tront. Grab a friend, grab a limb, make a mess.

Play: https://tront.xyz/buddy/

Single HTML file, no build step. Multiplayer is browser-to-browser over WebRTC via Trystero.

## Playing

- Left button uses the selected tool. Right button is always a quick grab, so you can drag Buddy or a prop no matter what you are holding.
- The mallet is physical: whip the cursor through Buddy or a prop and the hit comes from how fast you swung. A stationary click is a tap.
- Basketballs only score when they are actually shot. A ball still in a glove, or released a blink before the rim, is being carried.
- Press D for the diagnostics panel. Its last lines log recent pointer decisions (press, refused and why, release), which is what to paste into a bug report if clicks are not landing in your browser.

## Verifying

`tools/verify-lobby.mjs` drives two real Chromes through the public lobby (host, late guest, host death). `tools/verify-swing.mjs` runs the mallet swing and the hoop carry rule in Chrome and Firefox via Playwright; point it at the live URL to check a deploy.

## Ideas parked

- Contraption mode: tethers, bumpers, springs and bowling balls are already parts. A build/run toggle plus saving a layout would make Rube Goldberg machines of Buddy abuse possible.
