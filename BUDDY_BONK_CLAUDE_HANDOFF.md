# BUDDY BONK — CLAUDE HANDOFF / TRIBAL KNOWLEDGE

**Project owner:** Trent Sterling / **Tront**  
**Game:** **BUDDY BONK**  
**Tagline:** **Good friends. Terrible ideas.**  
**Canonical deployment target:** `https://tront.xyz/buddy/`  
**Current release:** **v0.6.0 / protocol 6**  
**Current deploy artifact:** `index.html`  
**Current verified index SHA-256:** `238b69df264a80e952b7928603e4a010a89f3276830fb9cad167fb386d3b38f5`

---

## 0. Read this before touching anything

You are inheriting a browser multiplayer physics toy that was developed through many iterative gameplay + visual QA passes. The source may look hacky in places because the priority has consistently been **feel, multiplayer correctness, low deployment friction, and actual browser verification**, not architectural purity.

Do **not** begin by rewriting the entire project because you dislike the patch/build pipeline. Get the current build running, run the tests, inspect the evidence screenshots, understand the authority model, and only then refactor incrementally.

The lost visual-reference video is **not available to you**. Do not invent a new look trying to reconstruct it. The current game, current inline art, and the `evidence/` screenshots are the new visual ground truth.

The owner likes aggressive iteration and is happy to add lots of toys/weapons/cosmetics, but does **not** want those additions to explode bandwidth or turn the screen into an admin dashboard.

---

# 1. What Buddy Bonk is

Buddy Bonk is basically the social/multiplayer fantasy of **Interactive Buddy**:

- one indestructible cartoon ragdoll Buddy
- up to **4 player hands** sharing the same room
- grab / pull / throw / shoot / burn / freeze / tether / bounce / launch Buddy
- physical props and stupid contraptions
- candy + shared cash rewards
- use cash to unlock more toys, weapons, cosmetics and upgrades
- optional sandbox mode opens everything
- no forced round structure; the sandbox itself is the main attraction

The emotional target is:

> “Join the room. Grab a limb. What stupid thing are we about to do to this guy?”

The multiplayer should create emergent comedy: one player holds Buddy while another uses a weapon; two people pull opposite limbs; someone ruins a setup with a rocket; another person becomes Buddy’s self-appointed protector.

Do not turn this into a menu-driven progression game at the expense of the shared physics toy.

---

# 2. Branding / credits / deployment

This is a **Tront** game.

Use these identities consistently:

- **Display brand:** Tront
- **Full credit:** Trent Sterling (Tront)
- Main hub: `https://tront.xyz/`
- Games: `https://tront.xyz/games/`
- Blog: `https://tront.xyz/blog/`
- Discord: `https://tront.xyz/discord/`
- GitHub: `https://github.com/TrentSterling`
- Game URL: `https://tront.xyz/buddy/`

The existing credits/backlinks are intentional. Preserve them.

The game is inspired by **Interactive Buddy** by Shock-Value, but this is an independent multiplayer sandbox, not an official sequel. Preserve that wording/credit rather than pretending there is an official relationship.

Deployment requirement is intentionally stupid-simple:

- GitHub Pages/static hosting
- **one deployable `index.html`** for gameplay
- artwork, CSS, JS, logo and synthesized audio are inline
- Trystero is dynamically imported for public peer discovery
- `og-image.png` may exist on the live site for social sharing, but it is **not** a gameplay dependency
- no npm build required on Pages
- no paid game server required for the intended architecture

---

# 3. UX rules — these are NON-NEGOTIABLE

The UI went through several painful iterations. Do not regress it.

## 3.1 The game must own the screen

Trent strongly dislikes “AI slop dashboard UI”: giant cards, tiny text, icon-only mystery controls, always-visible stats, and a ton of UI covering the playfield.

During normal play, keep the interface sparse and obvious.

Current intended permanent-ish controls are basically:

- current tool / catalogue entry
- shared cash / Shop
- Repair
- Sweep
- More cleanup
- Hide
- sparse header with logo / player count / Invite / Menu

Everything else should be contextual/on-demand.

## 3.2 Text must be readable at normal monitor distance

Do not optimize a 1440p screenshot by making every label 8px tall.

