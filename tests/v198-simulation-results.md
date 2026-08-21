# EverElms Long Drive v198 simulation results

The v198 harnesses use the same deterministic seeds as the preserved v197 baseline in `tests/v197-simulation-baseline.md`.

## Physics comparison

| Suite | v197 valid | v198 valid | v197 average | v198 average | v198 close calls within 5 yd |
| --- | ---: | ---: | ---: | ---: | ---: |
| Broad distribution | 83.41% | 79.69% | 221.61 yd | 242.44 yd | 9.09% |
| Near-perfect | 100.00% | 100.00% | 336.57 yd | 362.22 yd | 0.00% |
| Severe hooks | 32.20% | 21.80% | 246.50 yd | 268.50 yd | 26.95% |
| Severe slices | 29.55% | 19.80% | 248.47 yd | 269.67 yd | 26.55% |
| Boundary plus extreme wind | 69.20% | 58.10% | 277.68 yd | 301.75 yd | 30.00% |

At neutral wind and perfect input, total distance progresses from approximately 384 yards at Level 1 to 443 yards at Level 10, with the Long Driver active from Level 7. Extreme hooks and slices remain 100% OOB, and no near-perfect shot went OOB.

## Progression comparison

The selected gates are 370, 400, 420 and 443 yards. Legend requires three qualifying rounds in the last eight; the other ranks continue to require two. Zero-inclusive average-distance XP now uses `floor(average / 6)` so the larger yardages do not accelerate level progression.

| Timing profile | v197 Legend | v198 Legend | v197 median rounds | v198 median rounds |
| --- | ---: | ---: | ---: | ---: |
| Recreational | 1.36% | 2.24% | 41 | 41 |
| Developing | 20.08% | 22.06% | 35 | 39 |
| Skilled | 48.78% | 48.40% | 31 | 36 |
| Expert | 92.90% | 98.76% | 23 | 27 |

The completion likelihood remains close to the old curve for the three central timing profiles, while median completion takes 11–17% longer for developing through expert players. This avoids the old near-lottery 363-yard Legend gate while making sustained elite performance more important.
