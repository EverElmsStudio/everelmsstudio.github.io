# v210 mobile performance and camera audit

Date: 2026-08-16
Viewport: 390×844
Mode: `?diagnostics=1`
Browser-controlled input: six complete drives per full-round sample

## Baseline: v209 default FBX

- Runtime golfer: `golf-drive-alternate.fbx`, 54,488,352 bytes.
- Initial loading: 4 long tasks totaling 2,720 ms; worst observed frame interval 609.1 ms.
- Six-drive flight: 3,290 frames, 16.65 ms average, 24.6 ms maximum, 0 frames over 33.34 ms.
- Power/accuracy/striking: 0 frames over 33.34 ms.
- Result state: 3,699 frames, 16.98 ms average, 49.8 ms maximum, 23 frames over 33.34 ms.
- End-of-run heap: 91.6 MB.
- End-of-run renderer memory: 174 geometries, 13 textures.

Conclusion: no cumulative meter or flight slowdown was reproduced. Startup asset parsing and unnecessary rendering behind result/reward panels were the measurable costs.

## v210 changes

- Converted the untouched FBX to 30 fps binary glTF and reduced only its embedded runtime textures (4096→1024 and 2048→512). The runtime GLB is 6,645,904 bytes, an 87.8% reduction. The source FBX remains untouched and available through `?golferView=source`; the original legacy golfer remains available through `?golferView=legacy`.
- Exact 1.20-second frame comparison confirmed matching stance, skeleton pose, grip, club attachment, and impact alignment. A real swing completed through flight and result.
- The converter cannot preserve Character Creator's proprietary hair `TransparentColor` channel. Converted opaque hair cards are therefore hidden, retaining the cleaned scalp presentation rather than introducing a black shell.
- Main-scene rendering and golfer attachment work pause behind result/reward/round panels. Golfer attachment also stops once the flight camera has left the tee.
- The severe-miss camera remains near the authoritative sideline, targets the midpoint between line and ball, and moves farther back only as needed. A presentation-only ball scale preserves portrait-screen readability without changing collision or physics.

## Final v210 six-drive result

- Runtime golfer: `golf-drive-runtime-optimized.glb`, 6,645,904 bytes.
- Initial loading: 3 long tasks totaling 913 ms, a 66.4% reduction in measured long-task time.
- Six-drive flight: 3,325 frames, 16.66 ms average, 33.4 ms maximum, 1 frame over 33.34 ms.
- Power/accuracy/striking: 0 frames over 33.34 ms.
- Result state: 3,780 frames, 16.66 ms average, 32.1 ms maximum, 0 frames over 33.34 ms.
- End-of-run heap: 19.29 MB, 78.9% below the baseline sample.
- End-of-run renderer memory: 169 geometries, 11 textures.
- Level 2 reward and round-summary sequence completed normally after the sixth drive.

The diagnostics collector is inert unless the URL includes `?diagnostics=1`. It reports frame pacing by game state, long tasks, section timings, heap, and renderer counts through the hidden `#performance-diagnostics` output.

## Rebuilding the runtime golfer

1. Download the official Godot FBX2glTF Windows release and run version 0.13.1 with `--binary --anim-framerate bake30`, using `media/golf-drive-alternate.fbx` as input and `media/golf-drive-runtime` as output.
2. Run `tools/optimize-golfer-glb.py` with the bundled Python runtime/Pillow.
3. Verify address and `?swingTime=1.2` against `?golferView=source`, then complete a real drive before updating the runtime asset version.

Converter: https://github.com/godotengine/FBX2glTF
