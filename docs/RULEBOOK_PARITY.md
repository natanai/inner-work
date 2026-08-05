# Inner Work rulebook parity

Source reviewed: `Inner_Work_Rulebook.docx` and the seven Special Action card records from the physical-game project files.

This document is intentionally stricter than a feature list: visual similarity does not count as rule parity unless the same choices, timing, information boundaries, and consequences are available.

## Setup and Situation flow

| Physical rule | Web-app status | Notes |
|---|---|---|
| Agree on a timed day; complete as many Situations as possible | Partial | The app has an explicit End Day control but no timer. The timer is presentation rather than resolution logic and remains optional. |
| Draw three Needs; choose one Private and two Public | Aligned | The human chooses. NPC choices are automated. |
| Put one gift on every Need | Aligned | Public gifts are then modified by the Situation. Private gifts remain at one. |
| Draw four cards from the complete Strategy deck | Aligned | The active deck contains 54 ordinary Strategies and all seven one-copy Special Actions. A hand contains four total cards after each refill. |
| Add Situation gifts to matching Public Needs | Aligned | Gift origin remains visible in the Needs and Situation views. |
| Double Needs whose feeling matches the Situation multiplier | Aligned | Applied after Situation additions. |
| Situation effects never alter Private Needs | Aligned | Private Needs remain one gift. |

## Discussion and planning

| Physical rule | Web-app status | Notes |
|---|---|---|
| An ordinary Strategy is legal only if it tends the acting Cognition’s Public Need or an active Bonus Need | Aligned with written exceptions | Deep Introspection and Group Therapy Session permit an explicit private-targeted commitment. Emergency Situation and Effective Communication create immediately active Bonus Needs. |
| Trade any number of cards | Implemented as sequential exchanges | Players may initiate exchanges by asking for a Need and may complete any number of one-for-one exchanges before committing. NPC hands remain hidden except for the specifically offered return card. Discussion Actions immediately update trade analysis. |
| Use a Magnifying Glass once per Situation | Aligned | The token is spent only after a confirmed action succeeds. Desktop and mobile open the same four-option menu. |
| Magnifier: replace any number of Strategy cards | Implemented | Select one through four cards and draw the same number, including Special Actions. |
| Magnifier: replace one of your Public Needs with two new Public Needs | Implemented literally | One Public Need leaves play and two newly drawn Public Needs enter, each receiving the current Situation setup. |
| Magnifier: with permission, replace another player’s Public Need with two new Public Needs | Implemented for solo NPCs | The NPC grants permission when the replacements create at least as many connections with its hidden hand. A declined request does not spend the token. |
| Magnifier: review the Private Need | Aligned through the unified menu | The card returns face down after review. |
| If no Strategy can be played, discard one | Aligned | The Story Table states that the Strategy did not qualify and produced no effects. |
| Commit face down and reveal simultaneously | Aligned for ordinary and Start-of-Play cards | Ordinary Strategies and Start-of-Play pairs remain hidden until reveal. Discussion Actions are deliberately excluded because their printed phase requires them to alter planning before commitment ends. |

## Special Actions

All seven source cards are active. Their printed phases are now actual engine boundaries.

### Timing contract

- **Discussion Phase:** the card is played openly, leaves the acting Cognition’s hand immediately, and changes the live planning state. Its result is available to later Strategy choices, trades, previews, and commitments in the same round.
- **Start of Play Phase:** the card is configured as a hidden conditional pair with an ordinary Strategy. It is checked first at simultaneous reveal.
- A Cognition may use at most one Special Action before its hand refills.

| Special Action | Source timing | Engine and interface behavior | Status |
|---|---|---|---|
| **Spontaneous Help** | Discussion Phase | Choose one unresolved Public Need and replace it immediately with a newly drawn Public Need using the current Situation setup. Legality and trades update before commitment. | Enabled and timing-tested |
| **Deep Introspection** | Start of Play Phase | Assign one ordinary Strategy specifically to the acting Cognition’s face-down Private Need. At reveal, a mismatch discards the Special Action and Strategy and suppresses every Strategy effect. A match permits the Strategy to resolve normally across all matching Needs. | Enabled and timing-tested |
| **Group Therapy Session** | Discussion Phase | Opens a visible private-targeted commitment option for every Cognition for the rest of the round. Each assigned Strategy is checked against its owner’s Private Need at reveal; a mismatch is discarded without effects. | Enabled and timing-tested |
| **Emergency Situation** | Discussion Phase | Draw two unique Need cards immediately and place them as active one-gift Bonus Needs. They may qualify Strategies, affect trades, and score in the current round. | Enabled and timing-tested |
| **Effective Communication** | Discussion Phase | Place an active one-gift Understanding Bonus Need immediately. It may qualify Strategies, affect trades, and score in the current round. | Enabled and timing-tested |
| **Unexpected Turn of Events** | Discussion Phase | Activate Event effects immediately for every ordinary Strategy for the remainder of the round. Previews, legality, trades, and resolution all use the Event effects. | Enabled and timing-tested |
| **Deep Breath** | Start of Play Phase | Choose one ordinary Strategy and one positive effect on it. Add +3 to that effect before legality and resolution are calculated. | Enabled and timing-tested |

