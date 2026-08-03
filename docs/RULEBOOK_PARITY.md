# Inner Work rulebook parity

Source reviewed: `Inner_Work_Rulebook.docx` from the physical-game project files.

This document is intentionally stricter than a feature list: visual similarity does not count as rule parity unless the same choices and consequences are available.

## Setup and Situation flow

| Physical rule | Web-app status | Notes |
|---|---|---|
| Agree on a timed day; complete as many Situations as possible | Partial | The app has an explicit End Day control but no timer. The timer is presentation rather than resolution logic and remains optional. |
| Draw three Needs; choose one Private and two Public | Aligned | The human chooses. NPC choices are automated. |
| Put one gift on every Need | Aligned | Public gifts are then modified by the Situation. Private gifts remain at one. |
| Draw four cards from the complete Strategy deck | Aligned | The deck contains 54 ordinary Strategies and seven Special Actions. A hand always contains four total cards. |
| Add Situation gifts to matching Public Needs | Aligned | Gift origin remains visible in the Needs and Situation views. |
| Double Needs whose feeling matches the Situation multiplier | Aligned | Applied after Situation additions. |
| Situation effects never alter Private Needs | Aligned | Private Needs remain one gift. |

## Discussion and planning

| Physical rule | Web-app status | Notes |
|---|---|---|
| A Strategy is legal only if it tends the acting Cognition’s Public Need or an active Bonus Need | Aligned | Private matches never independently make a normal Strategy legal unless Deep Introspection or Group Therapy Session explicitly opens that path. |
| Trade any number of cards | Implemented as sequential exchanges | Players may initiate exchanges by asking for a Need and may complete any number of one-for-one exchanges before committing. NPC hands remain hidden except for the specifically offered return card. |
| Use a Magnifying Glass once per Situation | Aligned | The token is spent only after a confirmed action succeeds. |
| Magnifier: replace any number of Strategy cards | Implemented | Select one through four ordinary or Special Action cards and draw the same number. |
| Magnifier: replace one of your Public Needs with two new Public Needs | Implemented literally | One Public Need leaves play and two newly drawn Public Needs enter, each receiving the current Situation setup. |
| Magnifier: with permission, replace another player’s Public Need with two new Public Needs | Implemented for solo NPCs | The NPC grants permission when the replacements create at least as many connections with its hidden hand. A declined request does not spend the token. |
| Magnifier: review the Private Need | Aligned through the unified menu | The card returns face down after review. |
| If no Strategy can be played, discard one | Aligned | The Story Table frames it as a Strategy that did not tend a qualifying Need. |
| Commit face down and reveal simultaneously | Aligned digitally | The app holds encoded ordinary/Special commitments until reveal. |

## Special Actions

Special Actions are part of the same 61-card deck, occupy one of the four hand slots, and may be committed with one ordinary Strategy. The Special Action resolves first and both used cards are discarded before the hand refills.

| Special Action | Web-app behavior |
|---|---|
| **Spontaneous Help** | The player chooses any Public Need. It is replaced by one newly drawn Public Need with the current Situation setup. |
| **Deep Introspection** | The acting Cognition may qualify its paired Strategy through its own hidden Private Need. The app does not reveal or confirm the match before resolution. |
| **Group Therapy Session** | Every Cognition may qualify its paired Strategy through its own hidden Private Need for that round. |
| **Emergency Situation** | Two newly drawn Needs enter as active one-gift Bonus Needs before ordinary Strategies resolve. |
| **Effective Communication** | An active one-gift Bonus Need for Understanding enters before ordinary Strategies resolve. |
| **Unexpected Turn of Events** | Event effects activate on every paired ordinary Strategy for that round. |
| **Deep Breath** | The player chooses one positive effect on the paired ordinary Strategy and increases it by three. |

NPC Cognitions may use Special Actions from their hidden hands. The Story Table reveals and explains the Special Action first, then tells the paired Strategy story. A Special Action may resolve without an ordinary Strategy when no pairing was made, but it cannot itself move Public or Private gifts unless its written rule changes the board.

## Play, Story, gifts, and scoring

| Physical rule | Web-app status | Notes |
|---|---|---|
| Special Actions resolve before Strategies | Aligned | Their target and board changes are applied before ordinary legality and effect strength are calculated. |
| Reveal and tell the story of the shared person | Aligned with deliberate ordering | NPC examples go first and the human goes last. The narrative distinguishes a Cognition’s motivating Needs from the shared person’s action. |
| Read every Need the Strategy tends | Aligned | Visible Public and Bonus effects are itemized. Private matches are resolved without being exposed beforehand. |
| Public gifts move to the group score | Aligned | Shown in the final Story Table movement. |
| Private gifts go to the owner’s individual score | Aligned | Hidden identity is protected. |
| Bonus gifts go to the strongest matching plays; ties all score | Aligned | Tied strongest plays each receive the points. |
| New Bonus Needs from ordinary Strategy effects enter next round | Aligned | Their source Strategy and Cognition are retained for the Story Table. Special Actions that explicitly introduce Bonus Needs do so immediately. |

## Round and Situation transitions

| Physical rule | Web-app status | Notes |
|---|---|---|
| Refill every hand to four | Aligned | The paired ordinary Strategy and Special Action both leave the hand after use. |
| Continue rounds while any Public gift remains | Aligned | The Situation ends only after all required Public gifts are gone. |
| Remove Bonus Needs at a new Situation | Aligned | Bonus state does not carry into the next Situation. |
| Shuffle Need and Strategy decks at a new Situation | Aligned | The unheld complete Strategy deck and Need deck are explicitly reshuffled at the boundary. |
| If a Private Need was met, draw three and choose a new Private Need | Aligned for the human | NPC selection is automated. |
| If the Private Need was not met, retain it and draw two Public Needs | Aligned | The retained Private Need remains one gift. |

## Optional physical-table rules not automated

- Custom 25-card Strategy decks.
- Maximum two copies of one Strategy.
- Maximum one Special Action in a custom deck.
- Unanimously approved verbal Strategies.

These remain valid physical-table options. A future custom-deck builder could represent them without changing the core engine.

## Meaningful-choice floor

The app counts paths rather than equating choice with legal-card count:

- each legal ordinary Strategy;
- each distinct player-directed trade path;
- each usable Special Action target or effect pairing;
- the four Magnifier action categories while the token is unused;
- a required discard when no ordinary Strategy is legal.

Run the development simulator with:

```bash
npm run analyze:choices
```

The proposed `Brainstorm Alternatives` solo safety valve remains deliberately excluded until the completed written rules have been measured and playtested.
