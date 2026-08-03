# Special Action staged rollout

The complete Special Action engine is retained in the repository, but Special Actions are **not included in production deals by default**.

This is an intentional safety gate after the initial all-at-once implementation touched too many interacting systems at once. The ordinary 54-card Strategy deck remains the production behavior until each Special Action passes independently.

## Enabling one card on a test branch

`src/tabletop/specialActions.ts` contains an explicit rollout list:

```ts
export const enabledSpecialActionIds: readonly SpecialActionId[] = []
```

A card-specific test branch may add exactly one ID:

```ts
export const enabledSpecialActionIds: readonly SpecialActionId[] = ['SA5']
```

The list on `main` remains empty until that card’s isolated pull request has passed and its behavior has been reviewed. Runtime flags are deliberately not supported, so production cannot activate a card accidentally through deployment configuration.

## Required test sequence

Each Special Action receives its own pull request and must pass:

1. TypeScript and Vite production build.
2. Ordinary-game regression check with the rollout list empty.
3. Deal/refill check: hands remain four total cards.
4. Selection check on mobile docked, mobile undocked, and desktop hands.
5. Resolution check for the card’s exact written rule.
6. Story Table check: the Special Action is shown before the paired Strategy.
7. Hidden-information check when Private Needs are involved.
8. Next-round and next-Situation state check.

The card-specific branch must contain only the minimum engine, interface, test, and documentation changes needed for that one card.

## Rollout order

The order moves from isolated board effects to hidden-information and global-resolution effects:

1. **SA5 — Effective Communication**: introduce one Understanding Bonus Need.
2. **SA4 — Emergency Situation**: introduce two Bonus Needs.
3. **SA1 — Spontaneous Help**: replace one Public Need.
4. **SA7 — Deep Breath**: boost one selected effect by +3.
5. **SA6 — Unexpected Turn of Events**: activate Event effects globally.
6. **SA2 — Deep Introspection**: qualify through the acting Cognition’s Private Need.
7. **SA3 — Group Therapy Session**: qualify every Cognition through its Private Need.

Cards later in the order depend on more engine surfaces and therefore should not be combined with earlier work.

## Stable references

- The broad experimental implementation is preserved on `archive/special-action-parity-big-bang`.
- Pull request #35 records the original integrated design and build history.
- The proposed `Brainstorm Alternatives` solo rule remains excluded.
