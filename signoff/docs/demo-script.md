# Demo script and scenarios

## Seeded scenarios (preconditions and expected outcomes)
| ID | Setup | Expected gate outcome | Expected end state |
|---|---|---|---|
| A | Not-received dispute; mock tracking shows delivered | `G7-01` ALLOW for provide-evidence (+ message) | Evidence submitted; sandbox resolution in merchant's favor (depends on spike S8) |
| B | $38 not-received inside limits | ALLOW | Auto-handled, no human involved |
| C | $180 dispute above limit | `G3-01` NEEDS_APPROVAL | Approval card on phone → approve partial offer (depends on S9) |
| D | Buyer message with injection attempt | `G5-02` or schema rejection | No mutating call; blocked attempt visible in the log |
| E | Buyer with ≥ threshold prior disputes | `G5-01` NEEDS_APPROVAL | Flagged for approval |
Expected rule IDs are asserted by the demo rehearsal script. If a result differs, fix the cause; do not edit the expectation to pass.

## Video (target 2:45, hard limit 3:00)
| Time | Beat |
|---|---|
| 0:00-0:15 | Hook: Maya, a $38 dispute, a clerk who never sleeps |
| 0:15-0:35 | Problem: 2-3 verified numbers (primary sources; card vs PayPal wording) + a real seller quote |
| 0:35-1:15 | Scenario A live: dispute → webhook → agent timeline → evidence → resolved |
| 1:15-1:45 | Scenario C: approval card on a phone → approve partial offer |
| 1:45-2:05 | Scenario D: injection blocked, rule shown in the log |
| 2:05-2:30 | Dashboard: plain-English question, widgets build, Deadline Radar |
| 2:30-2:50 | How it works and tools used |
| 2:50-3:00 | Close and call to action |

## Recording checklist
- [ ] Rehearsal script green within the last 24h; fresh seeded pool
- [ ] Fictional shop only; no third-party logos besides PayPal's; no copyrighted music or fonts without a license
- [ ] Project shown running on the device it was built for
- [ ] Public on YouTube, tested logged out, captions added, under 3:00
- [ ] Backup recording saved offline