The current UI uses CSS/rem typography independent of the Canvas world scale. Keep that principle.

The owner has explicitly complained about tiny UI text before. If a control needs a hover tooltip to understand what it does, ask whether the label itself can simply be visible.

## 3.3 Cursor behavior is sacred

This has regressed before and annoyed the hell out of the owner.

Current expected rules:

- **NO pointer lock**
- **NO pointer capture trapping the mouse in the game box**
- system/native cursor is the default
- optional “game hand” cursor may hide the native cursor **only while genuinely inside the playable room**
- hovering **any UI element** restores normal cursor behavior
- leaving the playable room cancels/releases the current gesture/tool
- crossing from gameplay onto UI must not keep firing/grabbing
- returning while still holding the mouse should not magically restart a gesture
- Escape / window blur / pointer cancellation must cleanly release input

Do not “simplify” this input layer without rerunning its regressions.

## 3.4 One catalogue for fun content

Hats used to be hidden in Settings. That was judged wrong.

The current concept is one toy-catalogue UI with these top-level departments:

- **Weapons**
- **Toys**
- **Buddy**
- **Your hand**
- **Room**

Buddy contains body looks + hats. Player hand cosmetics live under Your hand. Room themes live under Room.

Owned items and purchasable items coexist in the same catalogue.

Selection should **preview first**, and only **Equip / Wear / Use** should mutate shared state.

The current-tool button / **E** opens the **same catalogue** filtered for owned gear / fast switching. Do not create a second unrelated tool UI again.

Settings should contain actual settings (sound, blood, motion, cursor, UI scale), not hats or weapons.

## 3.5 Cleanup must be easy

A visible **Sweep** button belongs beside Repair.

Normal Sweep:

- removes loose disposable clutter
- clears candy/stains as designed
- preserves held objects
- preserves contraptions / deliberate setups

More cleanup options expose:

- stain-only cleaning
- rope cutting
- deliberate full-room clear

Full-room clear is host-only and requires an intentional hold (~850 ms), because a single accidental click must not destroy everybody’s contraption.

Cleanup must preserve money, unlocks and appearance.

---

# 4. Current art direction

The current visual style is the result of multiple polish passes. With the old video unavailable, **the current rendered game is the reference**.

General look:

- 2D Canvas cartoon test chamber / toy lab
- clean, chunky line art
- flat graphic colors, restrained shading
- industrial workshop backdrop in muted teal/steel tones
- warm yellow/orange/red toy accents
- thick readable silhouettes
- no photorealism
- no glossy generic “AI app” card design
- props should look like illustrated toys, not SVG placeholders attached to a cursor

Buddy currently has deliberate visual work:

- readable ragdoll silhouette
- tapered cloth limbs instead of uniform sticks
- mittens with thumb shapes
- actual sneaker-like feet
- torso artwork rotates with the physical torso
- stronger grounding/contact shadows
- expressive face / eyes track nearby action
- panic / hurt / dazed / burn / frozen presentation
- bruises, cuts, scorch, stuck darts and blood/stain feedback
- hats / body variants

Effects should have distinct shape language:

- electricity = sharp / jagged
- flame = rolling / licking shapes
- ice = chunky/crystalline
- blood = directional splashes + wall/floor marks
- candy = toy-like reward burst
- explosions can be big visually, but cosmetic particles are local and capped

Do not make all effects the same generic confetti system.

### Important visual QA rule

For animation/contact work, inspect **sequential frames of the same action**, not two unrelated screenshots.

The mallet bug was only obvious once we looked frame-by-frame.

---

# 5. The mallet / frying-pan lesson — do not regress this

The mallet used to be “almost right” but actually did this:

1. damage/impact happened early
2. the visible mallet continued into its contact frame afterward
3. Buddy could get concussion stars even when the mallet did not hit him
4. the hit used an oversized invisible radial area

That was specifically red-teamed and fixed.

Correct sequence now:

**wind-up → accelerating downswing → physical strike-face contact → tiny impact hold → recoil → recovery**

Rules:

- only the visible striking face/capsule can hit
- damage happens on actual contact
- a miss gets follow-through but **NO hit FX, NO stars, NO daze**
- guest-visible injury must not appear before the rendered strike reaches contact
- touch taps still complete a valid swing
- crossing onto UI / Escape / disconnect cancels unresolved attacks cleanly

