# Inner Work rulebook parity audit

_Last reviewed against the physical-game source materials and web app on 2026-08-03._

This document separates three things that can otherwise get blurred together:

1. **Physical rule:** what the rulebook or printed card explicitly establishes.
2. **Web behavior:** what the current TypeScript engine actually does.
3. **Product interpretation:** interface or solo-mode choices that help the web app express the physical game without silently changing its rules.

Statuses:

- **Aligned** — the engine follows the physical rule.
- **Partial** — the rule exists, but the app narrows or automates part of the choice.
- **Missing** — the physical option is not available in the app.
- **Blocked** — the available source wording is too ambiguous to implement without a design decision.
- **Web adaptation** — not a physical rule, but does not alter resolution.

## Setup and information

| Rule area | Physical rule | Current web behavior | Status | Required work |
|---|---|---|---|---|
| Need draw | Each player draws three Need cards. | Each Cognition receives three Need cards. | Aligned | None. |
| Choose Private Need | The player sees all three Needs, chooses one as Private, and places the other two face up as Public Needs. | The human chooses one of three face-up cards before taking their seat. NPCs choose automatically. | Aligned | Keep NPC choice policy documented as an automation, not a different rule. |
| Memorize Private Need | The chosen Private Need is seen before being placed face down. | The chosen card receives a dedicated memory step before it turns face down. | Aligned | None. |
| Initial gifts | Place one gift on each of the three Needs. | Private Needs begin with one gift. Public Needs begin at one before Situation setup. | Aligned | None. |
| Situation modifiers | Add the Situation’s listed gifts to matching Public Needs. | Situation setup adds matching modifiers to each Public Need. | Aligned | None. |
| Feeling multiplier | The named feeling doubles the affected Public Need after modifiers. | The app records base, Situation addition, multiplier, and final total. | Aligned | None. |
| Private Need setup | Situation modifiers do not alter the face-down Private Need. | Private Needs remain at one gift. | Aligned | None. |
| Strategy hand | Each player draws four Strategy cards. | Each Cognition holds four Strategies and refills to four after a played/discarded card leaves. | Aligned | Verify the physical discard/refill timing in the final edited rulebook. |
| Situation deck orientation | Situation cards are placed landscape. | The web deck and played Situation preserve a landscape footprint. | Aligned | None. |

## Planning, legality, and trading

| Rule area | Physical rule | Current web behavior | Status | Required work |
|---|---|---|---|---|
| Strategy legality | A Cognition may play a Strategy when it tends one of that Cognition’s unresolved Public Needs or an active Bonus Need. | `canPlay` uses the acting Cognition’s unresolved Public Needs and active Bonus Needs. | Aligned | Add automated legality tests for ordinary and Event situations. |
| Private Need restriction | A Strategy cannot be played directly for a Private Need. | Private Need matches never make a card legal. | Aligned | Preserve this invariant in Special Action implementations except where a printed Special Action explicitly overrides it. |
| Incidental tending | Once a Strategy is legally played, all of its matching effects may tend matching Needs across the shared psyche, including Private Needs. | Legal Strategies combine their positive effects across all matching Public Needs and secretly resolve matching Private Needs. | Aligned | Add regression tests that private matches affect scoring without becoming player-facing guidance. |
| Discard | A card that cannot be used may leave the hand according to the play/discard procedure. | The player can commit a non-legal card as a discard; it contributes no effects and is replaced next round. | Aligned | Confirm whether the physical rule permits discarding a legal card by choice. The web app currently does. |
| Trading quantity | Players may trade any number of Strategy cards during discussion. | The app currently generates suggested one-for-one swaps. | Partial | Add player-directed requests, selectable offers, counteroffers, and multi-card exchange support. |
| Hidden hands | Other players’ hands remain private except for cards intentionally offered. | NPC hands remain face down; a proposed return card is revealed. | Aligned | Directed requests must continue to reveal only concrete offered cards. |
| Negotiation | Players decide what they seek and what they are willing to exchange. | NPC utility currently decides which proposed swaps are surfaced. | Partial | Let the player request a Need/effect, choose an offered card, and select what to offer in return. |
| Simultaneous reveal | Chosen Strategies reveal together after planning. | All three Strategies reveal together. | Aligned | None. |

## Magnifying Glass

| Rule area | Physical rule | Current web behavior | Status | Required work |
|---|---|---|---|---|
| Frequency | A Magnifying Glass action may be used once per Situation. | Each Cognition tracks `magnifierUsed`, reset at the next Situation. | Aligned | None. |
| Review Private Need | One listed action is to review the player’s own Private Need again. | The human can confirm spending the magnifier, inspect the card, and return it face down. | Aligned | None. |
| Confirmation | The physical act is deliberate because the token/action is spent. | The web app explains the consequence and asks for confirmation before spending it. | Web adaptation | None. |
| Other Magnifying Glass actions | The rulebook presents Magnifying Glass use as a choice of actions, not merely a dedicated reveal button. | Only the confirmed “review your Private Need” action is represented. | Missing / source review | Transcribe every remaining action verbatim from the authoritative rulebook edition, then implement only those actions. Do not infer them from theme. |

## Special Action cards

The source card data contains seven Special Actions. The active engine currently imports only ordinary Strategies, Needs, and Situations; therefore none of these cards creates a planning choice in the web app.

