# Buddy Bonk 0.6.0 — by Tront

Deploy `index.html` by replacing the existing published HTML. All gameplay artwork, code, styles and synthesized sounds are inline. Public multiplayer loads pinned Trystero for discovery as before. The source and QA files do not need uploading to Pages.

Shop now contains Weapons, Toys, Buddy (Bodies / Hats), Your hand, and Room. Click an item to preview, then Equip / Wear / Use. Purchases are shared. The current-tool button or E opens owned equipment for fast switching. The Earn unlocks / Sandbox button in the catalogue switches the host's workshop mode.

New shortcuts: Z revolver, S SMG, I burst rifle, P double barrel, N minigun, semicolon grenade launcher, comma spear, Y shuriken, period frying pan, right bracket water pistol. All tools are also accessible without shortcuts through the catalogue.

Sweep is beside Repair. More exposes extra cleanup choices, including a deliberate host-only hold for full clearing. Hats and skins are in the shop, not settings. Existing Tront backlinks and postcard export remain.

Read VERIFICATION.md for executed checks and limitations. Source can be regenerated with `python build.py`; baseline.html plus the modular source files produce one index.html. QA scripts use Python Playwright and Chromium; local_turn.py is a test-only loopback TURN/TCP fixture, not an infrastructure requirement to deploy.
