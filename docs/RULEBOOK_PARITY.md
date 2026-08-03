# Inner Work rulebook parity

Source reviewed: `Inner_Work_Rulebook.docx` from the physical-game project files.

This document distinguishes **aligned**, **partially aligned**, **implemented in the current parity pass**, and **not automated**. It is intentionally stricter than a feature list: visual similarity does not count as rule parity unless the same choices and consequences are available.

## Setup and Situation flow

| Physical rule | Web-app status | Notes |
|---|---|---|
| Agree on a timed day; complete as many Situations as possible | Partial | The app has an explicit End Day control but no timer. The timer is presentation rather than resolution logic and remains optional. |
| Draw three Needs; choose one Private and two Public | Aligned | The human chooses. NPC choices are automated. |
| Put one gift on every Need | Aligned | Public gifts are then modified by the Situation. Private gifts remain at one. |
| Draw four Strategy cards | Aligned for ordinary Strategies | Special Actions are tracked separately below. |
| Add Situation gifts to matching Public Needs | Aligned | Gift origin remains visible in the Needs and Situation views. |
| Double Needs whose feeling matches the Situation multiplier | Aligned | Applied after Situation additions. |
| Situation effects never alter Private Needs | Aligned | Private Needs remain one gift. |

## Discussion and planning

| Physical rule | Web-app status | Notes |
|---|---|---|
| A Strategy is legal only if it tends the acting Cognition’s Public Need or an active Bonus Need | Aligned | Private matches never independently make a normal Strategy legal. |
| Trade any number of cards | Implemented as sequential exchanges | Players may now initiate exchanges by asking for a Need and may complete any number of one-for-one exchanges before committing. NPC hands remain hidden except for the specifically offered return card. |
| Use a Magnifying Glass once per Situation | Aligned | The token is spent only after a confirmed action succeeds. |
| Magnifier: replace any number of Strategy cards | Implemented | Select one through four cards and draw the same number. |
| Magnifier: replace one of your Public Needs with two new Public Needs | Implemented literally | One Public Need leaves play and two newly drawn Public Needs enter, each receiving the current Situation setup. |
| Magnifier: with permission, replace another player’s Public Need with two new Public Needs | Implemented for solo NPCs | The NPC grants permission when the replacements create at least as many connections with its hidden hand. A declined request does not spend the token. |
| Magnifier: review the Private Need | Aligned through the unified menu | The card returns face down after review. |
| If no Strategy can be played, discard one | Aligned | The Story Table can frame this as an action that did not tend a Need. |
| Commit face down and reveal simultaneously | Aligned digitally | The app holds choices until reveal. |

## Play, Story, gifts, and scoring

| Physical rule | Web-app status | Notes |
|---|---|---|
| Reveal in any order and tell the story of the shared person | Aligned with deliberate ordering | NPC examples go first and the human goes last. The narrative distinguishes a Cognition’s motivating Needs from the shared person’s action. |
| Read every Need the Strategy tends | Aligned | Visible Public and Bonus effects are itemized. Private matches are resolved without being exposed beforehand. |
| Public gifts move to the group score | Aligned | Shown in the final Story Table movement. |
| Private gifts go to the owner’s individual score | Aligned | Hidden identity is protected. |
| Bonus gifts go to the strongest matching plays; ties all score | Aligned | Tied strongest plays each receive the points. |
| New Bonus Needs enter at the next round | Aligned | Their source Strategy and Cognition are retained for the Story Table. |

## Round and Situation transitions

| Physical rule | Web-app status | Notes |
|---|---|---|
| Refill every hand to four | Aligned | Only played/discarded cards leave the hand. |
| Continue rounds while any Public gift remains | Aligned | The Situation ends only after all required Public gifts are gone. |
| Remove Bonus Needs at a new Situation | Aligned | Bonus state does not carry into the next Situation. |
| Shuffle Need and Strategy decks at a new Situation | Partial | The engine draws from maintained shuffled decks and recycles when required. An explicit boundary reshuffle remains a small parity cleanup. |
| If a Private Need was met, draw three and choose a new Private Need | Aligned for the human | NPC selection is automated. |
| If the Private Need was not met, retain it and draw two new Public Needs | Aligned | The retained Private Need remains one gift. |

## Special Action cards

The source workbook and card images define seven Special Actions:

1. **Spontaneous Help** — replace any Public Need with a new one.
2. **Deep Introspection** — play a Strategy for your Private Need.
3. **Group Therapy Session** — all Cognitions may play for their Private Needs.
4. **Emergency Situation** — introduce two new Need cards as Bonus opportunities.
5. **Effective Communication** — introduce a Bonus Need for Understanding.
6. **Unexpected Turn of Events** — activate Event effects on active cards.
7. **Deep Breath** — boost one Strategy effect by three.

The physical rulebook says Special Actions resolve first and may accompany an additional Strategy. Their digital implementation is being handled as a separate engine change because they alter card typing, hidden-information legality, target selection, Story order, and refill behavior. They must not be approximated as ordinary Strategies.

Implementation assumptions for that follow-up:

- Special Actions are part of the 63-card Strategy deck.
- A hand still contains four total cards.
- One Special Action may be committed alongside one ordinary Strategy when its text permits or requires that pairing.
- The Special Action resolves first and is discarded after use.
- Private-target actions do not reveal the Private Need to other Cognitions.

## Optional physical-table rules not automated in this pass

- Custom 25-card Strategy decks.
- Maximum two copies of one Strategy.
- Maximum one Special Action in a custom deck.
- Unanimously approved verbal Strategies.

These remain valid physical-table options. A future custom-deck builder could represent them without changing the core engine.

## Meaningful-choice floor

The app now counts paths rather than equating choice with legal-card count:

- each legal Strategy;
- each distinct player-directed trade path;
- the four Magnifier action categories while the token is unused;
- future Special Action targets;
- a required discard when no Strategy is legal.

Run the development simulator with:

```bash
npm run analyze:choices
```

The proposed `Brainstorm Alternatives` solo safety valve is deliberately excluded until the complete written rules have been measured.