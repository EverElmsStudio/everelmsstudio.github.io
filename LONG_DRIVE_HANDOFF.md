# EverElms Long Drive — Codex Handoff

Updated: 2026-08-15

## Start here

Continue development in this exact workspace:

`C:\Users\jiann\OneDrive\Documents\Website`

Before making changes:

1. Read this file completely.
2. Inspect `git status --short` and preserve all existing changes.
3. Open the current game and play at least one drive.
4. Summarize your understanding to the user before changing behavior.

## Keep this handoff current

Treat this file as living project documentation. Update it whenever work materially changes any of the following:

- Current preview or asset version numbers.
- Gameplay rules, controls, physics or scoring.
- XP, levels, ranks, unlocks or driver bonuses.
- Swing timing, golfer rigging or club attachment.
- UI structure, mobile layout or visual direction.
- Important assets, files, tests or local launch instructions.
- Known problems, resolved problems or recommended next steps.
- User decisions that a future conversation must not accidentally reverse.

Do not update it for inconsequential formatting or tiny implementation details. When a meaningful increment is completed, review the affected sections before the final response and keep the kickoff prompt's current version accurate.

If the working tree is committed later, replace the uncommitted-work warning with the relevant branch and checkpoint commit. Until then, preserve the warning below.

Current preview:

