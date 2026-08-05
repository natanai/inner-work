# Inner Work card-game UX principles

This document records the interaction rules that should guide future mobile and desktop work. It exists to prevent each screen from inventing a new hierarchy, badge, modal, or explanation pattern.

## 1. The hand is the primary interaction surface

Players should be able to scan, inspect, compare, and choose cards without first navigating through explanatory screens. The normal card view should show only the information needed to make the next decision. Full contribution logic belongs in an optional detail layer.

Applied in Inner Work:

- Card art, playability, and the primary action remain visible.
- “More contribution details” contains provenance and complete effect accounting.
- Explanations should not repeat what the card, button label, or current screen already communicates.

## 2. One control should lead to one task

A button must not open a second control that merely repeats the same action. A planning sheet should not contain a Trade button immediately followed by a collapsed “Trading” toggle.

Applied in Inner Work:

- The Trade tile enters a dedicated trade workspace in the existing planning sheet.
- The workspace has one clear Back path to planning.
- Suggested and directed trades share the same workspace.

## 3. Keep modal work scoped and shallow

Modal interfaces interrupt the table. Use them only for a distinct task, keep that task short, and avoid stacking modal hierarchies or creating an “app inside the app.”

Applied in Inner Work:

- Planning is one sheet with an overview and a focused trade state.
- Magnifier actions use their own single-purpose flow.
- Card inspection does not become a navigation hub.

## 4. Use progressive disclosure for secondary reasoning

Players need the next decision before they need the complete explanation. Hide advanced accounting until requested, but make the disclosure label accurately describe what will appear.

Applied in Inner Work:

- Quick summaries answer “Can I use this, and for what?”
- Details answer “Why, how much, and where did this Bonus Need come from?”
- Planning guidance and trade rationale remain optional.

## 5. Reuse one visual grammar for repeated game concepts

The same game object must not acquire different fonts, alignments, symbols, or meanings on different screens.

Applied in Inner Work:

- Every circular Cognition marker uses `CognitionSeatBadge`.
- The badge always displays seat 1, 2, or 3.
- Owner color, typeface, centering, accessible label, and numeric styling live in one component and one final CSS system.
- Internal `alpha`, `beta`, and `gamma` ids never become display text.

## 6. Preserve provenance for generated game objects

When a card creates a later opportunity, players need to understand why it exists. Provenance should appear where the generated object is explained, not as permanent clutter in the quick scan.

Applied in Inner Work:

- Active Bonus Need details identify the Strategy, Cognition, and round that introduced them.
- Quick summaries remain concise.

## 7. Design mobile card interaction around limited space

Mobile has no hover and little room for simultaneous text, art, and controls. Keep the hand accessible, enlarge one card for inspection, and use horizontal paging only where the player understands that multiple peer options exist.

Applied in Inner Work:

- The hand remains a physical stack/carousel.
- Suggested trades use a horizontal snap sequence inside the trade workspace.
- Need cards begin immediately beneath the Situation instead of being preceded by a redundant explanatory banner.

## Sources

- Apple Human Interface Guidelines — Modality: https://developer.apple.com/design/human-interface-guidelines/modality
- Apple Human Interface Guidelines — Sheets: https://developer.apple.com/design/human-interface-guidelines/sheets
- Apple Human Interface Guidelines — Disclosure controls: https://developer.apple.com/design/human-interface-guidelines/disclosure-controls
- Apple Human Interface Guidelines — Layout: https://developer.apple.com/design/human-interface-guidelines/layout
- GDC Vault — Usability Lessons from Mobile Board Game Conversions: https://www.gdcvault.com/play/1021173/Usability-Lessons-from-Mobile-Board
- GDC Vault — Hearthstone: How to Create an Immersive User Interface: https://gdcvault.com/play/1022036/Hearthstone-How-to-Create-an
- GDC Vault — The Beauty and Challenge of Mixing Physical and Digital Games: https://www.gdcvault.com/play/1017701/The-Beauty-and-Challenge-of