An unmet Private Need is **not** discarded when a private-targeted Strategy fails. The rulebook says an unmet Private Need is retained between Situations; only the attempted Strategy and any paired Special Action are spent.

Executable checks:

```bash
npm run test:special-actions
npm run test:special-timing
```

The first protects the seven card effects and refill behavior in the underlying resolver. The second specifically verifies real Discussion timing, explicit Private-Need assignment, failed-assignment suppression, and Start-of-Play pairing.

## Play, Story, gifts, and scoring

| Physical rule | Web-app status | Notes |
|---|---|---|
| Special Actions resolve according to their printed phase | Aligned | Discussion Actions appear as already-active table changes. Only Start-of-Play Actions are attached to a Strategy at simultaneous reveal. |
| Reveal and tell the story of the shared person | Aligned with deliberate ordering | NPC examples go first and the human goes last. The narrative distinguishes a Cognition’s motivating Needs from the shared person’s action. |
| Read every Need the Strategy tends | Aligned | Visible Public and Bonus effects are itemized. Private matches are resolved without being exposed beforehand. |
| Public gifts move to the group score | Aligned | Shown in the final Story Table movement. |
| Private gifts go to the owner’s individual score | Aligned | Hidden identity is protected. |
| Every player whose story tends an available Bonus Need receives those points | Aligned | Bonus Needs are non-competitive. Every legal matching Cognition receives all gifts shown on the Bonus Need; one Cognition’s contribution does not erase another’s. |
| New Bonus Needs from ordinary Strategy effects enter next round | Aligned | Their source Strategy and Cognition are retained for the Story Table. Emergency Situation and Effective Communication are separate immediate-placement exceptions. |

## Round and Situation transitions

| Physical rule | Web-app status | Notes |
|---|---|---|
| Refill every hand to four | Aligned | An openly spent Discussion Action and a hidden Start-of-Play pair leave the hand as appropriate; the hand then refills to four total cards. |
| Continue rounds while any Public gift remains | Aligned | The Situation ends only after all required Public gifts are gone. |
| Remove Bonus Needs at a new Situation | Aligned | Bonus state does not carry into the next Situation. |
| Shuffle Need and Strategy decks at a new Situation | Aligned | The unheld active Strategy deck and Need deck are explicitly reshuffled at the boundary. |
| If a Private Need was met, draw three and choose a new Private Need | Aligned for the human | NPC selection is automated. |
| If the Private Need was not met, retain it and draw two Public Needs | Aligned | This also governs a failed Deep Introspection or Group Therapy assignment. |

## Optional physical-table rules not automated

- Custom 25-card Strategy decks.
- Maximum two copies of one Strategy.
- Maximum one Special Action in a custom deck.
- Unanimously approved verbal Strategies.

These remain valid physical-table options. A future custom-deck builder could represent them without changing the core engine.

## Meaningful-choice floor

The app and simulator use one canonical planning-route evaluator. A **route** is a qualitatively distinct action family; targets, payments, card subsets, and pairings are reported as configurations inside that route rather than being added together as if every minor configuration were wholly separate.

The evaluator includes:

- each visibly legal ordinary Strategy;
- each distinct directed trade offer, with accepted payment cards recorded as configurations;
- each unused Special Action at its actual timing;
- the private-targeted route opened by Group Therapy, labeled uncertain to protect the face-down Need;
- each available Magnifier action category, with card or Need targets recorded as configurations; and
- a discard route when no ordinary Strategy is visibly legal and no private-targeted route is open.

Private-Need matches and NPC permission are labeled as **uncertain possibilities**, not confirmed routes. The player-facing interface preserves secrecy while the omniscient simulator can separately verify whether those possibilities actually exist.

Run the deterministic analysis with:

```bash
npm run analyze:choices
```

The proposed `Brainstorm Alternatives` solo safety valve remains deliberately excluded until the corrected complete rules and canonical route measurements are reviewed in play.
