# Inner Work

A browser adaptation of Nat Walsh's cooperative Nonviolent Communication card game.

The first release is a single-player experience in which one person guides three inner parts through situations, public needs, private needs, and competing strategies. The project is structured as a client-side game so it can be hosted on GitHub Pages while keeping the core state serializable for possible multiplayer work later.

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