The frying pan intentionally reuses this tested temporal-contact machinery.

If you change melee animation, rerun both mallet UI and mallet network tests.

---

# 6. Physics philosophy

The Buddy is a custom 2D point-mass ragdoll, not Box2D.

Key design intent:

- he should **tumble like a connected body**
- he should not compress into a loose pile of independent circles when he falls
- bend limits and self-collision preserve a readable human-ish silhouette
- body art must deform/rotate with the physical rig rather than staying screen-aligned
- floor friction should not make him collapse in place instantly
- impacts should carry momentum through the whole body

Buddy uses **13 body points**.

The host steps the world at **120 Hz fixed-step physics**.

### Springs

A previous spring implementation kicked one foot/point, so the ragdoll absorbed most of the impulse internally.

The corrected design applies a coordinated **whole-body COM launch + optional rotational kick** when Buddy hits a spring.

Balls/props still bounce independently.

Do not revert to “kick one leg.”

### Bumpers

There was also a bug where bumper impulse was applied before velocity reconstruction and the solver effectively erased it.

Bumper response must be applied in a part of the step where the impulse survives the solver/velocity reconstruction.

### Tethers

Tethers are **endpoint constraints**, not rope chains.

Do not add twenty replicated rope segment rigidbodies just to make the line wiggle.

Draw rope presentation locally; synchronize the meaningful endpoints/constraint state.

### Spears

Spears are intentionally cheap:

- one point-body per spear
- shaft is drawn locally
- swept tip collision
- can stick into Buddy / props / room
- follows attachment after embedding
- can be grabbed along the rendered shaft
- not a fully simulated multi-segment rod

This is deliberate multiplayer/perf design, not an unfinished implementation.

---

# 7. Blood / damage / personality

This game is about abusing a cartoon test dummy. It is **not** supposed to be bloodless and polite.

Desired tone:

- cartoon violence / cruelty-comedy
- blood and lasting visible damage are part of the feedback
- not an anatomy/gore simulator

Current blood modes are a **local preference**:

- Off
- Classic (default)
- Extra

Important network rule:

**Do not synchronize every blood particle.**

The host resolves the authoritative hit and sends compact hit/damage cues. Each client expands those into local cosmetic droplets/splats using seeded/local rendering.

Persistent stains have a bounded state/history. Repair and cleanup are separate actions:

- Repair Buddy = reset injuries / state / stand him up
- Wash/Sweep = clean environment according to action

Buddy personality matters. Between hits he should feel like a character, not only a physics mesh:

- eyes follow nearby hands / threats
- panic around dangerous active tools
- hurt/dazed expressions
- recovery moments
- hats and outfits amplify comedy

More personality is generally a good future direction, as long as authoritative behavior changes remain host-controlled.

---

# 8. Gameplay / economy

Core loop:

**mess with Buddy → earn candy/cash → unlock more ridiculous stuff → combine it with friends**

The shared room cash pool makes purchases available to the group.

Reward philosophy:

- reward meaningful impacts / varied tools / combos / teamwork
- do not make “hold fastest DPS tool against torso forever” the obviously optimal progression strategy
- multi-player contributions and mixed-tool chains are good

Sandbox mode exists specifically so the owner/testers can open everything immediately.

Optional stunt/challenge systems are secondary. Do not let them turn the game into a mission UI.

---

# 9. Current content inventory

Current release has **31 equipment/tool definitions**.

The original tool indices are intentionally preserved for save compatibility.

Original family includes:

- Grab
- Mallet
- Blaster
- Bomb
- Rocket
- Tesla
- Magnet
- Basketball
- Balloon
- Spring
- Shotgun
- Chainsaw
- Flamethrower
- Cryo
- Darts
- Air cannon
- Rubber duck
- Bowling ball
- Railgun
- Tether gun
- Bumper

Current added family:

- Revolver
- SMG
- Burst rifle
- Double-barrel shotgun
- Minigun
- Grenade launcher
- Spear
- Shuriken
- Frying pan
- Water pistol

