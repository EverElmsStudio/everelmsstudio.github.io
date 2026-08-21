# v199 meter-progression results

Seed: `0x1E6E0D`

The v199 tuning keeps the v198 flight physics intact and moves the added difficulty into the visible power and accuracy meters. Rank reference timings are:

| Rank | Power sweep | Accuracy rate | Accuracy edge-to-edge |
| --- | ---: | ---: | ---: |
| Rookie | 0.78 s | 4.6 rad/s | 0.68 s |
| Amateur | 0.68 s | 5.4 rad/s | 0.58 s |
| Crusher | 0.58 s | 6.3 rad/s | 0.50 s |
| Pro | 0.49 s | 7.3 rad/s | 0.43 s |
| Legend | 0.42 s | 8.4 rad/s | 0.37 s |

Meters quicken by another 3% per level relative to each rank's reference level, so difficulty advances even when a player levels up before earning the next promotion. Steady and Long no longer slow the visible accuracy meter; both calm the resulting shot dispersion by 4% instead. This preserves a readable equipment benefit without concealing the intended timing progression.

## Representative in-bounds rates

| Profile | Rookie | Amateur | Crusher | Pro | Legend |
| --- | ---: | ---: | ---: | ---: | ---: |
| Recreational | 72.4% | 64.8% | 54.0% | 44.5% | 40.8% |
| Developing | 86.0% | 80.6% | 66.5% | 58.5% | 45.6% |
| Skilled | 96.4% | 93.2% | 84.3% | 72.3% | 61.4% |
| Expert | 99.9% | 100.0% | 97.9% | 93.1% | 82.6% |

For a skilled timing profile, the chance of seeing at least one OOB in a six-drive round is approximately 20% at Rookie, 34% at Amateur, 67% at Crusher, 86% at Pro and 97% at Legend. Perfect inputs remain deterministic and safe; the additional misses come from the meters being harder to stop precisely.

## Career progression

The Legend target was adjusted from 443 to 439 yards while retaining the Level 10 and three-of-eight-round requirements. This offsets the lower high-quality-shot frequency without undoing the added moment-to-moment challenge.

| Profile | Reached Legend within 50 rounds | Median rounds among achievers |
| --- | ---: | ---: |
| Recreational | 2.12% | 46 |
| Developing | 13.20% | 42 |
| Skilled | 50.96% | 38 |
| Expert | 99.72% | 26 |

Compared with v198, the skilled profile's overall completion likelihood remains effectively stable (48.40% to 50.96%) while its representative Pro in-bounds rate falls from 89.9% to 72.3%. This is the intended outcome: more misses and close calls during play without making the full progression unreasonable.
