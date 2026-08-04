# Special Action validation record

The seven source Special Actions are now enabled together only because the production workflow runs an executable regression scenario for every card.

The earlier staged gate was useful after the first broad implementation touched many systems at once. It is retained in history, but the active production list is now complete:

```ts
export const enabledSpecialActionIds: readonly SpecialActionId[] = [
  'SA1', 'SA2', 'SA3', 'SA4', 'SA5', 'SA6', 'SA7',
]
```

Runtime flags remain deliberately unsupported, so deployment configuration cannot silently activate an unreviewed draft card.

## Required checks

Every change to Special Action behavior must pass:

1. TypeScript and Vite production build.
2. Complete seven-card engine regression suite.
3. Deal/refill check: hands remain four total cards.
4. Selection and configuration checks on mobile and desktop.
5. Resolution check for the card’s written effect.
6. Story Table check: the Special Action appears before a paired ordinary Strategy.
7. Hidden-information check when Private Needs are involved.
8. Next-round and next-Situation state checks.
9. Meaningful-choice analysis.

Run the executable suite with:

```bash
npm run test:special-actions
```

## Validation record

| Card | Verified behavior |
|---|---|
| **SA1 — Spontaneous Help** | Replaces one selected unresolved Public Need with a unique newly drawn Need using the current Situation setup. |
| **SA2 — Deep Introspection** | Requires a paired ordinary Strategy and permits that Strategy to qualify through the acting Cognition’s own hidden Private Need. |
| **SA3 — Group Therapy Session** | Permits every Cognition’s ordinary Strategy to qualify through that Cognition’s own hidden Private Need for the round. |
| **SA4 — Emergency Situation** | Draws two active one-gift Bonus Needs before legality and scoring are checked. |
| **SA5 — Effective Communication** | Introduces active Understanding before legality and scoring are checked. |
| **SA6 — Unexpected Turn of Events** | Activates Event effects on all ordinary Strategies played during a non-Event Situation. |
| **SA7 — Deep Breath** | Requires a paired ordinary Strategy and adds exactly +3 to one selected positive effect. |

The suite also verifies:

- the active deck contains 61 unique cards;
- source timing metadata remains attached to every Special Action;
- removing an ordinary Strategy also removes SA2 or SA7 when that pairing becomes invalid;
- standalone-capable Special Actions remain committed when an optional ordinary Strategy is removed;
- used Special Actions and paired Strategies leave the hand; and
- each hand refills to four total cards.

## Stable references

- The broad experimental implementation remains preserved on `archive/special-action-parity-big-bang`.
- Pull request #35 records the original integrated design and build history.
- Pull request #37 records the isolated SA5 rollout.
- The proposed `Brainstorm Alternatives` solo rule remains excluded until complete-rule play data shows it is needed.