[http://127.0.0.1:4173/sloppy-golf/?v=231](http://127.0.0.1:4173/sloppy-golf/?v=231)

Current asset versions in `sloppy-golf/index.html`:

- `long-drive.css?v=50`
- `long-drive.js?v=231`

Always give the user the localhost URL in exactly this Markdown format after an update:

`[http://127.0.0.1:4173/sloppy-golf/?v=N](http://127.0.0.1:4173/sloppy-golf/?v=N)`

Increment the JavaScript/page query version for every delivered game change. Increment the CSS query when CSS changes.

## Working-tree warning

The current work is not committed. At handoff, `git status --short` reports:

```text
 M index.html
 M prototype.css
?? LONG_DRIVE_HANDOFF.md
?? long-drive.html
?? sloppy-golf/
?? tests/
```

These are intentional project changes. Do not reset, clean, checkout, overwrite, or discard them. Do not start in a separate worktree unless the user first asks to commit the current state.

## Product intent

This is EverElms Studio's first lightweight web game. It is a playful portfolio/showcase experience, not a commercial release. It must remain:

- Mobile-first, especially portrait phone layouts.
- Lightweight enough for GitHub Pages/static hosting.
- Colorful and playful with a stylized low-poly/cel-shaded presentation.
- Understandable without game-development knowledge.
- Fun in short sessions, with progression that rewards repeated rounds.

The game title is **Sloppy Golf**. The user supplied `SloppyGolfDraft.png` and `EE_Logo_draft.png` as visual inspiration; those source drafts remain untouched in Downloads. Three portable, transparent, font-independent SVGs now live in `media/branding/`: the Sloppy Golf wordmark, the EverElms symbol, and the EverElms Studio lockup. The approved August 20 EverElms Studio rebuild supersedes the earlier invented two-E lockup: it preserves the user's overlapping E/S concept with consistently smooth hand-built curves, uses Oxanium ExtraBold outlines for `EVERELMS`, and Sora Medium outlines for `STUDIO`. Its approved spacing keeps the two text lines together with a modest gap below the monogram. The SVG has three independently movable named layers—`Logo`, `EVERELMS`, and `STUDIO`—plus a subtle EverElms-blue gradient, no background, embedded bitmap or live font dependency. Version 226 brings the same identity to the title-card publisher signature: the approved blue E/S symbol sits in an EverElms-green square, with live Oxanium ExtraBold `EVERELMS` and Sora Medium `STUDIO` text for crisp small-screen rendering. Version 227 refines that tiny badge with a dedicated small-size symbol: flat EverElms blue, more green breathing room, and optical centering, while leaving the approved full-size gradient logo unchanged. Version 228 adds a brief EverElms Studio presentation card during startup, the green-square monogram as the browser favicon, and a quiet non-interactive studio signature beneath the round-summary controls. Studio branding remains absent from active gameplay and reward screens so Sloppy Golf stays visually dominant. The Sloppy Golf wordmark must retain the exact outlined Cherry Bomb One letterforms, flat EverElms green `#97cc04` fill and heavy EverElms blue `#2d7dd2` stroke, with touching characters. Its ball replaces the second `O`, is slightly taller than the letters, uses a dense symmetrical pattern of visibly inset—not raised—dimples clipped inside a perfectly smooth circular face, has no shadow, and owns a tee rendered over the lower blue stroke. Version 211 integrates this approved wordmark into the main game menu. Version 213 copies the supplied `golfMusic.mp3` into the game and adds the first background-music mix; the original Downloads file remains untouched.

Version 229 completes the requested code/performance/progression/extreme-shot audit and stops before gameplay release changes. Stored numeric progression and round-history values are validated before use, and expensive golfer inventory logs run only in diagnostics/source-preview modes. Diagnostics now record per-drive heap and renderer-resource snapshots. An isolated progression regression proves the reveal order `Level Up → Driver Unlock → Rank Up → Round Summary` and proves both Steady and Competition remain following-round equipment changes. OOB flight uses adaptive swept terrain sampling so a fast ball cannot cross a narrow hill crest between endpoint checks. Severe-miss camera framing checks the full camera-to-ball corridor, moves inward to look around a blocking palm, then adds bounded terrain/canopy lift only if needed. Physics balance, wind, scoring and progression constants are unchanged. Full evidence is in `tests/v229-release-audit.md`; deterministic coverage is in `tests/v229-release-audit-harness.js`.

Release packaging now uses `tools/build-pages.mjs` and `.github/workflows/deploy-pages.yml`. Version 230 moves the complete game source and media under `sloppy-golf/`, producing the clean public address `/sloppy-golf/`; the root `long-drive.html` is now only a lightweight bookmark redirect. The build creates an explicit runtime-only `_site/` artifact for GitHub Pages. It includes the EverElms website, Song Starter page, Sloppy Golf v230, the optimized runtime golfer, derived gameplay club, active audio, and required branding. It deliberately excludes source/legacy golfer files, original texture folders, club source, audio experiments/previews, generated previews, tests, tooling, and handoff documentation. The repository `.gitignore` also keeps those large or superseded assets and local Python dependencies out of the public repository while retaining their local copies untouched. Version 230 begins a fresh `everelms-sloppy-golf-*` progression-storage namespace, so the development-era Legend save is not carried into the deployment candidate; the existing sound preference remains shared. Each visitor starts clean and retains only progress earned after playing this release. Publishing the `main` branch through the GitHub Pages Actions source will deploy this artifact to the existing `www.everelmsstudio.com` custom domain.

Version 231 fixes the narrow-phone title-card control row discovered immediately after release: all three labels stay on one line, with a modestly wider centre column for `Reset progress` and slightly tighter horizontal button padding. Gameplay and saved progress are unchanged.

## Core game loop

- The player competes against their own record.
- Each round contains six drives.
- Tap/click 1 locks power.
- Tap/click 2 locks accuracy and initiates the animated swing.
- The camera follows the ball after impact.
- A drive counts only if it finishes inside the long-drive grid.
- Total distance, including roll, is the official score.
- Out-of-bounds drives count as zero for round-average/XP calculations.
- The round summary highlights the best valid drive.

## Current game systems

### Shot input and feedback

- Oscillating power meter.
- Oscillating accuracy meter.
- Accuracy affects horizontal strike/shot curvature.
- Power and accuracy feedback remain briefly visible after impact, then fade.
- Impact assessment such as `Late · Slice` remains visible briefly during flight.
- User-supplied effects cover meters, locks, impact, perfect-100 contact, valid/OOB results, personal bests and progression reveals. Only ball bounce/landing and sound-on confirmation remain synthesized.

### Ball flight

- Arcade-realistic flight rather than a full simulator.
- Ball speed, launch angle, timing, strike location, wind and curve affect results.
- Eight wind directions are supported, including headwind and tailwind components.
- Strong hooks/slices can miss the grid.
- The range is long enough that a straight shot exiting the far end is not automatically invalid.
- Side berms share a terrain-height function with ball collision, rolling, flags and the flight camera.
- Balls should not disappear below raised scenery.

### Camera

- Tee view is a rear three-quarter/side profile with the full range visible.
- Golfer is large, with feet close to—but not touching—the power panel.
- Flight camera transitions smoothly without the old zoom-in/hard-pullback problem.
- It follows the ball until rest.

### Results

The shot card includes:

- Valid/OOB result.
- Total distance.
- Carry.
- Club speed.
- Ball speed.
- Launch angle.
- Shape.
- Distance from center.
- Driver-face contact diagram and contact label.

The driver-face diagram is intentionally simplified but based on a recognizable modern driver face.

## Round XP and progression

XP is awarded per completed six-drive round, not per individual drive.

Current XP formula:

- `+20` completion.
- `floor(zero-inclusive six-shot average / 6)`.
- `+10` if all six drives are valid.
- `+15` if the round contains a new personal best.
- `+15` if the round meets the next-rank target.

Current rank requirements:

- Amateur: 370+ yd, 2 of last 5 qualifying rounds, Level 2.
- Crusher: 400+ yd, 2 of last 5, Level 4.
- Pro: 420+ yd, 2 of last 7, Level 7.
- Legend: 439+ yd, 3 of last 8, Level 10.

The rank qualification card uses plain language such as:

- `✓ Distance complete`
- `2 of your last 7 rounds reached 352+ yd`
- `Level 4 of 7`
- `Keep earning XP to qualify`

Progress can be reset from the in-game start menu. Sound settings are retained by reset.

## Driver progression

Current gameplay drivers:

- Training Driver below Level 3.
- Steady Driver at Level 3: resulting shot dispersion is 4% calmer without slowing the visible meter.
- Long Driver at Level 7: retains the dispersion benefit and adds a 1.2% club-speed multiplier.
- Competition Driver challenge at Level 10: completing a round that starts at Level 10 with a zero-inclusive 325+ yard average unlocks a glossy black driver. It retains the 4% dispersion benefit and raises the total club-speed multiplier to 3.5%. The club uses a low-roughness black crown with cool-white and blue reveal lighting so the head reads as glossy black rather than grey or silhouette. The reward uses the existing driver-reveal sequence with a special two-pass glimmer and a Competition-only icy-blue high-contrast display background; it equips only in the following round.

Completed rounds are now tracked separately in `everelms-long-drive-total-rounds`. This is an all-time counter from the current new game/reset, unlike the rolling 12-round qualification history. Reset Progress clears it and the Competition Driver unlock.

The original procedural fallback introduced visibly different variants:

- Training: compact gray head, steel-colored shaft and black grip.
- Steady: EverElms blue crown, yellow sole/accent and blue/graphite grip/shaft.
- Long: larger deep-blue head, orange sole/aero details and darker graphite shaft.

Version 92 replaces that fallback during normal play with `media/golf-club-driver.glb`, derived from the user-supplied `GolfClubDriver.glb`. It is one rigid imported model used for gameplay and unlock previews. The supplied single mesh was reproducibly split into six named material regions—Grip, Shaft, Hosel, Crown, Face and Sole—by `tools/split-golf-club.py`. The untouched supplied file is preserved as `media/golf-club-driver-source.glb`.

Training, Steady and Long now share this authoritative geometry and vary through named materials. Steady uses an exact yellow face accent; Long uses orange. The old procedural club remains only as a load-failure fallback. Start remains disabled until both the golfer and imported club have either loaded or explicitly fallen back, preventing mid-round model swaps.

Versions 101-102 deliberately restore the original FBX-authored swing after an over-correction in version 100. Do not reintroduce spine lifting, a two-hand shaft-axis override, impact pinning, or an impact-only correction blend. The right wrist quaternion and its original address calibration are authoritative throughout the swing. The imported GLB is only rigidly placed at the grip: its source-space offset is scaled correctly so the hands hold the butt end, and the golfer is fitted farther left so the real club length reaches the teed ball at address. Future alignment work must preserve the authored swing and adjust only rigid club placement or golfer/ball spacing.

Version 103 centralizes each reward driver's identification color. The imported club face, procedural fallback accent, and reward-announcement ring all derive from the same tier value: bright yellow for Steady and orange for Long. Future reward drivers must add one identification color to this shared map rather than styling the ring separately.

Version 104 makes the Steady upgrade readable from the normal address camera. Its imported crown, sole and hosel use the shared bright-yellow identification color, while its face is contrasting deep blue. The procedural fallback follows the same visible yellow-head treatment. The reward ring remains tied to the same yellow value.

Version 105 applies one consistent material pattern to every driver. Grip, shaft and deep-blue face remain identical; crown, sole and hosel carry the tier identity color: grey for Training, yellow for Steady and orange for Long. Both imported gameplay models and procedural fallbacks follow this rule. Reward announcement rings derive from the same tier-color map.

Version 106 cleans up the result-card face-contact diagram to match the active gameplay driver system. The diagram uses the shared deep-blue face and dynamically applies the current round driver's grey, yellow or orange tier color to its perimeter and hosel. It remains a simplified readable strike map rather than a second 3D render.

Version 107 simplifies the contact diagram's awkward curved hosel into a straight vertical connector. The clubhead now has a strong black outer keyline plus a thinner inner tier-color band, improving separation from the light result-card background without changing the contact mapping.

Version 108 begins the reference-character pass without replacing or editing the FBX animation. Skinned vertices are colored by their strongest Mixamo bone influence to create skin, a bright-pink sleeveless shirt, light-grey shorts, a white left glove and white shoes. A lightweight low-poly blue EverElms cap and brown beard follow the existing head bone. This styling layer is deliberately reversible and does not change the skeleton, swing tracks or club calibration.

Version 109 enables skin deformation explicitly on the new vertex-colored toon material so the restyled FBX continues following its original animation rather than displaying its bind pose.

Version 110 fixes the first head-detail pass. The cap crown is now a closed, shallow low-poly form that intersects the skull cleanly at animated head angles instead of showing cut-off hemisphere wedges. The beard is a forward faceted jaw shell with a separate moustache, making the facial hair visible from the address camera.

Version 111 corrects the accessory orientation. Mixamo's animated head-bone basis turned the cap and beard edge-on; the accessories now follow the head position while using the golfer root's stable visual orientation. This keeps the crown horizontal and the beard on the facial side throughout the swing.

Version 112 corrects the FBX character's visual forward direction for the added details. The cap brim/logo, beard and moustache now sit on the side the golfer actually faces at address instead of behind the head.

Version 113 preserves the user's second character candidate as `media/golf-drive-alternate.fbx` without replacing the current golfer. `?golferView=alternate` loads the candidate with its original materials and no procedural cap/beard so its geometry, embedded styling, animation and Mixamo-bone compatibility can be evaluated independently.

Version 114 makes `media/golf-drive-alternate.fbx` the default golfer after confirming its complete swing and compatible Mixamo rig. Its separate shirt and shorts receive bone-aware reference colors, sneakers are white, hair is brown, and the cap/beard styling is fitted to the human head. The former golfer remains untouched and selectable with `?golferView=legacy`. The alternate FBX is approximately 54.5 MB and must be optimized before release.

Version 115 adjusts the procedural cap and beard for the alternate human mesh. Its Mixamo head-bone origin sits behind the visible skull, so the accessory group is shifted toward the face and its brim, logo, beard shell and moustache use the alternate model's actual forward side.

Version 116 adds the alternate FBX's required 90-degree accessory-axis correction. The body visually faces world +X even though its root basis points along Z; cap and beard local-forward now map to the visible facial direction before their fit offset is applied.

Version 117 applies the supplied reference skin tone to the alternate model's separate body mesh. Removing its original dark body texture gives the procedural brown beard enough contrast to read and better matches the stylized low-poly character direction.

Version 118 increases head-detail readability at gameplay scale: the cap crown is deep EverElms blue with a brighter blue brim, while the beard and moustache use a darker dedicated brown rather than sharing the lighter hair material.

Version 119 removes the alternate FBX's texture-card hair and eyelashes that became fuzzy after recoloring. The shirt now uses one clean skinned material with a repeating tonal palm-frond pattern, eliminating patchy bone-colored sleeves. The shorts gain a pink upper transition and light belt band to lower their apparent waist, and the cap is seated lower with a longer forward brim.

Version 120 calibrates the cap/beard assembly against the alternate model's animated head-bone basis with a fixed -90-degree X correction. Unlike the earlier stable-root approximation, it now follows head motion through the swing while remaining upright and seated at address.

Version 121 replaces full head-driven accessory rotation with a hybrid attachment: the calibrated head transform controls positional tracking while the golfer root supplies a stable body-facing orientation. This prevents the cap becoming a vertical slab during the follow-through while keeping it positioned with the moving head.

Version 122 rotates the complete cap-and-beard accessory assembly 180 degrees around its upright axis. The previous body-facing correction placed the brim and facial hair behind the head; both now face the same direction as the golfer.

Version 123 supersedes the simple 180-degree experiment after visual verification showed the alternate model's skull is offset forward from its head-bone origin. The brim-facing orientation is restored and the complete cap/beard assembly is translated onto the visible skull and jaw instead.

Version 124 completes the address-camera fit by increasing that forward skull offset, centering the cap crown over the visible head and bringing the dark beard shell onto the jaw line.

Version 125 separates the cap and facial-hair fit offsets after user markup clarified their target positions. The crown moves forward/down over the forehead, the brim pitches with the address head angle, and the beard/moustache move back and down from the forehead onto the lower jaw.

Version 126 removes the head-rotated positional offset after swing-frame testing showed it flinging the cap away during the backswing and finish. The assembly now follows the animated head point directly with a fixed calibrated address offset and stable orientation.

Version 127 removes the procedural cap/beard assembly from the default alternate character. The FBX's original body/face texture, hair and eyelashes are restored untouched, eliminating the head-fit problems. The custom patterned shirt, adjusted shorts, white shoes, original animation and club attachment remain. Procedural headwear is retained only with the legacy golfer fallback.

Version 128 preserves the alternate FBX's original facial/body texture while applying a warm, lighter tanned-white skin tint and a subtle tan emissive lift. This changes the perceived complexion without replacing the texture or erasing facial definition.

Version 129 slows only the authored downswing segment, beginning at clip time `0.9s`, to 82% playback speed. The backswing and post-impact finish remain unchanged. Ball launch and impact audio now use the corresponding retimed playback moment (about `1.24s`) while the authoritative visual impact frame remains clip time `1.18s`.

Version 130 preserves the tee view for `0.42s` after launch, then blends to the flight camera over `1.08s`. The camera now captures more of the follow-through and begins from the exact tee target instead of jumping immediately toward the range. Review of the user's short recording and fixed impact frames confirms the alternate golfer's clubhead still passes outside the ball; do not conceal this with an early camera cut.

Version 131 replaces the slow v129 transition with an arcade long-drive rhythm based on the user's Kyle Berkshire reference: near-original backswing speed, a brief `0.065s` loaded beat at clip time `0.9s`, and a `1.34x` explosive downswing. Additive hip/spine motion deepens the coil and enlarges the finish, but fades around impact so the authored hand and rigid-club arc remain authoritative. The larger finish remains visible during the v130 tee-camera hold. Fixed-frame and live mobile testing still show that the clubhead passes outside/above the teed ball; this visual contact alignment remains a separate known issue.

Version 132 corrects the first exaggerated load, which bent the golfer sideways and looked unbalanced. The additive pose now lowers the pelvis into a centered two-leg squat, removes the artificial hip and torso fold, and uses only a small upper-spine counterbalance. The v131 pause, explosive downswing and large finish remain unchanged.

Version 133 removes the v131-v132 additive skeleton experiment after the user's recording showed that the hip load was not readable in motion and the hard top pause/fast segment looked jittery. Playback now follows the authored FBX continuously at normal backswing speed and `1.18x` downswing speed, with no inserted pause or per-frame hip/spine overrides. A convincing long-drive squat requires a coordinated hips/knees/ankles pass with planted feet rather than another isolated pelvis edit.

Version 135 adds a restrained long-drive transition compression based on the user's front-view Martin Borgmeier reference. From clip time `0.86s` to `1.14s`, the pelvis briefly lowers while a two-pass leg-chain solve returns both ankles to their FBX-authored positions and restores the authored foot rotations. The correction peaks at `1.0s` and is fully removed before the `1.18s` impact; the FBX supplies the upward drive and finish. An attempted artificial post-impact push was rejected during fixed-frame testing because it overconstrained the lead leg and lifted the shoe.

Version 137 adds visual shaft flex to the authoritative imported driver. The GLB's rigid Shaft region is hidden during gameplay and replaced with five short world-space segments forming a shallow curve between the fixed grip and displaced head. Flex peaks near the top of the backswing, returns to zero around impact, then bows oppositely and settles during the finish. Hosel, Crown, Face and Sole move together at the curve endpoint; grip attachment, swing timing and shot physics are unchanged. Reward previews explicitly restore the original straight GLB shaft. A first source-space shader attempt was rejected because inherited GLB scaling separated the shaft/head; do not restore that approach.

Version 138 deliberately exaggerates the v137 shaft flex to the user's requested near-breaking arcade limit. Top-of-backswing displacement increases from `0.16` to `0.42` world units, finish rebound from `0.13` to `0.34`, and settling rebound from `0.055` to `0.13`. The curved replacement shaft now uses nine segments rather than five so the stronger bow remains smooth. Impact is still zero-flex and physics remain unchanged.

Version 142 responds to the user's three-frame review. The extreme `0.42` backswing bow remains, but reverse follow-through flex is reduced to `0.07` with no secondary rebound. Ball launch moves from clip time `1.18` to `1.20`. Because the alternate FBX's authored head path still passes above/outside the tee, the flexible presentation now performs a smooth elastic contact release from `1.12` to `1.29`, converging the head on the stationary tee at `1.20` while keeping the grip in the hands; only the independent whip amount adds shaft curvature, so the shaft is straight at contact rather than S-shaped. The obsolete screen-centered radial impact flash is removed. The ball radius decreases from `0.11` to `0.09` and uses warm off-white to avoid reading as a bright flash during the delayed tee-camera view. Address calibration moves the head target `0.34` world units toward the ball.

Version 149 replaces the result card's hand-drawn SVG driver face with a front-facing WebGL render cloned from the authoritative imported GLB. Grip and Shaft regions are removed from this contact-only scene; Crown, Face, Sole and Hosel retain the active round driver's real geometry and tier materials. Because the split meshes retain unused source vertices, orientation and camera fitting use only indices actually drawn by the Face region: area-weighted rendered-triangle normals face the camera and indexed face bounds set framing. The contact target/dot percentages are remapped to the real model's compact, angular lower striking surface. Do not restore the old wide oval SVG; the supplied model's actual face is visibly more trapezoidal/faceted.

Version 151 rolls the real GLB contact head 90 degrees clockwise at the user's direction. The result renderer now centers and frames the union of the actually drawn Crown, Face, Sole and Hosel triangles, avoiding crowding from fitting only the face. It also projects the actual indexed Face bounds through the orthographic camera and derives both the center target and strike-dot coordinate range from those percentages. This keeps marker registration correct after model rotation and avoids future hard-coded face footprints.

Version 152 fixes a structural misunderstanding exposed by the user's comparison to a real driver-face reference. `golf-club-driver.glb` is one mesh with six material-indexed primitive groups, not six separate mesh objects. The contact renderer now clones the material array, hides only the Grip/Shaft materials, identifies the exact geometry-group index range assigned to `Face`, and derives its area-weighted normal and projected bounds from only those indices. This finally presents the broad striking face rather than the crown/profile. Visible-head fitting unions only drawn Crown, Face, Sole and Hosel group indices. Imported tier recoloring now also iterates material arrays, fixing the same assumption for gameplay/reward colors.

Version 153 corrects the derived GLB itself after an orthographic inspection of the untouched source proved the old splitter's `minimum Y > 0.028` rule had mislabeled crown triangles as `Face`. `tools/split-golf-club.py` now identifies the true broad forward `+Z` striking surface using triangle normals (`normal.z > 0.35`) and its head-depth range. Regeneration produces 27 true Face triangles; the Face material is dark charcoal and remains identical across Training, Steady and Long, while Crown/Sole/Hosel retain tier identity colors. The derived asset is loaded as `golf-club-driver.glb?v=2` to defeat stale caches. Mobile verification confirms the in-hand club and result card now share the corrected dark striking face. Keep `media/golf-club-driver-source.glb` untouched and regenerate only through the script.

Versions 154-159 supersede the v153 axis conclusion after user screenshots proved `+Z` was the shield-shaped rear/sole, not the striking face. The corrected splitter identifies the wide `-Y` face with `normal.y < -0.50`; the derived asset is cache-versioned as `golf-club-driver.glb?v=4`. The contact camera is deterministically aligned to source `-Y` rather than inferring orientation from faceted normals, then horizontally mirrored so the hosel is upper-right like the user's right-handed reference. Heel/toe marker direction is mirrored with it. Camera centering and scale derive from the exact Face primitive's index range, while all visible head regions remain rendered. The Face is dark charcoal for every tier. The supplied GLB's real face is angular/wedge-shaped and does not have the rounded photo-reference silhouette or score grooves; matching that photograph more closely requires editing/replacing the source mesh, not another camera/material fix. The untouched source remains preserved.

Version 160 rolls the contact-card render 45 degrees clockwise after the horizontal mirror, presenting the real imported Face primitive at a more familiar address angle. The existing face material and model geometry are unchanged; projected face bounds still drive framing and marker registration after the rotation.

Version 161 reverts the failed v160 roll after the resulting view exposed more crown and sole instead of presenting a recognizable striking face. The contact renderer is restored to the v159 deterministic face-axis view. Do not attempt another speculative whole-head rotation; the next visual revision should use either a purpose-built face-on graphic matching the user's reference or corrected source geometry.

Version 162 applies the user's explicitly annotated 45-degree clockwise screen rotation. Because the contact head is horizontally mirrored first, this requires a positive 45-degree local Z roll—the opposite sign from the failed v160 attempt. Face color and geometry remain unchanged.

Version 163 removes the imported 3D model from the face-contact result card after repeated orientations failed to show a recognizable striking face. The card now uses `media/driver-face-reference.png`, a transparent, enlarged face-on asset derived from the user's real-club reference, with its broad rounded black face, silver edge, hosel and white score lines preserved. Gameplay continues using the imported GLB. Strike-marker placement uses fixed bounds for the visible face area of the reference image.

Version 164 replaces the principal synthesized gameplay tones with the user's MP3 sound set in `media/audio/`. `charge-up.mp3` follows both meters, playing forward as each scale rises and from a reversed decoded buffer as it falls; its playback rate is fitted to the current rank/driver sweep duration. `power-lok.mp3` confirms both ordinary locks, while `onehundred.mp3` replaces the second lock when displayed power is 100% and accuracy grades Perfect. Driver impact, valid drive, out of bounds, personal best and level reveal use their named files. The quieter synthesized bounce and sound-on confirmation remain until replacements are supplied. `lock_in.mp3` is preserved but intentionally unassigned pending user direction.

Version 165 rebalances the first audio pass. Charge playback gain drops from `.32` to `.18`, and ordinary power/accuracy locks drop from `.70` to `.45`. The valid-drive clip is capped at `.95s` with an `.08s` fade instead of playing its full tail; personal-best begins at `1.08s`, after that shortened confirmation, rather than overlapping it. Synthesized bounce gain increases from `.035` to `.075`, and the transition from bouncing to rolling now adds a distinct louder landing thump.

Version 166 replaces the original `media/audio/charge-up.mp3` contents with the user's new `charge-up2.mp3` while retaining the stable runtime filename and forward/reverse meter behavior. The unused project copy of `lock_in.mp3` is removed at the user's direction; the original Downloads files remain untouched.

Version 167 lowers charge gain from `.18` to `.12` and ordinary power/accuracy lock gain from `.45` to `.32`. The reverse-meter source now begins at the mirrored endpoint of the exact audio segment used during the outward sweep. This makes the accuracy meter's leftward return audibly play the just-heard rising segment backward instead of entering an unrelated tail of the longer replacement charge file.

Version 168 replaces the superseded project copies of `valid-drive.mp3` and `out-of-bounds.mp3` with the user's `valid-drive2.mp3` and `out-of-bounds2.mp3`, retaining stable runtime filenames and cache-versioning both URLs as `v=2`. Other active sound assets remain unchanged, and the original Downloads files are untouched.

Version 169 adds the user's `media/audio/rank-up.mp3` and plays it when the dedicated rank-reveal popup opens for Amateur, Crusher, Pro or Legend. Numbered level reveals continue using the separate `level-up.mp3` effect.

Version 170 moves the special `onehundred.mp3` cue from the accuracy-lock moment to club/ball contact for shots with both displayed 100% power and Perfect accuracy. Those shots now play that cue at `1.35` gain in place of—not on top of—the ordinary driver-impact sound; their accuracy lock uses the same quiet `power-lok.mp3` confirmation as other shots.

Version 171 adds the user's `media/audio/new-club.mp3` and plays it once at `.75` gain when the dedicated Steady Driver or Long Driver unlock reveal appears. It is separate from the numbered level-up sound and does not play on ordinary level or rank reveals.

Version 173 cleans up the restored alternate FBX head materials without changing its geometry or animation. `Ch42_Hair`, `Ch42_Hair1` and the eyelash mesh no longer inherit the blanket double-sided material treatment: their authored front faces use depth writing and a firm alpha cutoff, eliminating the stacked semi-transparent hair-card halo that had returned when the original FBX head assets were restored in v127. Other golfer materials retain their existing presentation. Mobile address-view verification shows a clean head silhouette and no new runtime errors.

Version 174 makes crosswinds visibly meaningful without changing headwind or tailwind strength. Airborne lateral wind acceleration increases by 80%, while the flight camera follows 70% of the ball's lateral position and aims at 88% instead of continually recentering the shot. Accuracy-driven hooks and slices remain the dominant severe misses, but well-struck balls now visibly migrate across the grid in stronger crosswinds. The deterministic physics harness mirrors the new coefficient.

Version 175 strengthens the v174 crosswind pass after live playtesting showed that its roughly 6-7 yard maximum drift remained difficult to perceive. Lateral wind acceleration increases from `.036` to `.060`; deterministic checks measure roughly 10.6-11.2 yards of displacement for a perfectly struck ball in a pure 10 mph crosswind and 6.2-6.9 yards at 6 mph. The flight camera now follows 55% of lateral ball position and aims at 80%, revealing more movement against the grid while still keeping the ball readable. Headwind/tailwind strength and accuracy-driven curvature are unchanged.

Version 176 adds a broadcast-style shot tracer. A bright EverElms-yellow tubular core with a deep-blue keyline grows behind the airborne ball, records launch, apex, accuracy curve and wind drift, and stops at first ground contact so bounce and roll do not distort the carry shape. The yellow core renders after its wider outline so nested depth ordering cannot hide it. The tracer remains visible through the result card and is disposed/reset before the next drive. It is sampled by travelled distance and capped at 220 tubular segments to remain lightweight on mobile.

Version 177 simplifies the shot tracer to one unoutlined EverElms-green (`#97cc04`) tube at the user's direction. It now records the initial bounce sequence as well as airborne carry, adding each turf contact and the short rebound arcs before stopping when the ball transitions to rolling. Roll remains excluded so the broadcast-style trajectory does not become a long line painted across the ground.

Version 178 changes the single unoutlined tracer to EverElms blue (`#2d7dd2`) and increases its tube radius from `.048` to `.060` for 25% more width at the user's direction. Carry and initial-bounce tracking remain unchanged.

Version 179 begins the UI-polish pass with a mobile-first arcade/broadcast treatment. The live HUD uses larger white values on deep-navy chips with blue, green and yellow status rails; XP text and progress are larger and more legible. The full-screen start menu becomes a layered navy game card with an oversized uppercase title, a CSS-rendered dimpled golf-ball/target motif filling the previously empty center, and a yellow primary action. Swing controls gain a larger prompt, 34px meters, stronger markers and a blue-edged control deck. Shot results use a compact dark broadcast card, yellow distance emphasis, a light face-contact inset, larger stat values and a yellow action button; the mobile hero stays two-column to remove dead vertical space. Short-height overrides preserve the 320x568 layout. Information and gameplay behavior are unchanged.

Version 180 locks the first cohesive environment-polish direction before final UI skinning. The fairway, rough and continuous side berms use deeper, more saturated greens; horizon fog begins farther away so flight retains terrain contrast. Flat box-based range markings are replaced with raised, polygon-offset triangle ribbons aligned to the exact 27.2-metre legal boundaries, eliminating shallow-angle clipping and inconsistent side edges. Two lightweight continuous faceted mountain silhouettes establish a distant destination, and the palm layout expands from 12 to 26 trees: an outer scenery rhythm plus a smaller grove immediately beyond both legal boundaries, with every trunk rooted through the shared terrain-height function. The v179 UI is retuned against the darker field with restrained HUD, controls, score and menu-ball animations plus a pulsing power sweet zone; reduced-motion behavior remains authoritative. Physics, scoring and collision terrain are unchanged.

Version 181 makes that environment continuous for the moving ball camera. The rough ground now extends far beyond every playable and camera-visible edge, the fairway and both side berms continue past the grid, and each berm segment shares its exact near/far ridge vertices so no cracks open between facets. Both mountain layers span the full lateral view instead of ending on screen. Fourteen additional terrain-rooted palms carry staggered inner and outer groupings through the landing zone and beyond it. Fog is pushed back modestly to retain depth across the longer scenery. Physics, scoring and legal boundaries remain unchanged.

Version 182 is the dedicated environment color-and-light pass. Fairway, rough, tee turf and side berms now share a lightweight single-pass shader that preserves the low-poly vertex facets while adding four-step sunset lighting, cool shadow color, warm highlights, restrained saturation, subtle mowing variation and distance-aware aerial color. The palettes are narrowed and substantially deepened so facets read as designed turf instead of pale patchwork. The existing sky shader is retuned to a richer blue-violet-to-coral-to-gold gradient with a soft horizon glow and minimal grain to reduce banding. No post-processing is used, keeping the pass appropriate for mobile. Physics, collision, scoring and legal boundaries remain unchanged.

Version 183 fixes disappearing out-of-bounds balls caused by a render/collision mismatch beyond the side berm. Each berm now includes a rendered outer apron that tapers from the ridge shoulder to the flat rough, and `terrainHeightAt()` follows the same taper instead of extending an invisible elevated collision plateau indefinitely. The flight camera also checks terrain at its own follow position and maintains minimum ground clearance during severe hooks and slices. Out-of-bounds scoring and the 27.2-metre legal boundary are unchanged.

Version 184 keeps severe out-of-bounds shots visible on mobile. Normal shots retain the deliberately partial lateral camera follow that makes wind drift and shot shape readable. Once lateral travel approaches the legal boundary, camera and look-target follow progressively increase; by roughly 55 metres offline the ball is safely recentered inside the mobile frustum through landing. This changes presentation only, not physics, collision or scoring.

Version 185 strengthens only the extreme end of that adaptive follow after visual testing showed a 50-yard miss could remain technically inside the frustum but pass behind the berm ridge. At maximum lateral travel the camera now follows 90% of ball movement and targets 98%, placing it on the same side of the ridge while leaving in-grid and mildly offline presentation unchanged.

Version 186 adds final mobile framing margin after a 45-yard-right landing remained visible but touched the screen edge. Adaptive follow now begins gently at 22 metres and reaches 94% camera follow with a fully ball-aligned target at 45 metres. Legal and mildly offline drives retain most of the original offset; severe misses remain comfortably visible on the same side of the berm through landing.

Version 187 applies the user-approved faster/brighter treatment to the existing `charge-up.mp3`. Both forward and reversed meter travel can now reach a 2.75× source rate, with a 1050 Hz presence boost, +6 dB high shelf from 2100 Hz and light dynamics compression before the established `.12` charge gain. The meter still stops and reverses the source at its authoritative gameplay timing, and all other sound assets are unchanged.

Version 188 replaces the visually straight diagonal hook/slice flight with a staged golf-shaped curve. Draws and hooks now begin slightly right before spin bends them left; fades and slices begin slightly left before bending right. Spin curvature builds after launch, is strongest through the middle of carry, fades late and is converted into ordinary lateral momentum at first turf contact so the existing bounce tracer remains faithful. Crosswind remains a separate airborne acceleration, so it can visibly reinforce or oppose the ball's spin curve instead of being baked into that curve. The blue tracer itself is unchanged and exposes the actual new ball path.

Version 189 established the user-approved UI direction. The three live stats became a single connected, color-keyed broadcast scorebug with a compact attached XP strip instead of separate floating dashboard cards. The swing controls use a dotted deep-blue arcade deck, yellow `SWING TIMING` tab, larger squared meters, brighter power progression and clearer hook/accuracy/slice zones. Information and meter timing remained unchanged. The direction was verified at 390×844 and 320×568 before the user approved extending it across the game.

Version 190 completes the cohesive broadcast-arcade UI pass. The start menu, valid/OOB result cards, level and rank reveals, driver unlock, collapsed and expanded round summaries, qualification tracker, reset confirmation, shared primary actions and secondary menu controls now use the same dotted navy surfaces, cyan top keyline, compact square-cornered data modules, yellow action hierarchy and uppercase display typography as the v189 HUD and swing deck. Reward-specific blue, green, yellow and orange accents remain intact, and all existing copy, stats and interaction flow are preserved. Browser verification covered the real result flow plus level, rank, driver, round-summary and reset states at 390×844 and 320×568; the shortest result view remains internally scrollable with its next-drive action reachable.

Version 191 fixes the round summary's flat hierarchy and unused space after user screenshot feedback. The best valid drive is now a large blue/yellow hero score, with round average and XP enlarged beside it; a labelled six-drive scorecard follows in a compact 2×3 layout on phones and 3×2 layout on wider portrait screens. Attempt values, next-rank status and supporting labels are larger, while the qualification tracker and both actions remain intact. A non-mutating `roundView=sample` query provides a reproducible six-shot visual fixture for future UI testing. Browser verification covered 504×844, 390×844 and 320×568 plus the expanded qualification state; the collapsed summary fits at the shortest size and expanded details retain internal scrolling.

Version 192 replaces the processed `charge-up.mp3` behavior with the user's approved clean accelerating pulse train in `media/audio/charge-up-pulses.wav`. Individual pulses get closer together and add controlled upper harmonics as the meter approaches maximum. The source is playback-rate fitted to each rank/driver's outward sweep at `.18` gain for both power and accuracy; return travel is intentionally silent to avoid repetitive forward/reverse irritation. Lock sounds, including the perfect-100 treatment, are unchanged and stop any remaining charge source before playing. The old MP3 and all audition previews remain preserved but inactive.

Version 193 gives accuracy its own semantically correct audio instead of reusing the power-max cue. `accuracy-focus-pulses.wav` plays a symmetric edge-to-centre-to-edge pattern at `.13` gain: pulses tighten, brighten and add a restrained glint approaching perfect centre, then relax after passing it. The same symmetric source plays on both left-to-right and right-to-left traversals, playback-rate fitted to the current accuracy half-sweep. Power retains its approved outward-only accelerating pulses at `.18`; all lock sounds remain unchanged.

Version 194 simplifies accuracy audio after live feedback showed that even a centre-focused pulse sequence develops too slowly during the roughly three-tenths of a second available before centre at Legend speed. Accuracy travel is now silent except for one clean 62 ms rising pip at `.16` gain, triggered directly whenever the mathematical meter phase crosses perfect centre in either direction. The cue is therefore frame-, rank- and driver-speed independent. Power retains its outward-only accelerating pulse train and all lock sounds remain unchanged. The v193 `accuracy-focus-pulses.wav` is preserved but inactive.

Version 195 is the first wind-and-impact environment pass. Every terrain shader receives the authoritative wind vector, strength and shared time, producing restrained moving turf bands that travel in the actual wind direction. All 54 palms now sway through root and crown motion from that same wind, tournament banners flutter, and 72 camera-local warm motes make strong crosswinds legible without post-processing. Club impact emits a short 24-fleck grass burst; first ground contact emits 34 velocity-aware grass/dirt flecks and leaves a subtle temporary bounce mark. The palm population also receives a visual upgrade: warm six-sided 8.4-metre trunks, broader shared segmented fronds, nine-frond crowns, richer emerald materials, 10% greater baseline scale and 14 new varied outer-range specimens. Shared frond geometry limits memory growth despite the added quantity. Browser verification covered the tee, impact, a full-power first-bounce sequence in 10 mph wind, the resulting 359-yard valid drive, and 390×844/320×568 framing. Physics, legality, scoring and camera rules are unchanged.

Version 196 makes the palm wind response readable at gameplay distance. Root motion remains restrained, while crown displacement is roughly doubled and each of the nine fronds now bends and flutters independently according to its orientation to the authoritative wind vector. Staggered per-frond phases prevent the crowns from moving as rigid discs, and stronger winds increase both bend and flutter rate.

Version 197 is the atmosphere-and-depth pass. ACES filmic tone mapping, a warmer and stronger directional sun, cooler hemisphere fill and deeper custom terrain shading improve light hierarchy without post-processing. The range shader now carries subtle broad cloud shadows, additional near-to-far cooling and stronger aerial perspective while retaining the v195 wind bands. Fog begins slightly earlier, and a depth-tested translucent horizon veil softens the hard join between the long ground plane and the mountain bases while leaving nearer palms and course furniture crisp. Gameplay physics and visibility rules are unchanged. Browser verification covered the 390×844 tee and downrange flight, tracer readability through landing, the final result, and compact 320×568 framing; no new console errors were introduced.

Version 198 recalibrates the game around a genuine long-drive athlete. Levels 1–10 now raise maximum club speed from 130 to 157 mph, power selects the achieved club speed, and contact efficiency converts it to ball speed through a 1.47 ideal smash factor. The Long Driver adds 1.2% club speed. Speed-dependent drag keeps neutral perfect totals near 384–443 yards instead of allowing implausible 500-yard routine shots, while greater speed extends and strengthens curvature and wind exposure. Rank gates become 370/400/420/443 yards; Legend now requires three qualifying rounds in the last eight. Average-distance XP changes from `/5` to `/6` to preserve level pacing. Result cards replace the redundant Wind tile with Club speed, recognize finishes within five yards of a sideline as `Held the grid` or `Just outside`, and compact-height CSS keeps the action reachable with a personal-best badge. Deterministic v197 and v198 reports are preserved in `tests/v197-simulation-baseline.md` and `tests/v198-simulation-results.md`. Browser verification covered a poor 239-yard strike, a near-max 398-yard Level 3 drive in 10 mph diagonal wind, ball/camera visibility beyond 380 yards, result UI at 390×844, and compact 320×568 scorecard framing; no new console errors were introduced.

Version 199 responds to player feedback that the v198 meters made precise input too easy. Rank-reference power sweeps now progress from 0.78 to 0.42 seconds and accuracy edge-to-edge travel from 0.68 to 0.37 seconds. Both meters quicken another 3% per level relative to each rank, making level progression perceptible even before a promotion. Steady/Long move their 4% benefit from visible meter speed to shot dispersion, and the Legend target becomes 439 yards to keep career completion balanced. The selected simulation is recorded in `tests/v199-meter-progression-results.md`. Browser verification completed a real Rookie drive at 390x844 and confirmed the result card remains fully reachable at 320x568.

Version 200 is a restrained high-rank accuracy-meter correction after recorded Level 10 testing produced one valid drive and five visibly timed OOB misses. Pro accuracy speed changes from 7.3 to 7.1 rad/s, Legend from 8.4 to 8.0, and accuracy-only level pressure changes from 3% to 2% per level; power timing and all flight behavior remain unchanged. Effective Level 10 Pro accuracy speed is 5.4% slower than v199. The 439-yard Legend gate remains intact while the player tests whether the extra input time is sufficient. Details are in `tests/v200-accuracy-balance-results.md`. A 390x844 browser smoke test confirmed the updated build and golfer load successfully; saved progress was deliberately not reset.

Version 201 addresses intermittent frame stutter and inconsistent charge playback without changing gameplay. The expanding tube tracer samples every 3.2 metres rather than 1.8 and caps at 160 tubular segments instead of 220, substantially reducing geometry allocation and garbage-collection pressure while retaining Catmull-Rom smoothness. Palm fronds precompute their wind-facing axes rather than recalculating trigonometry every frame, and the live distance HUD updates at 12.5 Hz instead of causing a DOM write every render frame. Audio buffers now load independently, scheduled effects disconnect cleanly, and the charge sample aligns itself to the current visual sweep even after delayed decoding or tab resumption. Its playback rate can now fit the complete 0.72-second source into high-rank sweeps, and interruption uses a short fade rather than an abrupt cut. Two repeated 390x844 drives, including multiple uninterrupted charge cycles, completed successfully.

Version 202 gives an all-OOB round an intentional recovery state instead of displaying `Best drive 0 yd`. The summary reads `Round result / No drive / In the grid`, explicitly explains that every OOB counts as zero toward the round average, offers `Try another round`, and exposes the complete state through the accessible dialog title. Normal mixed-result summaries remain unchanged. A non-destructive `?roundView=oob` preview supports regression testing. Browser verification covered the special and normal summaries at 390x844 and 320x568; the primary retry action remains visible at compact height.

Version 203 makes power and accuracy meter speed independent of render performance. `animate()` now passes uncapped real elapsed time only to `updateMeters()`, while environment, swing and ball-flight systems retain the existing `.05s` stability cap. Charge requests also include the current half-sweep index so a very long frame cannot mistake a later outward charge for an earlier one. This directly addresses the recorded v202 behavior in which drive 4's charge cadence slowed roughly 16-18% without a dramatic visible stutter. A synthetic 60 ms-frame regression check advances the intended `.84s` Legend cycle by exactly `.84s` instead of the old capped `.70s`; a complete browser-controlled mobile shot reached its result card with no new runtime errors. Power, accuracy and rank difficulty constants are unchanged.

Follow-up analysis of the 62-second v203 recording `20260816-2115-57.3885081.mp4` confirms that the timing correction works: outward-charge starts averaged `.839s`, `.840s` and `.843s` across its three drives, and each accelerated sample remained about `.42s`. A separate audible inconsistency remains, however. The middle drive's charge was recorded roughly 30% quieter and slightly duller than drives 1 and 3. Its immediately following power-lock sound was attenuated too, while the later accuracy-lock sound recovered. This points to short-lived shared output ducking/level recovery rather than meter drift or a changing charge WAV. Do not revert v203 timing. The next audio pass should introduce controlled shared output dynamics or reduce the peaks that trigger downstream attenuation, then verify charge, power lock and accuracy lock together.

Version 204 routes every buffered effect, meter cue and synthesized tone through one GitHub-Pages-safe Web Audio output stage. A fast shared dynamics compressor (`-12 dB` threshold, `10 dB` knee, `8:1` ratio, `.003s` attack and `.18s` release) contains loud impact, result and reward peaks before they reach the browser/OS audio session; a `.98` master gain retains the approved charge level with modest output headroom. The charge WAV, charge gain, meter speeds and all individual SFX assignments remain unchanged. Mobile browser verification covered a complete charge → power lock → accuracy lock → impact → OOB-result sequence and the following drive's repeated charge cycles, with no new runtime errors. This pass targets the transient shared attenuation measured in the v203 recording, not the already-corrected meter cadence.

Version 205 replaces the remaining render-triggered charge restarts after analysis of the user's 82-second v204 recording `20260816-2205-33.6280020.mp4`. The recording's full cycles were correctly fixed near `.84s`, but every outward pass still began the WAV from a frame-dependent offset between roughly `22-42ms`; recorded charge levels also varied. The approved `.72s` WAV is now copied once into the first half of a double-length Web Audio buffer, with an equal silent second half for the meter's return travel. One looping source starts when power timing begins and Web Audio owns all subsequent forward/silent cycles at the rank's authoritative rate. Render frames no longer restart, seek or reschedule the cue. Power lock stops the loop with the existing short fade. The speculative v204 dynamics compressor is removed rather than retained as another variable; all sounds share a plain `.98` master gain. The charge asset, `.18` cue gain, meter difficulty and v203 wall-clock meter correction remain unchanged. Mobile verification covered long repeated cycles, lock/stop, a complete valid result and another long charge sequence after that loud result with no new runtime errors.

After FFmpeg was installed, direct 30 fps frame extraction from that same v204 recording exposed the remaining non-audio problem. The configured/full sweep timing is consistent, but the DOM marker is updated by the render loop only about every `53ms`, `55ms` and `59ms` across the three captured drives. The count of visible marker holds lasting at least `100ms` rises from 1 to 2 to 4. The marker therefore pauses and jumps more often on later shots even though zero-to-maximum duration is nominally unchanged, which reasonably feels like a different meter speed. Version 205 fixes the accompanying audio scheduling but does not yet decouple the visual power/accuracy markers from Three.js frame pacing. The next meter pass should move marker/fill travel to compositor-driven animation and calculate tap results from the same monotonic elapsed-time phase; do not change audio or rank-speed constants again for this symptom.

Version 206 decouples both meter visuals and input results from Three.js frame pacing. Power marker/fill travel and accuracy marker travel now use transform-only Web Animations, which the browser can advance on its compositor instead of waiting for the game's render loop to write `left` and `width`. Power and accuracy values are sampled from `performance.now()` at the exact lock/strike input, so a delayed render frame cannot make the game accept the last visible-frame value. Resize rebuilds the active animation at its existing monotonic phase. Delayed charge-audio startup also resamples that same clock before choosing its loop offset. Power/accuracy speeds, charge asset, audio gain, physics and progression are unchanged.

Version 207 strengthens the palm palette after player feedback that the trees looked washed out. Fronds now use deeper emerald shadows and a clearer saturated green highlight, with a restrained emissive lift so their colour survives the warm sunset grade and distance haze. Trunks are warmer and more distinct from the surrounding rough. Palm geometry, quantity, scale, wind motion, lighting, terrain and gameplay are unchanged.

Version 208 is the close-call and OOB presentation pass. As a shot approaches either sideline, only the nearest boundary gains a restrained yellow pulse; crossing outside changes it to orange and triggers compact `Line watch`, `Drifting outside`, or `Back in play` feedback as appropriate. Near the ground, the flight camera rises slightly and frames the ball with the relevant boundary instead of following the ball so tightly that the line loses context. A coloured landing ring marks close bounces. Results within five yards of a sideline gain a dedicated close-call treatment, exact inside/outside margin, and distinct restrained cue/haptics. Every OOB result now labels its number as landing distance, explicitly states that it scores zero, and carries that explanation into the progression row. Final resting position remains the authoritative legality test; scoring, physics, wind and difficulty are unchanged. Mobile verification covered a severe slice that remained visible well outside the grid and a three-yard-inside `Held the grid` finish at 390×844 and 320×568. The 20,000-shot physics harness remains unchanged and still reports 9.09% close calls in its broad distribution and 30% in the boundary/extreme-wind suite.

Version 209 removes the circular close-bounce marker after player testing showed that it looked like an unexplained target and was especially illogical when the first bounce was already OOB. Close-call drama now comes from the sideline pulse, camera framing, transient state message, result treatment and cue only. This also leaves an in-bounds bounce rolling toward OOB visually unambiguous: the moving ball and reacting line tell the story without an extra symbol.

Version 210 is an evidence-led mobile performance and camera pass. A complete v209 six-drive baseline reproduced no cumulative gameplay slowdown: all 3,290 flight frames stayed below 33 ms, but first-load golfer parsing produced 2.72 seconds of long tasks and the 54.5 MB FBX left the run near 91.6 MB heap. The untouched FBX was converted at 30 fps and only its embedded 4K/2K runtime textures were reduced; the resulting `golf-drive-runtime-optimized.glb` is 6.65 MB (87.8% smaller). An exact `1.20s` comparison and a real drive confirmed matching animation, grip, club and impact alignment. The converted hair cards are hidden because FBX2glTF cannot preserve their proprietary transparency channel and otherwise creates an opaque black shell. The source remains selectable with `?golferView=source`, and legacy remains `?golferView=legacy`. In the final six-drive run, startup long-task time fell to `.913s`, heap ended at `19.29 MB`, 3,325 flight frames averaged `16.66ms` with one `33.4ms` frame, and result screens had no frames over 33 ms. Hidden 3D work now pauses under result/reward panels and after the camera leaves the tee. Extreme-OOB framing keeps the camera near the sideline, aims between line and ball, and uses a modest presentation-only ball scale for portrait readability. Full evidence and rebuild steps are in `tests/v210-performance-camera-audit.md`.

Version 211 begins the final branding integration. The document title, description and game-region label now identify Sloppy Golf, and the approved transparent wordmark appears on the main menu above the existing slogan. The previous CSS-drawn menu ball was replaced with `media/branding/menu-golf-ball.svg`: a smooth circular vector ball with a dense symmetrical set of clipped, inward-shaded dimples. The EverElms Studio link remains distinct at the top of the menu card. The index-page launch treatment has not yet been changed.

Version 212 corrects the title-card hierarchy after player review. The Sloppy Golf wordmark is wider and more prominent, while the two-line `Step up. Send it.` slogan is smaller supporting copy. `Playable blockout · Version 0.1` is now `Beta Version 1.0`, and the bottom control-instruction line has been removed. All former yellow accents on this title card—the EverElms monogram tile, beta badge, `Send it.` line and primary start button—now use the EverElms green family; the button has a restrained light-to-dark green gradient. Yellow remains elsewhere in gameplay UI until each screen receives its own palette review.

Version 213 adds the user-supplied 30.77-second `golfMusic.mp3` as `media/audio/golf-music.mp3`. It starts only after a pointer/keyboard interaction, loops through Web Audio, fades in at a deliberately low `.10` linear gain, ducks to `.045` during the power charge and `.025` around club impact, then recovers smoothly. The existing Sound button controls both music and effects and now has accurate combined-audio accessibility labels. Effects and music use separate gain buses beneath the existing master output. The driver impact rises from `.9` to `1.2` gain; a perfect 100% shot now always plays that physical strike and layers the `onehundred.mp3` call at `1.18` after a `.045s` delay instead of replacing the impact. The copied source decodes correctly, is 744,609 bytes, runs 30.772 seconds and remains suitable for GitHub Pages static hosting. Player listening approval is still required for loop seam, long-session fatigue, music level, ducking and impact balance.

Version 214 responds to the first listening pass by moving music decisively into the background. Its constant linear gain is now `.018`—lower than even v213's deepest `.025` impact-duck level—and all charge/impact ducking logic has been removed. The track still fades in over `.8s`, loops, and follows the combined Sound toggle. Effects remain unchanged and fully foregrounded. Player approval is still required for this near-ambient level and the loop seam.

Version 215 is based on the player's `20260819-0118-01.0918064.mp4` recording rather than inference. A 15 fps extraction around the swing showed the golfer progressively dropping below frame, disappearing almost completely for roughly two-tenths of a second during the downswing, then snapping back before contact. The cause was `applyLongDriveLowerBody()` subtracting `2.8` in skeleton-local units: that represented a subtle ~`.14` world-unit compression on the source FBX but became a catastrophic 2.8-unit drop on the metre-scale optimized GLB introduced in v210. The correction converts a fixed `.14` world-space compression through the hips parent's measured world scale, preserving the intended squat across either asset. Music falls another 3.52 dB from `.018` to `.012` linear gain. A runtime-generated 1.4-second equal-power overlap now blends the decoded track tail into its head and loops the resulting 29.372-second buffer. Sample-boundary analysis reduced the raw end/start discontinuity from `.009825` to `.001114`; no new static audio asset was needed.

Version 216 removes perceived music-volume changes. Analysis of 304 active momentary-loudness windows found the source ranged from `-26.7` to `-9.1` LUFS, with its quiet sustained fifth percentile at `-21.9` LUFS. `media/audio/golf-music-leveled.mp3` is a downward-only derived mix: compression and a final `-1.8 dB` trim put its absolute loudest window at exactly `-21.9` LUFS, while its median is `-26.0` and nothing quiet is boosted. Runtime gain remains `.012`. The 1.4-second loop overlap changes from equal-power to linear, preventing the possible +3 dB correlated-material swell at the seam. The original copied `golf-music.mp3` remains preserved alongside the leveled runtime file.

Version 217 immediately retires the v216 processed runtime mix after the player's `20260819-0140-50.5831769.mp4` recording exposed obvious pumping while nothing else was happening. The mistake was downward dynamic compression: although it never boosted quiet material, it continuously changed attenuation with the track content and directly violated the request for one playback volume. Runtime returns to the untouched `golf-music.mp3` at one fixed `.008` gain. The music gain has no automation, fade, ducking, compression or state-based changes; it is assigned once before the source starts and remains unchanged until the user toggles sound. The 1.4-second linear sample blend remains inside the constructed loop buffer and does not automate output gain. `golf-music-leveled.mp3` remains only as an unused diagnostic derivative and must not be restored to `AUDIO_ASSETS`.

Version 218 replaces the previous music entirely with the user-supplied `Late_Afternoon_Transit.mp3`, copied as `media/audio/late-afternoon-transit.mp3`; the Downloads source remains untouched. Both prior project files, `golf-music.mp3` and `golf-music-leveled.mp3`, were removed at the user's direction. Half-second RMS inspection confirmed the new track is steadier through most of its 30.772-second runtime and begins fading around 29 seconds. Runtime therefore stops at 28.5 seconds, omitting 2.272 seconds of fade, and uses a brief `.18s` linear sample blend instead of the former 1.4-second overlap. The resulting loop is 28.320 seconds. Boundary discontinuity falls from `.046366` at a raw 28.5-second cut to `.004234` with the short blend. Playback remains one fixed `.008` gain with no attenuation or automation.

Version 219 removes loop blending entirely after the player's 45.89-second `20260819-0207-40.6582478.mp4` recording showed the music becoming quiet immediately before the 28.32-second blended-buffer reset and returning at the boundary. The game now plays the untouched decoded `late-afternoon-transit.mp3` buffer directly, with native `AudioBufferSourceNode` looping from `0` to `28.5s`. There is no constructed overlap buffer, crossfade, gain ramp, ducking, compression, normalization or gameplay-driven adjustment. Music gain is set once to `.008` before the source begins and changes only when the user explicitly toggles sound. A harder seam is accepted to eliminate any remaining blend-induced dip.

Version 220 closes two reported OOB collision gaps. The two visible near-side dodecahedron hills were previously absent from `terrainHeightAt()`, so the berm collision could be correct while the ball still passed under those separate meshes. `HILL_SETTINGS` now drives both rendering and a conservative ellipsoid height envelope, and terrain height takes the maximum of berm and hill surfaces during flight, bounce, roll, particle placement and camera framing. Palms now retain their actual trunk meshes as collision references. Ball motion is swept at adaptive `.32m` samples (maximum 12 per frame) against each nearby animated trunk capsule and crown sphere to prevent high-speed tunnelling. Trunk hits reflect with `.58` restitution and `.72` energy retention; canopy hits use `.34` and `.62`. Either collision cancels remaining shot-curve velocity, adds a short wood cue/vibration and has a `.13s` repeat-contact cooldown. Rolling balls use the same swept collision path. Static syntax/cache checks pass; targeted mobile playtesting of direct trunk, canopy and severe-OOB hill strikes remains required.

Version 221 corrects the severe-OOB camera using the player's `20260819-0246-20.2034018.mp4` recording. Frame sampling showed the old `boundaryX + side * 3` camera entering the outer palm row around 300–320 yards; a canopy filled the frame while the target continued favouring the boundary midpoint rather than the ball. The severe-miss camera now stays 7.5m on the in-bounds side of the sideline, rises an additional 2m at full OOB follow, and reduces maximum trailing distance from 36m to 30m. Its target moves 28% from the line/ball midpoint toward the ball and reduces look-ahead toward 4.5m, keeping the miss visible without erasing boundary context. Presentation scale gains up to `.45` on severe misses. A slightly larger white `MeshBasicMaterial` shell, with depth testing disabled and maximum airborne opacity `.58`, provides a restrained visibility fallback when foliage or terrain briefly crosses the sightline; it does not affect the physical ball or collision radius.

Version 222 standardizes every panel primary button on the approved title-card EverElms gradient: `#b8e83c` → `#97cc04` → `#82b600`, with dark navy text and the same restrained green shadow. This covers Next Drive, Drive Again, Continue, View Round Summary, Play Another Round and all other `.panel .primary-button` actions. Gameplay feedback yellows remain unchanged.

### Current audio inventory and assignments

All active supplied effects live in `media/audio/`:

- `charge-up-pulses.wav` — power meter only; accelerating brightening pulses while travelling outward, silent on return, gain `.18`.
- `accuracy-center-ping.wav` — accuracy meter only; one 62 ms rising pip at each exact centre crossing in either direction, gain `.16`.
- `accuracy-focus-pulses.wav` — preserved v193 accuracy experiment; currently inactive.
- `charge-up.mp3` — preserved previous charge source; currently inactive.
- `power-lok.mp3` — ordinary power and accuracy locks, gain `.32`.
- `driver-impact.mp3` — ordinary club/ball impact, gain `.9`.
- `onehundred.mp3` — replaces ordinary impact at contact when displayed power is 100% and accuracy is Perfect, gain `1.35`.
- `valid-drive.mp3` — successful in-bounds result, gain `.68`, capped at `.95s` with fade.
- `out-of-bounds.mp3` — OOB result, gain `.68`.
- `personal_best.mp3` — new personal best, gain `.76`, delayed `1.08s` so it follows the valid-drive cue.
- `level-up.mp3` — numbered Level Up reveal, gain `.7`.
- `rank-up.mp3` — Amateur/Crusher/Pro/Legend reveal, gain `.7`.
- `new-club.mp3` — Steady or Long Driver unlock reveal, gain `.75`.

Landing/bounce sounds and the sound-on confirmation are still synthesized tones. The superseded `lock_in.mp3` project copy was deliberately removed. Source files in Downloads were never modified or deleted.

Version 87 adds a dedicated driver-unlock reveal before the round summary. It shows a large rendered preview, the driver name and its gameplay benefits, and explicitly says the club is ready for the next round. A six-drive round always finishes with the driver it started with; newly unlocked drivers take effect on the following round.

Version 88 separates end-of-round information into a conditional reward sequence: Level Up, Driver Unlocked, Rank Up, then Round Summary. Screens are skipped when their reward was not earned. The summary no longer repeats rank and driver celebration cards, and next-rank requirements are collapsed by default behind a compact disclosure row.

Version 89 refines the driver reveal into a clean product presentation. It live-renders the actual procedural driver on a blank background with a Steady-yellow or Long-orange halo, reduces the name size, removes stat/equipment cards, and states plainly that the driver is automatically equipped next round.

Version 90 gives the unlock render its own product-display pose instead of cloning the in-hand address rotation, preventing the crown, face, hosel and accents from overlapping edge-on. The preview field now uses a subtle cool-grey gradient while retaining the driver-color halo.

Version 91 corrected the earlier procedural preview assembly by applying one rigid group rotation. Version 92 supersedes that presentation with the imported GLB itself, so gameplay and unlock views use the same authoritative object.

Generated preview assets:

- `media/driver-training-preview.png`
- `media/driver-steady-preview.png`
- `media/driver-long-preview.png`
- `media/driver-club-preview.png` (earlier proof render)

The user has now genuinely reached a driver unlock and confirmed that the dedicated reward card appears. Version 171 adds its missing sound. The remaining progression verification is to confirm during ordinary play that the newly unlocked Steady or Long Driver becomes the in-hand club only when the following round begins.

## Golfer, swing and club attachment

Golfer assets:

- `media/golf-drive-runtime-optimized.glb` — current default optimized human golfer and authored swing.
- `media/golf-drive-alternate.fbx` — untouched source golfer, selectable with `?golferView=source`.
- `media/golf-drive.fbx` — preserved legacy Mixamo fallback, selectable with `?golferView=legacy`.

Critical lessons from previous iterations:

- Do not restore the old procedural/stick golfer.
- Do not extrapolate the club from the forearm.
- Do not pin the clubhead to the ball while the hands animate.
- Do not use the old `2.8s` animation endpoint; it created a visible double swing.

Current swing timing:

- Impact clip time: `1.20s`.
- First held finish: `1.75s`.
- One shot must contain one continuous backswing, one impact and one held finish.

Current club attachment:

- Normal gameplay uses the user-supplied rigid GLB, split into Grip, Shaft, Hosel, Crown, Face and Sole material regions.
- The older Three.js procedural geometry remains only as a load-failure fallback.
- Right-hand bone supplies the rigid wrist quaternion for the entire authored swing.
- Middle-finger base bones (`mixamorigRightHandMiddle1` and `mixamorigLeftHandMiddle1`) anchor the grip inside the fists; hand bones are fallbacks.
- The left and right finger anchors determine the shared grip position.
- The imported model is normalized from its butt end in scaled model space; do not move the anchor back to the grip midpoint.

The user supplied this low-poly club reference:

- `C:\Users\jiann\Downloads\1786228270496.png`

The user also used this real swing reference:

- `https://www.youtube.com/shorts/9nhFobbdJxQ`

The most recent close-up video showed a brief grip separation because Mixamo hand-bone origins are at the wrists. Version 83 moved the anchor into the fists using the middle-finger base bones. Version 86 retains this fix across all driver variants.

When changing the club or swing, verify frame-by-frame:

1. Address: grip visibly passes through both hands and head rests behind/beside the ball.
2. Early backswing: grip remains inside fists.
3. Top of backswing: shaft, grip, hosel and head remain one rigid object.
4. Impact: occurs once and is synchronized with the impact sound/ball launch.
5. Follow-through: club moves with the wrist and holds the first finish.

## Visual direction and scenery

- Sunset gradient sky in peach, gold and pink.
- Low-poly faceted range and surrounding green berms.
- Stylized palm trees with broad tapered polygon fronds.
- EverElms blue/yellow tournament markers.
- Beige beveled tee platform extending to the screen edges.
- Green hitting mat is inset and must not be widened to the platform edges.
- Side scenery continues down both sides of the range.
- The polished range uses saturated fairway/rough/berm greens, stable raised ribbon markings, denser terrain-rooted palms and two distant low-poly mountain layers.
- Avoid isolated giant dodecahedron hills; they created unnatural protrusions during flight.

## Mobile/UI decisions

- Portrait-first layout.
- Full-screen start menu rather than a permanent white header.
- Start is disabled until the FBX model finishes loading.
- Start menu contains Sound, Reset progress and Exit.
- Round number briefly appears before each drive using the distance-style white type.
- XP bar is colorful and segmented.
- Round summary is intentionally compact:
  - Six drives in a two-column table.
  - Best drive highlighted blue/yellow.
  - Only round average and XP as summary statistics.
  - Plain-language next-rank requirements.
  - Play another round and Main menu controls.
- The user considered earlier round summaries too busy; avoid reintroducing redundant statistics.

Test important changes at minimum at:

- 390 × 844.
- 360 × 800.
- 320 × 568.
- A wider approximately 680 × 887 view used in several user screenshots.

## Testing harnesses

Portable FFmpeg 9.0.1 essentials is installed locally at `C:\Users\jiann\AppData\Local\Programs\FFmpeg\bin`. Both `ffmpeg.exe` and `ffprobe.exe` were verified on 2026-08-16, and that `bin` directory is present in the user's persistent PATH. Existing terminals or long-running app processes may need to restart before resolving the new PATH entry; tools can use the absolute executable paths immediately. Use FFmpeg/FFprobe for future supplied-video timing, frame and audio analysis instead of the earlier VLC extraction workaround.

- `tests/long-drive-physics-harness.js`
- `tests/long-drive-progression-harness.js`

Both harnesses are deterministic and run directly in Node without opening a browser. From the repository root:

```powershell
node tests/long-drive-physics-harness.js
node tests/long-drive-progression-harness.js
```

If `node` is not on `PATH` in Codex, use the bundled executable at `C:\Users\jiann\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`.

### Physics validation

The physics harness mirrors the launch and flight equations in `long-drive.js`. With seed `0xE7E1A5`, it simulates 20,000 shots on a range with a 29.7-yard half-width:

| Scenario | Shots | Valid | Average distance | Average lateral error | 95th percentile lateral error |
| --- | ---: | ---: | ---: | ---: | ---: |
| Broad distribution | 10,000 | 79.69% | 242.4 yd | 15.2 yd | 48.6 yd |
| Near-perfect | 4,000 | 100.00% | 362.2 yd | 2.8 yd | 7.3 yd |
| Severe hooks | 2,000 | 21.80% | 268.5 yd | 38.9 yd | 58.4 yd |
| Severe slices | 2,000 | 19.80% | 269.7 yd | 39.2 yd | 57.2 yd |
| Boundary timing plus extreme wind | 2,000 | 58.10% | 301.8 yd | 26.5 yd | 45.4 yd |

Additional directional checks from that run:

- All 472 extreme hooks and all 497 extreme slices finished out of bounds.
- No severe hook finished right and no severe slice finished left.
- No near-perfect shot went out of bounds; 85 of 4,000 were classified as a minor Draw or Fade rather than Straight.
- Severe hooks average 0.49 yards right at 50 yards, cross to 2.41 yards left by 100 yards and finish 38.87 yards left; severe slices mirror that progression at 0.49 yards left, 2.47 yards right and 39.21 yards right.
- Pure left and right crosswinds retain the expected opposite displacement at 100 yards, confirming that wind remains independent of shot-spin curvature.
- The boundary-plus-extreme-wind suite now produces 30.00% close calls within five yards of a sideline.

### Progression validation

The progression harness uses seed `0x1E6E0D`. It first generates 1,000 exact physics shots for every player-skill/rank/level/driver combination, then samples 5,000 careers for each of four skill profiles. Each career is capped at 50 six-drive rounds, with 1.5 minutes assumed per round. It uses the current round-average XP system, driver bonuses and rank requirements.

| Player profile | Reached Legend within 50 rounds | Median rounds among achievers | Median drives | Estimated median play time |
| --- | ---: | ---: | ---: | ---: |
| Recreational | 2.44% | 46 | 276 | 1.15 hr |
| Developing | 15.06% | 42 | 252 | 1.05 hr |
| Skilled | 59.40% | 37 | 222 | 0.93 hr |
| Expert | 99.82% | 26 | 156 | 0.65 hr |

Median promotion rounds and the percentage of all simulated careers reaching each rank were:

| Profile | Amateur | Crusher | Pro | Legend |
| --- | ---: | ---: | ---: | ---: |
| Recreational | R4 / 100% | R14 / 100% | R28 / 99.96% | R46 / 2.44% |
| Developing | R3 / 100% | R10 / 100% | R21 / 100% | R42 / 15.06% |
| Skilled | R2 / 100% | R8 / 100% | R16 / 100% | R37 / 59.40% |
| Expert | R2 / 100% | R7 / 100% | R13 / 100% | R26 / 99.82% |

The v200 correction preserves the v199 visible-risk design but gives Level 10 Pro players 5.4% more accuracy-meter time. Skilled Legend completion rises from 50.96% to 59.40%; the exact Level 10 Pro state remains demanding at 64.6% valid. Details are in `tests/v200-accuracy-balance-results.md`.

### Interpretation and maintenance

These are model-validation tests, not full browser tests. They can catch implausible distances, inadequate hook/slice penalties, wind-direction errors, impossible rank gates and progression that is too fast or too slow. They do **not** validate the golfer animation, club attachment, camera movement, visual terrain collisions, sound timing, responsive layout or mobile performance; those still require browser playtesting.

Because the harnesses mirror parts of `long-drive.js` rather than importing one shared physics module, they can drift out of sync. Whenever physics, wind, range width, XP, rank gates, meter behavior or driver bonuses change, update the matching harness and rerun both reports. The figures above were reproduced on 2026-08-16 against the current `v=210` working tree.

## Primary files

- `sloppy-golf/index.html` — game markup and result/round UI.
- `sloppy-golf/long-drive.css` — responsive/mobile presentation.
- `sloppy-golf/long-drive.js` — Three.js scene, golfer/club, game state, physics, XP and rank logic.
- `sloppy-golf/media/golf-drive.fbx` — animated Mixamo golfer.
- `sloppy-golf/media/golf-drive-runtime-optimized.glb` — default 6.65 MB runtime golfer.
- `sloppy-golf/media/golf-drive-alternate.fbx` — untouched 54.5 MB user-supplied source; retained for visual comparison and rebuilding.
- `sloppy-golf/media/golf-club-driver-source.glb` — untouched user-supplied club source.
- `sloppy-golf/media/golf-club-driver.glb` — derived six-material rigid club used by the game.
- `sloppy-golf/media/branding/sloppy-golf-logo.svg` — standalone path-based Sloppy Golf wordmark with vector ball and tee.
- `sloppy-golf/media/branding/menu-golf-ball.svg` — smooth-edged decorative menu ball with clipped inset dimples.
- `sloppy-golf/media/audio/late-afternoon-transit.mp3` — current user-supplied background track; v218 loops its steady pre-fade section at one fixed gain.
- `sloppy-golf/media/branding/everelms-symbol.svg` — standalone interlocking EverElms symbol.
- `sloppy-golf/media/branding/everelms-studio-logo.svg` — approved transparent three-layer EverElms Studio lockup with smooth E/S paths, Oxanium ExtraBold `EVERELMS`, and Sora Medium `STUDIO`, all converted to outlines.
- `tools/split-golf-club.py` — reproducible source-to-game material-region split.
- `tests/long-drive-physics-harness.js` — large-volume shot tests.
- `tests/long-drive-progression-harness.js` — progression/Legend simulations.
- `tests/v197-simulation-baseline.md` — preserved pre-recalibration comparison.
- `tests/v198-simulation-results.md` — selected speed/risk/progression comparison.
- `tests/v199-meter-progression-results.md` — selected visible meter-speed and career-balance comparison.
- `tests/v200-accuracy-balance-results.md` — Level 10 Pro accuracy-only correction and exact-state validation.
- `tests/v210-performance-camera-audit.md` — complete FBX/GLB mobile frame-pacing, memory and camera comparison.
- `tests/v223-competition-driver-harness.js` — deterministic Level-10 unlock and Legend comparison for the Competition Driver.
- `tests/v223-competition-driver-results.md` — selected 3.5% multiplier results and interpretation.
- `tests/v229-release-audit-harness.js` — saved-data, reward-order, following-round equipment, terrain-sweep, tree-sweep and obstacle-camera regressions.
- `tests/v229-release-audit.md` — combined code/performance/progression/extreme-shot findings and current evidence limits.
- `tools/optimize-golfer-glb.py` — reproducible embedded-texture reduction after 30 fps FBX2glTF conversion.
- `index.html` and `prototype.css` — existing EverElms website and hooks for launching the game.

## Recommended next steps

Current player feedback to retain before the next balancing pass:

- The player achieved Legend legitimately at Level 10 but found the final grind boring and strongly wind-gated. Version 223 addresses this with the earned Competition Driver: a perfect Level-10 strike now clears 439 yards across every simulated 5 mph wind direction, while the existing three-round Legend requirement remains. Playtest the actual late-game feel before revisiting structured wind rounds.
- The v201 power-charge slowdown was reproduced and measured from the 122-second `20260816-2042-39.6418945.mp4` recording, then fixed in v203. Repeated outward-charge starts had averaged roughly `.89-.91s` apart on drive 1, `1.05s` on drive 4, `.90s` on drive 5 and `.99s` on drive 6 even though each pulse sample remained `.42s`. The cause was the render delta cap slowing the whole meter cycle below 20 fps. The v204 follow-up proved that correct full-cycle timing was not sufficient because render frames still selected inconsistent starting offsets inside each WAV pass. Version 205 removes those repeated render/audio synchronization points entirely, and v206 moves visual travel to compositor animation while input samples an authoritative monotonic phase. Retain the separate physics/environment cap, wall-clock input phase and single looping Web Audio charge timeline; do not return to per-frame marker writes or charge restarts.
- Version 208 implements the deferred close-call camera, boundary, audio and result feedback. Retain the five-yard threshold and final-resting-position legality rule unless playtesting shows a specific issue.
- Deferred retention discussion: the user has an idea for encouraging longer play sessions and explicitly asked to be reminded later.

Versions 210 and 229 now cover the code, performance lifecycle, progression sequencing and extreme-shot collision/camera audit. The player also completed a current beginning-to-Legend session without observing cumulative slowdown. The v229 browser controller could not attach, so the report deliberately retains v210 as the latest exact live frame-time capture instead of inventing new telemetry; per-drive resource snapshots are now available through `?diagnostics=1` when a future live comparison is needed.

The next work is **release preparation**, but the user explicitly asked the v229 task to stop after the extreme-shot stage. Do not begin release work until asked. That future pass should finish naming/copy and the index-page launch treatment, verify the already optimized golfer asset, test GitHub Pages from a clean load, check sound/music controls and test common phones.

Before release preparation, have the player judge the v229 severe-miss camera and swept OOB terrain fix during ordinary play. Do not add music crossfading, ducking, compression, normalization or playback gain automation. The deferred extended-play-session idea still needs to be revisited before release.

## New-conversation kickoff prompt

Use this text in the new Codex conversation:

> Continue development of Sloppy Golf in `C:\Users\jiann\OneDrive\Documents\Website\sloppy-golf`. First read `C:\Users\jiann\OneDrive\Documents\Website\LONG_DRIVE_HANDOFF.md` completely, inspect `git status --short` and the current files, then open and play the current v231 build. Summarize your understanding before changing anything. Preserve all existing uncommitted work and continue incrementally with mobile-first testing.