Content definitions are primarily data-driven through `models.js`, shared gun machinery, melee machinery, and throwable machinery. New content should preferentially reuse those systems rather than adding bespoke network protocols per weapon.

Current cosmetic catalogue:

- **6 Buddy body looks**
- **14 hat choices including No hat**
- **6 player-hand styles**
- **6 room presentation themes**

Room themes currently share the same physical room bounds / hoop collisions. They are visual themes, **not six separate levels**.

---

# 10. Multiplayer architecture

This is the most important technical tribal knowledge.

## Authority

**One browser is the authority/host.**

Only the host steps `BuddyWorld` physics.

Guests do not run competing authoritative ragdoll simulations.

Guests send:

- pointer/hand position and button state
- selected tool/input intent
- explicit commands/purchases/look changes

Host resolves:

- Buddy physics
- prop physics
- grabs / simultaneous constraints
- weapon hits
- damage
- cash / purchases
- shared Buddy appearance
- room theme
- spawned gameplay objects
- cleanup/recycling

Host distributes absolute snapshots + compact events.

## Why multiple grabs work

Do **not** transfer limb ownership between clients.

If two people grab Buddy at once, the host has two grab constraints in one physics world. That is the whole reason tug-of-war works without authority fights.

## Transport

Public transport/discovery is built around **Trystero 0.25.4 + WebRTC**, with Nostr-based/public discovery behavior provided by Trystero.

There are also:

- same-origin BroadcastChannel paths used for signaling/local test flows
- manual direct offer/answer connection codes
- a test-only loopback TURN/TCP fixture in QA

No dedicated authoritative game server is deployed.

**Important:** P2P does not mean “absolutely zero outside networking infrastructure.” Discovery exists, and some real networks may require TURN relay behavior.

## Session semantics

- max **4 players/hands** today
- host leaves → session ends
- no host migration
- late joiners receive current snapshot/state
- guest disconnect must release grips/leases cleanly
- background/hidden host behavior matters; UI tells users to keep host visible

## Snapshot model

- host physics: 120 Hz
- target snapshots: ~30 Hz, adaptively reduced under state pressure
- snapshots are **absolute binary snapshots**, not fragile delta chains
- current snapshot hard max: **6,144 bytes**
- measured saturated test snapshot: **3,557 bytes**
- adaptive recurring state budget target: roughly **56 KiB/s per guest**
- that budget does not include every control/event/WebRTC/relay overhead byte

Local-only visual FX are intentionally not represented as replicated bodies.

---

# 11. Network/performance rules

When adding spectacle, default to:

**authoritative event → compact cue → local visual expansion**

Good local-only candidates:

- blood droplets
- sparks
- shell casings
- muzzle flashes/tracers
- flame particles
- ice shards
- smoke
- confetti
- screen shake
- rope wiggle
- hat wobble
- water droplets

Do **not** synchronize particle transforms every frame.

Do not make every cosmetic object a physics body.

If something affects gameplay, host owns it. If it only sells the hit, render it locally.

---

# 12. Caps, recycling and clutter management

There is a hard shared gameplay-body budget. Respect it.

Current design budget:

- **88 total point-body nodes** hard ceiling
- 13 are Buddy
- up to ~75 dynamic prop nodes
- some budget is intentionally reserved so transient weapons still work in a cluttered room

Category limits currently documented/tested:

- 32 basketballs
- 12 bombs
- 16 balloons
- 12 ducks
- 8 bowling balls
- 8 spears room-wide
- 16 shuriken
- 96 candy pickups
- 16 rockets
- 8 springs
- 12 endpoint tethers
- 8 static bumpers

Recycling philosophy:

- disposable loose clutter can recycle oldest eligible item
- prefer recycling the spawning player’s own old clutter before stealing another player’s
- **protected objects must not silently disappear**

Protected means examples like:

- actively grabbed
- tethered
- balloon-connected
- part of a pending tether operation

Live explosives / meaningful constructions should not silently vanish just because a player hit spawn again.

### Spear-specific rule

- 2 spears per player
- 8 total
- throwing another spear recycles that player’s oldest **unprotected** spear

This “automatic recycling rather than forcing cleanup chores” is intentional.

---

# 13. Persistence / compatibility landmines

Do not casually break these.

## Tool indices

