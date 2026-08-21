# v229 code, performance, progression, and extreme-shot audit

Date: 2026-08-20

## 1. Code review

- JavaScript syntax passes.
- Existing tracer geometry is disposed on rebuild/reset; turf and wind particles remain fixed-size arrays.
- Main-scene rendering remains paused behind result/reward/summary panels.
- Normal loads no longer build and print the full golfer bone/mesh inventory; those logs are limited to diagnostics/source preview modes.
- Stored best, XP, rank, round count, and round history are validated before use so corrupt browser data cannot propagate `NaN` or a non-array history into progression.
- All existing uncommitted work was preserved.

## 2. Six-drive performance audit

The authoritative live-browser baseline remains the v210 six-drive audit at 390×844:

- 3,325 flight frames averaged 16.66 ms.
- One flight frame exceeded 33.34 ms, at 33.4 ms.
- Result screens had no frames over 33 ms.
- End heap was 19.29 MB.
- Renderer memory ended at 169 geometries and 11 textures.

The player subsequently completed a current-build beginning-to-Legend session without observing cumulative slowdown. Review of changes since v210 found no unbounded gameplay collection: tracer geometry is replaced/disposed, turf/wind particles are fixed, audio nodes disconnect on completion, and panels pause hidden 3D work. The new v229 diagnostics capture per-drive geometry, texture, render-call, tracer-point, and heap snapshots for future live comparisons.

The browser controller could not connect during this audit because its local helper failed before page attachment. No new v228/v229 frame-time numbers are claimed. As a bounded CPU check for the new OOB work, 250,000 terrain evaluations completed in 32–95 ms on the local Node runtime depending on concurrent test load; only extreme lateral shots perform the added sightline sampling.

## 3. Progression verification

The deterministic sequence test passes:

1. Level 3 reveal
2. Steady Driver reveal
3. Amateur rank reveal
4. Round Summary

The Training Driver remains authoritative for the full unlocking round. Steady is selected only by the following `startRound()` call. The Level 10 challenge follows the same contract: Long remains active through the 325+ yard-average unlock round and Competition is selected for the following round.

The existing 20,000-shot physics harness, 20,000-career progression harness, and 15,000-career Competition Driver harness also pass unchanged.

## 4. Extreme-shot collision and camera verification

- Added adaptive swept terrain collision for OOB flight. It catches a reproducible 3.4-metre hill-crest crossing that endpoint-only checks can miss.
- Verified 19 berm continuity/mirroring conditions, including a zero-height outer apron boundary.
- Verified `.32m` adaptive sampling catches a trunk/canopy contact at maximum realistic per-frame travel.
- Severe-miss camera framing now checks the camera-to-ball corridor. It first changes the viewing angle toward the range interior to look around a blocking palm, then adds only the terrain/canopy lift still required.
- Corrected the normal partial-follow calculation to remain centred on the authoritative lane rather than world X=0.
- Ball physics, wind, scoring boundaries, shot dispersion, rank requirements, and driver bonuses are unchanged.

Regression harness:

```powershell
node tests/v229-release-audit-harness.js
```

Result: `pass`.
