# Special Action staged rollout

The complete Special Action engine is retained in the repository, but cards enter production only after isolated validation.

This is an intentional safety gate after the initial all-at-once implementation touched too many interacting systems at once.

## Active rollout list

`src/tabletop/specialActions.ts` contains the explicit production list:

```ts
export const enabledSpecialActionIds: readonly SpecialActionId[] = ['SA5']
```

**Currently active:**

- **SA5 — Effective Communication**

**Still disabled:** SA1, SA2, SA3, SA4, SA6, and SA7.

Runtime flags are deliberately not supported, so deployment configuration cannot activate a card accidentally. A later card-specific branch adds only that card after preserving every already-validated ID.

## Required test sequence

Each Special Action receives its own pull request and must pass:

1. TypeScript and Vite production build.
2. Regression check for every previously enabled card.
3. Deal/refill check: hands remain four total cards.
4. Selection check on mobile docked, mobile undocked, and desktop hands.
5. Resolution check for the card’s exact written rule.
6. Story Table check: the Special Action is shown before the paired Strategy.
7. Hidden-information check when Private Needs are involved.
8. Next-round and next-Situation state check.

The card-specific branch must contain only the minimum engine, interface, test, and documentation changes needed for that one card.

## Validation record

### SA5 — Effective Communication

Status: **validated for rollout**

The executable `npm run test:sa5` scenario verifies that:

- SA5 introduces an active one-gift Understanding Bonus Need before legality is checked;
- an otherwise-illegal Understanding Strategy becomes legal through that Bonus Need;
- the strongest matching Cognition receives the Bonus gift as an individual point;
- the fully tended Bonus Need leaves play;
- SA5 and its paired Strategy both leave the hand; and
- the hand refills to four.

The production build and meaningful-choice analysis also pass with only SA5 enabled.

## Remaining rollout order

The order moves from isolated board effects to hidden-information and global-resolution effects:

1. **SA4 — Emergency Situation**: introduce two Bonus Needs.
2. **SA1 — Spontaneous Help**: replace one Public Need.
3. **SA7 — Deep Breath**: boost one selected effect by +3.
4. **SA6 — Unexpected Turn of Events**: activate Event effects globally.
5. **SA2 — Deep Introspection**: qualify through the acting Cognition’s Private Need.
6. **SA3 — Group Therapy Session**: qualify every Cognition through its Private Need.

Cards later in the order depend on more engine surfaces and therefore should not be combined with earlier work.

## Stable references

- The broad experimental implementation is preserved on `archive/special-action-parity-big-bang`.
- Pull request #35 records the original integrated design and build history.
- The proposed `Brainstorm Alternatives` solo rule remains excluded.