The first 21 tool indices are preserved from the older release.

The current tool ownership encoding uses the positive **31 bits of a JS bitmask**.

**DO NOT BLINDLY ADD TOOL #32 USING THE SAME `1 << index` SCHEME.**

Before adding more equipment beyond the current 31 definitions, redesign/migrate the equipment ownership encoding (e.g. multiple words / BigInt / explicit array) while preserving old saves.

## Save keys

Historical localStorage keys intentionally still include old internal “buddybay” names, for compatibility. Examples in current build include:

- `buddybay-workshop-v3`
- `buddybay-name`
- `buddybay-blood`
- `buddybay-motion`
- `buddybay-sound`
- `buddybonk-hand`
- `buddybonk-cursor`
- `buddybonk-ui-scale`

Do not rename those keys just because the game is now called Buddy Bonk unless you deliberately migrate their values.

Likewise, internal discovery IDs still carry historical `buddybay` naming. Cosmetic cleanup of internal names is lower priority than not breaking sessions/saves.

## Protocol version

Current protocol is **6**.

If packet layout / tool encoding / interpretation becomes incompatible, bump the protocol and require everyone to reload the same version.

Do not silently allow two incompatible versions into one room.

---

# 14. Source layout — use this, not only the generated HTML

The source package deliberately generates the final single-file `index.html`.

### `baseline.html`

The large stable base monolith. Contains the existing solver, networking, app loop, legacy tool logic, audio, base input and base renderer.

### `models.js`

Data/content layer for the catalogue-era additions:

- new tool definitions
- Buddy skins
- hats
- hand styles
- room themes
- cosmetic ownership masks
- gun configs
- tool classification sets (`TOY_SET`, `MELEE`, `ONE_SHOT`)

### `world.js`

Authoritative gameplay extensions:

- protected-object checks
- oldest-item recycling
- Sweep
- cosmetic purchase/equip commands
- shared gun firing/reload/burst system
- spear/shuriken logic
- attachment syncing
- water-pistol behavior

### `render.js`

Visual extensions:

- expanded hat rendering
- body/face cosmetic treatment
- hand style drawing
- room theme art
- new prop/tool art
- new weapon cursors/effects
- local cosmetic event expansion

### `catalogue.js`

Unified shop/catalogue state and behavior:

- category selection
- owned filtering / fast mode
- preview vs apply semantics
- purchase/equip actions
- rendered item thumbnails and preview panels

### `catalogue.css`

The current non-dashboard catalogue look and responsive/mobile behavior.

### `shop.html`

Catalogue dialog markup inserted at build time.

### `ui_patch.py`

Build-time integration/wiring. It replaces legacy shop UI, hides old landfill-style menu actions, exposes Sweep/More, rewires settings/customization, and injects catalogue logic into the app.

### `build.py`

Build pipeline. It starts from `baseline.html`, applies targeted source patches/modules, and writes the final single-file `index.html`.

The builder is string-surgery-heavy and therefore fragile. That is known.

**Preferred workflow:** edit modular source + build + run tests. Do not hand-edit generated `index.html` and forget to back-port the change into the build inputs.

If you want to replace this builder with something cleaner, first prove output parity and keep the QA suite green. Trent cares far more about behavior than elegance of the build script.

---

# 15. QA harness — USE IT

The owner expects actual testing and visual inspection, not “looks correct by reading the code.”

Current QA uses Python Playwright + `/usr/bin/chromium`.

Important suites:

- `qa/units.py` — physics/content/caps/codec assertions
- `qa/gameplay_review.py` — all tools via browser input + gameplay captures
- `qa/catalogue_ui.py` — catalogue, preview isolation, cleanup, postcard, responsive sizes
- `qa/network.py` — four-client expanded multiplayer over real WebRTC data channels
- `qa/mallet_ui.py` — mallet/contact/input regressions
- `qa/mallet_network.py` — mallet timing/latency/disconnect multiplayer regressions
- `qa/visual.py` — visual layout checks/captures
- `qa/final_capture.py` — release evidence capture
- `qa/popup.py` — Test 2P popup attempt (environment limitation below)
- `qa/local_turn.py` — **test-only** loopback TURN/TCP fixture

Typical start:

