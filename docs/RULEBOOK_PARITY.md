# Inner Work rulebook parity

Source reviewed: `Inner_Work_Rulebook.docx` and the seven Special Action card records from the physical-game project files.

This document is intentionally stricter than a feature list: visual similarity does not count as rule parity unless the same choices and consequences are available.

## Setup and Situation flow

| Physical rule | Web-app status | Notes |
|---|---|---|
| Agree on a timed day; complete as many Situations as possible | Partial | The app has an explicit End Day control but no timer. The timer is presentation rather than resolution logic and remains optional. |
| Draw three Needs; choose one Private and two Public | Aligned | The human chooses. NPC choices are automated. |
| Put one gift on every Need | Aligned | Public gifts are then modified by the Situation. Private gifts remain at one. |
| Draw four cards from the complete Strategy deck | Aligned | The active deck contains 54 ordinary Strategies and all seven one-copy Special Actions. A hand always contains four total cards. |
| Add Situation gifts to matching Public Needs | Aligned | Gift origin remains visible in the Needs and Situation views. |
| Double Needs whose feeling matches the Situation multiplier | Aligned | Applied after Situation additions. |
| Situation effects never alter Private Needs | Aligned | Private Needs remain one gift. |

## Discussion and planning

| Physical rule | Web-app status | Notes |
|---|---|---|
| An ordinary Strategy is legal only if it tends the acting Cognition’s Public Need or an active Bonus Need | Aligned with written exceptions | Deep Introspection and Group Therapy Session may open a qualifying route through the acting Cognition’s Private Need. Emergency Situation and Effective Communication may create an immediately qualifying Bonus Need. |
| Trade any number of cards | Implemented as sequential exchanges | Players may initiate exchanges by asking for a Need and may complete any number of one-for-one exchanges before committing. NPC hands remain hidden except for the specifically offered return card. |
| Use a Magnifying Glass once per Situation | Aligned | The token is spent only after a confirmed action succeeds. Desktop and mobile open the same four-option menu. |
| Magnifier: replace any number of Strategy cards | Implemented | Select one through four cards and draw the same number, including Special Actions. |
| Magnifier: replace one of your Public Needs with two new Public Needs | Implemented literally | One Public Need leaves play and two newly drawn Public Needs enter, each receiving the current Situation setup. |
| Magnifier: with permission, replace another player’s Public Need with two new Public Needs | Implemented for solo NPCs | The NPC grants permission when the replacements create at least as many connections with its hidden hand. A declined request does not spend the token. |
| Magnifier: review the Private Need | Aligned through the unified menu | The card returns face down after review. |
| If no Strategy can be played, discard one | Aligned | The Story Table frames it as a Strategy that did not tend a qualifying Need. |
| Commit face down and reveal simultaneously | Aligned digitally | A Special Action may be committed alone or beside one ordinary Strategy. Deep Introspection and Deep Breath require the paired Strategy they modify. |

## Special Actions

All seven source cards are active. The shared desktop/mobile configuration layer preserves the source timing label and resolves every Special Action before ordinary Strategies.

| Special Action | Source timing | Engine behavior | Status |
|---|---|---|---|
| **Spontaneous Help** | Discussion Phase | Replace one unresolved Public Need with a newly drawn Public Need using the current Situation setup. | Enabled and tested |
| **Deep Introspection** | Start of Play Phase | Allow the acting Cognition to qualify its paired Strategy through its own hidden Private Need. | Enabled and tested |
| **Group Therapy Session** | Discussion Phase | Allow every Cognition to qualify an ordinary Strategy through its own hidden Private Need for that round. | Enabled and tested |
| **Emergency Situation** | Discussion Phase | Introduce two active one-gift Bonus Needs before ordinary Strategies resolve. | Enabled and tested |
| **Effective Communication** | Discussion Phase | Introduce an active one-gift Understanding Bonus Need before ordinary Strategies resolve. | Enabled and tested |
| **Unexpected Turn of Events** | Discussion Phase | Activate Event effects on every ordinary Strategy played that round. | Enabled and tested |
| **Deep Breath** | Start of Play Phase | Add +3 to one selected positive effect on the paired ordinary Strategy. | Enabled and tested |

`npm run test:special-actions` executes the real TypeScript engine through Vite SSR and verifies all seven effects, pairing rules, discard, and refill behavior.

### Digital timing interpretation

The physical rules say cards are placed together at the end of Discussion and Special Actions enter play first during Play/Story. The app therefore keeps commitments hidden until simultaneous reveal, then applies Special Actions before testing and resolving ordinary Strategies. The printed `Discussion Phase` and `Start of Play Phase` labels remain visible so this interpretation is not mistaken for source wording.

## Play, Story, gifts, and scoring

| Physical rule | Web-app status | Notes |
|---|---|---|
| Special Actions resolve before Strategies | Aligned | The Special Action is shown and narrated first; any paired ordinary Strategy follows. |
| Reveal and tell the story of the shared person | Aligned with deliberate ordering | NPC examples go first and the human goes last. The narrative distinguishes a Cognition’s motivating Needs from the shared person’s action. |
| Read every Need the Strategy tends | Aligned | Visible Public and Bonus effects are itemized. Private matches are resolved without being exposed beforehand. |
| Public gifts move to the group score | Aligned | Shown in the final Story Table movement. |
| Private gifts go to the owner’s individual score | Aligned | Hidden identity is protected. |
| Every player whose story tends an available Bonus Need receives those points | Aligned | Bonus Needs are non-competitive. Every legal matching Cognition receives all gifts shown on the Bonus Need; one Cognition’s contribution does not erase another’s. |
| New Bonus Needs from ordinary Strategy effects enter next round | Aligned | Their source Strategy and Cognition are retained for the Story Table. Emergency Situation and Effective Communication are explicit immediate-placement exceptions. |

## Round and Situation transitions

| Physical rule | Web-app status | Notes |
|---|---|---|
| Refill every hand to four | Aligned | A used Special Action and any paired ordinary Strategy both leave the hand; the hand then refills to four total cards. |
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

The app and simulator now use one canonical planning-route evaluator. A **route** is a qualitatively distinct action family; targets, payments, card subsets, and pairings are reported as configurations inside that route rather than being added together as if every minor configuration were a wholly separate kind of choice.

The evaluator includes:

- each visibly legal ordinary Strategy;
- each distinct directed trade offer, with accepted payment cards recorded as configurations;
- each usable Special Action, with targets or pairings recorded as configurations;
- each available Magnifier action category, with card or Need targets recorded as configurations; and
- a discard route when no ordinary Strategy is visibly legal.

Private-Need matches and NPC permission are labeled as **uncertain possibilities**, not confirmed routes. The player-facing interface therefore preserves secrecy while the omniscient simulator can separately verify whether those possibilities actually exist.

Run the deterministic analysis with:

```bash
npm run analyze:choices
```

The proposed `Brainstorm Alternatives` solo safety valve remains deliberately excluded until the corrected complete rules and canonical route measurements are reviewed in play.
