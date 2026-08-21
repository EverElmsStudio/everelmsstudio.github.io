# v223 Competition Driver simulation

The Competition Driver unlocks after a round that **starts at Level 10** and finishes with a zero-inclusive average of at least 325 yards. OOB drives therefore contribute zero. The driver is awarded in the existing post-round reward sequence and equips on the following round.

The selected multiplier is `1.035`, compared with `1.012` for the Long Driver. Across all eight wind directions at 5 mph, an exact 100% power/perfect-accuracy Level-10 shot improves from an average 442.6 yards to 456.0 yards. The weakest wind result rises from 432.1 to 445.2 yards, removing the case where a perfect strike is wind-gated below the 439-yard Legend target.

The deterministic career test used 3,000 exact physics shots per player-profile/driver pool and 5,000 sampled Level-10 Pro careers per profile. Each career was capped at 30 rounds and Legend still required three 439+ best-drive rounds in the latest eight.

| Profile | Long only: Legend by R30 | Competition: Legend by R30 | Median Legend round with Competition | Median unlock round |
| --- | ---: | ---: | ---: | ---: |
| Developing | 11.24% | 73.82% | 16 | 8 |
| Skilled | 61.74% | 99.98% | 7 | 3 |
| Expert | 99.84% | 100% | 4 | 1 |

Interpretation: the reward is intentionally a strong late-game acceleration. It does not award Legend directly—the player still has to hit three qualifying rounds—but it makes excellent strikes credible in every ordinary wind direction. Real player testing should decide whether the 325-yard unlock gate or 3.5% multiplier needs a later adjustment.