```bash
python build.py
python qa/units.py
python qa/gameplay_review.py
python qa/catalogue_ui.py
python qa/mallet_ui.py
python qa/network.py
python qa/mallet_network.py
python qa/visual.py
```

Do not blindly delete/replace the harness because it looks elaborate. It caught real gameplay bugs:

- mallet damage before visible contact
- stars/daze on mallet misses
- disconnected-player ghosts
- stale held input after reset
- host heartbeat/pause issues
- backboard collision trapping the larger head
- touch-up cancelling the mallet swing
- bumper force being erased by solver timing
- cursor/menu race conditions
- preview UI mutating shared state

### Last recorded test state

The v0.6 release reported **282 passing assertions** across physics, 31 tools, input, catalogue, cleanup/export/responsive layouts, four-client multiplayer and mallet-network regressions.

Do not treat “282 passed once” as a magic certificate forever. Rerun after changes.

---

# 16. Visual QA evidence you inherit instead of the lost video

Look in `evidence/` before changing the art direction.

Particularly useful current references include:

- `toybox-hats-final.png`
- `toybox-rooms-final.png`
- `weapons-contact-sheet.png`
- `catalogue-weapons.png`
- `catalogue-hats.png`
- `catalogue-bodies.png`
- `catalogue-hands.png`
- `catalogue-rooms.png`
- `gameplay-moon.png`
- `multiplayer-guns.png`
- `mobile-game.png`
- `mobile-catalogue.png`
- `small-phone-catalogue.png`
- `4k-catalogue.png`
- `mallet-desktop.png`
- `mallet-mobile.png`

Use real rendered frames as the bar. Do not replace the current custom illustrated UI with a generic dark SaaS theme.

---

# 17. What was verified vs what is still unknown

Be precise here.

Verified in the QA environment:

- browser startup / no JS errors in passing suites
- all 31 tools exercised through browser mouse input
- physics/caps/recycling
- cosmetic/shop behavior
- preview isolation
- cleanup behavior
- responsive 320×740, 390×844, 900×430, 3840×2160 layouts
- touch emulation
- four isolated Chromium clients
- **real WebRTC data channels** through a local test-only TURN/TCP fixture
- guest purchases
- guest weapon actions
- late-join state
- simultaneous grabs
- spear recycling
- disconnect cleanup
- explosion pool caps
- mallet timing including added receiver delay

Not verified in the managed environment:

- public Trystero/Nostr discovery between real internet users
- real cross-ISP / home-network connectivity
- deployed `Test 2P` popup flow (managed browser blocked local/file navigation before game load)
- Safari
- Firefox
- physical mobile hardware

Do **not** claim those are tested when they are not.

First real-world release task after deployment: test Invite with two actual networks and inspect diagnostics on both ends.

---

# 18. Networking traps to avoid

1. **Do not make each client simulate Buddy independently.** Host authority is deliberate.
2. **Do not split ownership per limb.** Multiple host-side grab constraints are deliberate.
3. **Do not network every particle, casing, droplet or hat wobble.**
4. **Do not add physics rope segment chains for tethers.**
5. **Do not remove caps just because a local machine handles it.** Four peers + snapshots are the actual budget.
6. **Do not turn snapshots into a fragile delta chain** without a very good reason. Absolute state is resilient to loss/reordering.
7. **Do not call the test TURN server part of production.** It exists only to make multi-context WebRTC deterministic in QA.
8. **Do not build host migration before the game needs it.** Current design intentionally ends the room when host leaves.

---

# 19. UI/art traps to avoid

1. Do not hide normal gameplay text at microscopic sizes.
2. Do not add icon-only controls that require memorization/hovering.
3. Do not cover the playfield with stats panels.
4. Do not bury obvious game content (hats, skins, rooms, weapons) in Settings.
5. Do not return to generic card-grid / dashboard aesthetics.
6. Do not globally hide the mouse.
7. Do not reintroduce pointer capture/lock for ordinary tool use.
8. Do not make opening/closing UI accidentally fire tools underneath it.
9. Do not make previews mutate live multiplayer state.
10. Do not use a screenshot/mockup as proof of animation timing—inspect consecutive frames.

---

# 20. Known small cleanup / TODOs in current release

