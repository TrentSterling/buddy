# Buddy Bonk backlog

From the six-lens audit + judge workflow on 2026-09-17 (v0.8.1). Twelve items were planned and ordered so earlier items never conflict with later ones on the single file. Items P1 to P3 shipped in v0.8.2. P4 to P12 remain, in order. Each is scoped to under ~150 lines, local-FX where possible, host-authoritative where it changes gameplay, within the 6144 B snapshot budget, and adds no new tools (the 31-bit ownership mask is full).

## Ready to build, in order

- **P4 Reward attribution and fairness.** `reward()` and the candy/cash flow. Per-player reward gate so two hands firing identical tools on the same tick are not starved; close the A/B/A/B two-tool-toggle double dip (variety = a tool not used in the last three payouts); candy obeys the existing spam rule; thrown spears and shuriken credit the thrower, not the original owner. Prove with a headless run measuring $/min for the toggle exploit before and after, plus qa/units.py and qa/network.py.
- **P5 Wall and floor slams pay out.** Grab-throw, spring and air-cannon launches that slam Buddy into a wall or floor should reward like a hit. Hook the existing bounce/impact path in the sim. Verify a thrown-into-wall slam pays via the `__buddy.test` API.
- **P6 Directional impact kick and power-scaled explosions.** Screen kick in the direction of impact, shake scaled to impact magnitude, explosions get a shockwave ring, embers and a deeper boom. Local FX only. Consecutive-frame screenshots for the ring; confirm no networked bodies added.
- **P7 Landing thud, floor dust, hang-time payoff.** Buddy hitting the floor after airtime gets a thud sound, a local dust puff and a small reward scaled to hang time. Reuse the airtime/bestAir state already tracked. Frames of a fall.
- **P8 Silent tools get feedback.** Tesla: jagged sparks, a buzz and a silhouette strobe while held. Freeze, thaw, ignite and daze get edge FX driven from the snapshot mood fields (guests see them without new events). Local FX. Frames per tool.
- **P9 Buddy face reads the threat.** Gaze and cower follow the most dangerous active hand (not merely the nearest), and Buddy flinches during the wind-up of a swing that will actually land. Reworks the eye/mood loop in the renderer plus a host-side "will land" check. Do not add a second competing gaze target (see dropped grudge-glare). Frames of the flinch.
- **P10 Tug-of-war callout.** When two hands hold Buddy and pull apart past a threshold, a transient world callout rewards it. Host-owned detection over the existing dual-grip constraints. Two-client run.
- **P11 Readable hand labels.** Hand name at 13 px in the hand's colour, with HOST and YOU tags, clamped above the floor so it never clips off-screen. Renderer only. Screenshots at 1280 and on a phone width.
- **P12 Phone layout.** Two-row portrait dock instead of 11 px labels; stop clipping catalogue tab labels and mid-word breaks. CSS only. Screenshots at 390x844 and 320x740.

## Deferred by the judge (with reasons)

Kept out of this round to avoid stacking edits on the same code the items above already touch. Good follow-ups.

- **Local hit-stop on heavy contacts** — freezing the renderer time base risks the tick-stamped mallet contact path CLAUDE.md protects; revisit after P6's kick is felt.
- **In-room combo tags / stunt auto-advance** — text spam near Buddy while P4 changes how combos climb; stunt auto-advance grows a secondary system the handoff says not to turn into a mission UI.
- **Grudge glare at the worst offender** — overlaps P9's gaze ownership; build after P9.
- **Head rub after daze, dust-off after a fall; idle fidgets** — host-side idle pose targets inside the constraint solver; risk to maxJointError and self-righting.
- **Hats and skins react (hat hop, propeller spin, skin faces)** — touches drawHat/faceDetail which the catalogue thumbnails exercise; next cosmetic pass.
- **Buddy speech bubbles** — refactor bubble drawing out of the glove path plus a host flavour-text stream; effort 3.
- **Carried / dangled / relieved-landing faces** — third overlapping edit of the face branches; pair with the grudge glare.
- **Hold-and-hit assist (credit the holder)** — a third reward-semantics change in the same round as P4/P10.
- **Name the shooter on every basket** — needs heldBy plumbing for a moment that already reads clearly (SWISH!).
- **Header player pips / roster verbs** — dashboard-adjacent per handoff 3.1; P11 solves identification where it matters.
- **One-tap chat reactions** — input-layer adjacency (chat close, cursor rules) makes it its own careful pass.
- **Guest lag legibility (ack ghost, amber LED)** — diagnostic, not fun; the D panel already shows rtt.
- **Double-barrel reload pose after every shot** — cosmetic; needs a lazily allocated reloads map threaded into drawNewTool, which the catalogue portraits also call.
- **Economy retune (base payouts down, candy carries spectacle, Room-tab party sink); upgrades that actually change income (PAYDAY reads +49% not +75%, CANDY VAC 0%)** — a global economy retune plus a new purchasable event class; measure and tune after P4/P5 change the baseline income.
- **JSON-LD softwareVersion 0.5.0 mismatch** — stale field vs the other three 0.8.x strings; align on the next version bump.
