# Inner Work

A browser adaptation of Nat Walsh's cooperative Nonviolent Communication card game.

The first release is a single-player experience in which the human controls **Cognition α** while two rule-based NPCs control **Cognition β** and **Cognition γ**. All three respond to situations, public needs, private needs, and competing strategies on behalf of one shared psyche. The project is client-side so it can be hosted on GitHub Pages while keeping the core state serializable for possible multiplayer work later.

## Current NPC model

- Cognition β favors strategies that provide broad shared benefit.
- Cognition γ gives greater weight to its own neglected public and private needs.
- NPC Strategy hands and Private Needs remain hidden from Cognition α.
- NPCs follow the same play-legality rules as the human and do not inspect the human player's hidden information.

## Strategy resolution rule

A Strategy's complete value applies independently to **every matching Need in play**. Its strength is never divided among matching Need cards or players.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

Merges to `main` are built and deployed by `.github/workflows/deploy-pages.yml`.

## Data notes

The canonical card data is normalized from `CardGameData.xlsx`. The digital adaptation currently treats the Situation need `Fun` as the Need deck's `Play`. Strategy-only needs such as Privacy and Love/Caring remain valid secondary effects even though they do not currently appear in the Need deck.