These are not emergency blockers, but they are real:

- The generated `index.html` structured-data description correctly says **31 tools**, but at least the normal meta description and OpenGraph description still say **21 tools**. Update those to 31 when touching metadata.
- Public matchmaking needs a real deployed/cross-network test.
- Test 2P popup path needs a normal deployed browser check.
- Browser matrix beyond Chromium remains untested.
- Current 31-tool ownership bitmask is at its practical limit. Fix encoding **before** adding tool #32.
- The build system works but relies on string patching. Refactor only with test parity.

---

# 21. Good future directions

The owner considers the game already good and wants **more polish + more toys**, not a genre pivot.

Good expansion areas:

### More weapon variants

It is okay if some guns reuse mechanics. Distinct rhythm, artwork, recoil and sound are enough to make variants fun.

Potential examples:

- alternate pistols
- rifles
- goofy sci-fi guns
- more melee objects
- launcher variants
- sticky/attachment toys

But remember the 31-bit ownership problem first.

### More cosmetics

- body looks
- hats
- player hand/glove styles
- room themes

Keep cosmetics obvious inside the catalogue.

### More Buddy personality

- anticipatory looks at dangerous tools
- recovery animations that respect actual ragdoll pose
- gentle interactions
- annoyed reactions to specific players

Prefer presentation driven from existing state. Host-own anything that changes gameplay.

### Interactive room features

Good candidates are things that make existing toys combine in new ways, e.g. pinball-style room devices, conveyors, targets, etc. Avoid turning the room into a second full game before the sandbox is polished.

---

# 22. Product-owner working style

Trent is an experienced game/network programmer. Do not over-explain basic concepts to him.

What he responds well to:

- make the thing
- show actual results
- inspect the visual output
- test the behavior
- call out real limitations
- keep the implementation pragmatic
- preserve performance/network budgets
- use checklists for substantial changes

What frustrates him:

- claiming tests were done when they were not
- syntax-only checking presented as gameplay QA
- inaccessible/internal file paths instead of actual deliverables
- generic “AI template” UI
- adding UI instead of improving the game
- asking him to make obvious low-level design choices when you can use good judgment
- losing previous fixes while adding a feature

When you change a physical interaction, playtest/inspect it in motion. When you change multiplayer behavior, run at least two real clients; four for meaningful shared-state changes.

---

# 23. First thing Claude should do

1. Read `README.md` and `VERIFICATION.md`.
2. Run `python build.py` once and confirm the generated `index.html` is stable.
3. Run the non-popup QA suites before changing anything.
4. Open/inspect the evidence screenshots.
5. Understand `models.js`, `world.js`, `render.js`, `catalogue.js`, `catalogue.css`, `ui_patch.py`.
6. Keep a changelog of behavior you touch.
7. After each meaningful pass, rebuild and rerun the relevant regression suite—not only syntax checking.
8. When handing Trent a build, attach a real clickable `index.html`, not an internal path.

---

# 24. One-paragraph project summary for context windows

**Buddy Bonk is a single-page, browser-hosted multiplayer Interactive-Buddy-style ragdoll sandbox by Tront. One player's browser is the host-authoritative 120 Hz physics simulation; up to four WebRTC peers send hand/tool intent and receive compact absolute binary snapshots plus event cues. The current v0.6/protocol-6 build has 31 tools, shared cash/unlocks, six Buddy bodies, fourteen hats, six per-player hand styles, six room themes, blood/damage/cosmetic FX, bounded/recycling props, endpoint tethers, springs/bumpers, and a unified illustrated toy catalogue. The game must remain deployable as one `index.html` to GitHub Pages at tront.xyz/buddy, keep normal-play UI sparse/readable, never pointer-lock/capture the mouse, preserve host authority and network caps, expand cosmetic spectacle locally rather than synchronizing particles, and retain the corrected mallet/contact timing and ragdoll readability.**

---

# 25. Final instruction

Continue from the current build. Improve it aggressively, but treat the existing multiplayer correctness, cursor behavior, melee timing, save compatibility, object budgets, catalogue UX and Tront branding as regression-sensitive systems.

**Make Buddy Bonk more fun and more polished. Do not “clean it up” into something less playable.**
