# Folio XX — approved visual regression baseline (2026-10-17)

The visual snapshots in `tests/four-screen-visual.spec.ts-snapshots/` were refreshed on the pinned GitHub Actions Linux Chromium environment after the approved editorial home, unified Journal, review and typography changes.

Coverage: Today, Discover, Journal and Journey at 390, 834, 1366 and 1440 pixels, each in Light and Dark themes.

Future UI changes must continue to satisfy `npm run test:four-screens`; do not automatically update snapshots during production deploys. Layout regressions should be fixed before new baseline images are explicitly reviewed. The one-time snapshot update workflow removed itself after committing the new baseline.
