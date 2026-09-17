# Buddy Bonk 0.6.0 — Toybox catalogue release

## Delivered build

- `index.html`: **369,898 bytes** (361.2 KiB).
- SHA-256: `238b69df264a80e952b7928603e4a010a89f3276830fb9cad167fb386d3b38f5`.
- Protocol **6**. Every participant must load this version.
- Single deployable HTML, including inline artwork, styles, sounds and embedded logo. Public discovery still dynamically imports pinned Trystero 0.25.4. No new asset files are required for gameplay.
- Canonical game address and Tront attribution/backlinks are retained.

## Completed automated verification: 282 passing assertions

| Suite | Passed |
|---|---:|
| Physics, new weapons, recycling, caps, cosmetics and codec | 106 / 106 |
| All 31 tools through browser mouse input | 69 / 69 |
| Mouse, touch and mallet input regression | 23 / 23 |
| Catalogue, previews, cleanup, export and responsive layouts | 30 / 30 |
| Four-client expanded toybox multiplayer | 23 / 23 |
| Four-client mallet timing, latency and disconnect regression | 31 / 31 |

No page JavaScript errors were reported in the completed suites. The physics suites include a 3,600-step existing-weapon soak and a 9,300-step mixed run cycling through all 31 tools, as well as individual controlled cases. These are assertions and finite-state checks, not a claim that every conceivable issue is eliminated.

The final artifact retains the tested cursor rules: no pointer lock/capture, system cursor by default, and cancellation when crossing onto UI. An optional game cursor is restricted to the actual playable room. Touch and mouse mallet regression, early-hit prevention, and added 80 ms receiver delay were exercised.

## What changed

### One catalogue instead of two menus

Weapons, Toys, Buddy, Your hand, and Room share one catalogue. Owned items and purchasable items live together. Selecting an item shows an actual game-rendered preview; only Equip/Wear/Use changes the game. The current-tool control opens the same catalogue with Owned only selected and one-click equipping. E opens/closes it. The shop opens all stock. Body/hat previews do not mutate shared state.

The catalogue contains six body looks, fourteen hat choices including No hat, six hand styles, and six room themes. Cosmetic purchases use the shared cash pool. Buddy and hat changes are shared; each player equips their own hand. The host controls the shared room theme. Changing the wallpaper never changes physics or gravity. Hats and outfits are no longer visible in settings.

The room themes are Workshop, Garage, Carnival, Padded room, Gym, and Moon lab. They share the playable bounds and hoop collision. They are presentation themes, not six new physics levels.

### Ten added weapons and toys, thirty-one in total

Revolver, SMG, burst rifle, double-barrel shotgun, minigun, grenade launcher, spear, shuriken, frying pan, and water pistol. Guns share a host-resolved magazine/cadence/reload system with different artwork and behavior. Burst fire completes its short burst after a valid tap. Minigun requires spin-up. Grenades use the existing capped physical bomb pool. The frying pan uses the corrected mallet wind-up/contact/recovery sequence. Water extinguishes burning Buddy, pushes small objects, and spot-cleans stains through compact wash cues.

Spears charge while held and throw on release. UI cancellation does not create a throw. A spear is one point-body whose tip is swept against targets; its long shaft is drawn locally. It can embed in Buddy, a prop, or the room, follow the attachment, and be grabbed by its shaft. This is a stylized one-node throwable, not a fully simulated rigid rod with segment collisions.

### Recycling and accessible cleanup

Two spears per player, eight room-wide. The third throw recycles that player's oldest unprotected spear. Loose basketballs, ducks, bowling balls and shuriken also recycle eligible oldest objects at their cap. Spawner-owned items are preferred before another player's unprotected clutter. Grabbed, tethered, balloon-connected or pending-tether objects are protected. Live bombs, balloon setups, bumpers, springs and ropes are not silently deleted to make a toy appear.

A visible Sweep button removes loose disposable toys, candy and stains, preserving held objects and contraptions. More exposes stain-only washing, cutting ropes and an 850 ms host-only hold to clear the entire room. That full clear retains money, workshop purchases and appearance. A quick click does not wipe the room.

### Budget and persistence

The original 88-node hard ceiling remains: 13 Buddy nodes plus up to 75 dynamic props, with eight positions in that ceiling reserved from ordinary clutter for transient weapons. Other maxima: 32 basketballs, 12 bombs, 16 balloons, 12 ducks, 8 bowling balls, 8 spears, 16 shuriken, 96 candy pickups, 16 rockets, 8 springs, 12 endpoint tethers, 8 static bumpers. Category limits and the shared ceiling both apply.

Cosmetics append five bytes of fixed snapshot metadata (theme + unsigned ownership mask) and one style byte per hand. Existing skin/hat fields are reused. No hat, glove, tracer, shell, water droplet, or blood-particle bodies are synchronized. The controlled saturated layout encoded to **3,557 bytes**, below the 6,144-byte snapshot ceiling. The adaptive recurring-state target remains **56 KiB/s per guest**; effects, controls and protocol/relay overhead are additional. This is not a total traffic guarantee.

Existing 21 tool indices, including railgun index 18, are preserved. Browser workshop save keys are retained. The current 31-tool mask uses the positive 31 bits of a JavaScript bitmask; further equipment expansion should revise that encoding rather than blindly adding bit 31.

## Browser gameplay and visual review

All 31 tools were equipped and used through actual browser mouse inputs, then released, with screenshots and finite-state checks. The new guns, thrown spear, shuriken, frying pan and water pistol were inspected in rendered gameplay. Desktop catalogue, hats, body/hand previews, all room thumbnails, cleanup, postcard export, and phone/landscape/4K layouts were visually reviewed. Responsive bounds were checked at 320×740, 390×844, 900×430 and 3840×2160, plus extra-large UI on a phone viewport. The postcard export was captured as an actual browser download and inspected.

The four-client test used isolated Chromium contexts with **real WebRTC data channels** through a loopback test-only TURN/TCP fixture. It covered catalogue purchases from a guest, preview isolation, distinct player hands, host-only themes, late joins, spear release and recycling, shared cleanup, simultaneous grabs, mixed gunfire, explicit and abrupt disconnect cleanup, and clustered explosion rendering. The fixture is not part of deployment. Deterministic setup/frozen-step sections and live-play sections are identified in the harness code.

## Explicit limits / incomplete environment checks

- Public Trystero/Nostr discovery and connections across real home/ISP networks were not verified in this environment.
- Direct `file://` and localhost top-level navigation are blocked by the managed Chromium environment. An additional Test 2P popup navigation attempt stopped at `net::ERR_BLOCKED_BY_ADMINISTRATOR`, before the game loaded. It is recorded separately in `popup.json`, not counted as a passing gameplay assertion. The generated invite/popup path therefore still needs a deployed-browser check.
- Tests use Chromium; Safari, Firefox and actual mobile hardware were not tested. Phone screenshots use emulated viewports/touch input.
- Workshop persistence was validated through its save/load functions. Storage behavior depends on the hosting origin and browser settings.

## Deployment

Replace the repository's published `index.html` with this file. Keep the existing `og-image.png` if the live page already uses it for social sharing; it is not a game dependency. All artwork needed to play is embedded. No npm build or source folder is needed on GitHub Pages. Invite links must be generated by the live host; everyone needs protocol 6.
