# Inner Work rulebook parity

Source reviewed: `Inner_Work_Rulebook.docx` from the physical-game project files.

This document is intentionally stricter than a feature list: visual similarity does not count as rule parity unless the same choices and consequences are available.

## Setup and Situation flow

| Physical rule | Web-app status | Notes |
|---|---|---|
| Agree on a timed day; complete as many Situations as possible | Partial | The app has an explicit End Day control but no timer. The timer is presentation rather than resolution logic and remains optional. |
| Draw three Needs; choose one Private and two Public | Aligned | The human chooses. NPC choices are automated. |
| Put one gift on every Need | Aligned | Public gifts are then modified by the Situation. Private gifts remain at one. |
| Draw four cards from the complete Strategy deck | Staged | Production currently uses 54 ordinary Strategies plus validated SA5 Effective Communication. The remaining six Special Actions stay disabled while they are tested independently. A hand always contains four total cards. |
| Add Situation gifts to matching Public Needs | Aligned | Gift origin remains visible in the Needs and Situation views. |
| Double Needs whose feeling matches the Situation multiplier | Aligned | Applied after Situation additions. |
| Situation effects never alter Private Needs | Aligned | Private Needs remain one gift. |

## Discussion and planning

| Physical rule | Web-app status | Notes |
|---|---|---|
| A Strategy is legal only if it tends the acting Cognition’s Public Need or an active Bonus Need | Aligned | Private matches do not independently make a normal Strategy legal. Effective Communication may create an active Understanding Bonus Need before legality is checked. |
| Trade any number of cards | Implemented as sequential exchanges | Players may initiate exchanges by asking for a Need and may complete any number of one-for-one exchanges before committing. NPC hands remain hidden except for the specifically offered return card. |
| Use a Magnifying Glass once per Situation | Aligned | The token is spent only after a confirmed action succeeds. |
| Magnifier: replace any number of Strategy cards | Implemented | Select one through four cards and draw the same number, including SA5 when it is held. |
| Magnifier: replace one of your Public Needs with two new Public Needs | Implemented literally | One Public Need leaves play and two newly drawn Public Needs enter, each receiving the current Situation setup. |
| Magnifier: with permission, replace another player’s Public Need with two new Public Needs | Implemented for solo NPCs | The NPC grants permission when the replacements create at least as many connections with its hidden hand. A declined request does not spend the token. |
| Magnifier: review the Private Need | Aligned through the unified menu | The card returns face down after review. |
| If no Strategy can be played, discard one | Aligned | The Story Table frames it as a Strategy that did not tend a qualifying Need. |
| Commit face down and reveal simultaneously | Aligned digitally | SA5 may be committed with one ordinary Strategy; both remain hidden until reveal. |

## Special Actions

The repository retains the complete seven-card engine and presentation work, but cards enter production one at a time after isolated validation.

| Special Action | Engine behavior | Production status |
|---|---|---|
| **Spontaneous Help** | Replace a selected Public Need with one newly drawn Public Need using the current Situation setup. | Disabled |
| **Deep Introspection** | Allow the acting Cognition to qualify its paired Strategy through its own hidden Private Need. | Disabled |
| **Group Therapy Session** | Allow every Cognition to qualify its paired Strategy through its own hidden Private Need for that round. | Disabled |
| **Emergency Situation** | Introduce two active one-gift Bonus Needs before ordinary Strategies resolve. | Disabled |
| **Effective Communication** | Introduce an active one-gift Understanding Bonus Need before ordinary Strategies resolve. | **Enabled and regression-tested** |
| **Unexpected Turn of Events** | Activate Event effects on every paired ordinary Strategy for the round. | Disabled |
| **Deep Breath** | Add +3 to one selected positive effect on the paired ordinary Strategy. | Disabled |

`npm run test:sa5` executes the real TypeScript engine through Vite SSR and verifies SA5’s legality, scoring, discard, and refill behavior.

The broad implementation is preserved on `archive/special-action-parity-big-bang`. It will not be reintroduced as one unit.

## Play, Story, gifts, and scoring

| Physical rule | Web-app status | Notes |
|---|---|---|
| Special Actions resolve before Strategies | Partial staged parity | Effective Communication resolves first. The remaining six cards are not yet active. |
| Reveal and tell the story of the shared person | Aligned with deliberate ordering | NPC examples go first and the human goes last. The narrative distinguishes a Cognition’s motivating Needs from the shared person’s action. SA5 is shown before its paired Strategy. |
| Read every Need the Strategy tends | Aligned | Visible Public and Bonus effects are itemized. Private matches are resolved without being exposed beforehand. |
| Public gifts move to the group score | Aligned | Shown in the final Story Table movement. |
| Private gifts go to the owner’s individual score | Aligned | Hidden identity is protected. |
| Bonus gifts go to the strongest matching plays; ties all score | Aligned | Tied strongest plays each receive the points. SA5’s Understanding gift follows this rule. |
| New Bonus Needs from ordinary Strategy effects enter next round | Aligned | Their source Strategy and Cognition are retained for the Story Table. SA5 is an explicit exception that creates its Bonus Need immediately. |

## Round and Situation transitions

| Physical rule | Web-app status | Notes |
|---|---|---|
| Refill every hand to four | Aligned for active cards | SA5 and its paired ordinary Strategy both leave the hand after use, and the hand refills to four. |
| Continue rounds while any Public gift remains | Aligned | The Situation ends only after all required Public gifts are gone. |
| Remove Bonus Needs at a new Situation | Aligned | Bonus state does not carry into the next Situation. |
| Shuffle Need and Strategy decks at a new Situation | Aligned | The unheld active Strategy deck and Need deck are explicitly reshuffled at the boundary. |
| If a Private Need was met, draw three and choose a new Private Need | Aligned for the human | NPC selection is automated. |
| If the Private Need was not met, retain it and draw two Public Needs | Aligned | The retained Private Need remains one gift. |

## Optional physical-table rules not automated

- Custom 25-card Strategy decks.
- Maximum two copies of one Strategy.
- Maximum one Special Action in a custom deck.
- Unanimously approved verbal Strategies.

These remain valid physical-table options. A future custom-deck builder could represent them without changing the core engine.

## Meaningful-choice floor

The production app currently counts paths from:

- each legal ordinary Strategy;
- each distinct player-directed trade path;
- each usable Effective Communication pairing;
- the four Magnifier action categories while the token is unused; and
- a required discard when no ordinary Strategy is legal.

Run the development simulator with:

```bash
npm run analyze:choices
```

The proposed `Brainstorm Alternatives` solo safety valve remains deliberately excluded until the written rules have been validated and measured through the staged rollout.
