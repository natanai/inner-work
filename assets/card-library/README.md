# High-resolution card library

The production build expects one archive in this folder:

`inner-work-high-resolution-card-library-v2.zip`

The archive contains 108 native-resolution WebP files:

- 54 Strategy fronts at 750×1050 pixels
- 30 Feeling/Need fronts at 750×1050 pixels
- 21 Situation fronts at 1050×750 pixels
- 3 original card backs

Verified SHA-256:

`39250b82f031310c871aa5de8b92c62be2b3e7dab0453af41ec5fdf5d92c75e0`

The build deliberately fails when the archive is missing or altered. `scripts/restore-card-assets.mjs` extracts it into `public/cards/` and verifies every WebP file before Vite builds the site.