| Card | Printed/source action | Current web behavior | Status | Implementation note |
|---|---|---|---|---|
| Spontaneous Help | During discussion, replace a Public Need with a new one. | Unavailable. | Missing | Needs an ownership-preserving replacement flow and a clear rule for gifts/Situation setup on the replacement. |
| Deep Introspection | At the start of play, permit a card to be played for the holder’s Private Need when one is in hand. | Unavailable. | Missing | This is an explicit exception to ordinary legality. The UI must not reveal whether a hidden match exists before the player elects to use the card. |
| Group Therapy Session | During discussion, allow all players to play for their Private Needs when possible. | Unavailable. | Missing | Requires a one-round legality override for all Cognitions while preserving hidden information. |
| Emergency Situation | During discussion, introduce two new Need cards as Bonus opportunities. | Unavailable. | Missing | Needs an explicit source for starting gifts and whether Situation modifiers apply. |
| Effective Communication | Introduce a new Need card; the imported source text also contains `Understanding:-`. | Unavailable. | Blocked | The source syntax is malformed/underspecified. Do not guess whether this creates Understanding, modifies Understanding, or has another cost. |
| Unexpected Turn of Events | During discussion, trigger Event effects on active cards. | Unavailable. | Missing | Requires a round-scoped Event-effect override, including effects on the three Strategies ultimately played. |
| Deep Breath | At the start of play, boost a Strategy effect by three. | Unavailable. | Missing | Requires selection of the Strategy and affected Need/effect; confirm whether the boost is +3 to one printed effect or another interpretation. |

### Special Action acquisition is not yet safe to implement

Before enabling these cards, the authoritative rulebook must answer:

- How are Special Actions drawn or awarded?
- Are they held privately, publicly, or in a shared inventory?
- How many may a player hold?
- Does using one replace the player’s Strategy for the round?
- Where does a used card go, and can the deck recycle?
- At what exact point within “discussion” or “start of play” does priority pass between players?

Until those answers are transcribed, the cards remain documented but disabled. This is preferable to creating a web-only acquisition rule and accidentally treating it as physical parity.

## Resolution and scoring

| Rule area | Physical rule | Current web behavior | Status | Required work |
|---|---|---|---|---|
| Public resolution | Effects from legal Strategies tend matching Public Needs; those gifts form the shared/group score. | Positive effects from all legal selections are combined by Need, capped by gifts remaining, and added to the shared score. | Aligned | Add tests for overlap, caps, and multiple Cognitions sharing the same Need. |
| Private scoring | A tended Private gift belongs to that Private Need’s owner. | Private matches are combined secretly and awarded to the owning Cognition’s individual score. | Aligned | None. |
| Private secrecy | Other players should not learn the identity of a Private Need merely because it was or was not tended. | Guidance omits Private matches; Story mode says only that a hidden Private Need was tended. | Aligned | Continue auditing new guidance for indirect confirmation leaks. |
| Bonus Needs | Bonus Need gifts are individual opportunities and do not block Situation completion. | Active Bonus Needs award individual points and are excluded from the completion test. | Aligned in principle | Confirm the physical tie rule and award timing against the final rulebook wording. |
| New Bonus timing | A Bonus Need created by a played Strategy enters play on the following round. | New Bonus Needs receive `availableRound = current round + 1`. | Aligned | None. |
| Complete Situation | Move on only after every required Public gift is gone. | The phase becomes complete only when all six Public Need slots have zero gifts. | Aligned | None. |
| Story/retelling | Players explain what was played and why, connecting behavior to needs. | A dedicated Story Table resolves NPC examples first and the human response last. | Web adaptation supporting the physical intent | Continue treating this as the central payoff, not optional flavor text. |

## Between Situations

| Rule area | Physical rule | Current web behavior | Status | Required work |
|---|---|---|---|---|
| Met Private Need | If the Private Need was met, draw three new Needs and choose a new Private Need. | The human returns to the three-card Private selection flow. | Aligned | Verify NPC replacement follows the same information constraints. |
| Unmet Private Need | Retain the existing Private Need and draw two new Public Needs. | An unmet Private Need persists while two Public Needs are replaced. | Aligned | None. |
| New Situation | Draw a new Situation and reapply Public setup. | The next Situation resets Public setup, magnifier use, round count, and clears Situation-scoped Bonus Needs. | Aligned | Confirm whether any Special Action inventory persists across Situations. |

## Known data issues that affect parity

These are card-data questions, not interface preferences:

- Strategies reference **Privacy**, **To be heard**, **Love/Caring**, and **Order**, but those Needs are absent from the 30-card Need deck.
- The imported Effective Communication Special Action text is malformed.
- The exact award/tie wording for active Bonus Needs should be quoted from the authoritative rulebook.
- The rulebook and card data should use one canonical term where historical files differ, such as Play versus Fun.

The web app should not silently normalize these questions. Each should be resolved in the physical source first, then changed in both data and rules documentation together.

## Choice-floor conclusion

Ordinary card legality is largely aligned, but parity is not complete because two major sources of agency are narrowed or absent:

1. trading is automated into suggested one-for-one swaps rather than player-directed negotiation;
2. the Special Action system and additional Magnifying Glass choices are not active.

The next balancing decision should therefore be based on measured play **after** those physical choices are restored. No new solo safety-valve rule should be adopted before that measurement.