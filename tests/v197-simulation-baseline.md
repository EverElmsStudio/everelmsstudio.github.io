# EverElms Long Drive v197 simulation baseline

Deterministic seeds:

- Physics: `0xE7E1A5`, 20,000 shots
- Progression: `0x1E6E0D`, 2,000 exact shots per profile/rank/driver cell and 5,000 careers per profile
- Career cap: 50 six-drive rounds

## Physics

| Suite | Valid | Average total | Average carry | Average ball speed | Average absolute lateral |
| --- | ---: | ---: | ---: | ---: | ---: |
| Broad distribution | 83.41% | 221.61 yd | 173.35 yd | 132.85 mph | 13.05 yd |
| Near-perfect | 100.00% | 336.57 yd | 300.33 yd | 170.35 mph | 2.56 yd |
| Severe hooks | 32.20% | 246.50 yd | 202.91 yd | 144.10 mph | 35.13 yd |
| Severe slices | 29.55% | 248.47 yd | 204.36 yd | 144.55 mph | 35.73 yd |
| Boundary plus extreme wind | 69.20% | 277.68 yd | 236.95 yd | 154.38 mph | 23.42 yd |

The grid half-width is 29.75 yards. Near-perfect shots produced no OOB results.

## Progression

| Timing profile | Legend within 50 rounds | Median rounds among completions | Median drives |
| --- | ---: | ---: | ---: |
| Recreational | 1.36% | 41 | 246 |
| Developing | 20.08% | 35 | 210 |
| Skilled | 48.78% | 31 | 186 |
| Expert | 92.90% | 23 | 138 |

Baseline qualification targets are 325, 345, 352 and 363 yards. The exact raw output was captured in the Codex task immediately before the v198 model work; this compact file preserves the comparison values without committing a large generated artifact.
