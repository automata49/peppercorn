# Obra + Folio editorial system

User direction, 2026-10-12: use Obra across all destinations, including stock detail; magazine typography on Home, large headings and key statements. This supersedes the historical Today-only Obra scope.

Obra Community is a Figma companion for shadcn/ui, not a React package installed in this app. Reference: https://shadcn.obra.studio/documentation and https://www.figma.com/community/file/1514746685758799870. Folio implements its own shared semantic-token adapter and uses existing shadcn composition/Radix primitives. No Figma artwork or Pro components are copied.

`folio-baseline.css` owns control dimensions and editorial roles; `obra.css` maps background/foreground/primary/secondary/border/input/ring to the existing root theme. Existing button/tab/dialog/input geometry remains in its owning module. Shared Button now also owns the stock-detail actionbar. Legacy semantic controls share minimum height, UI font, radius, disabled and keyboard-focus treatment. Approved Motion covers and glass classification/gallery surfaces retain their own geometry. Market colours, data/ranking/chart history, account isolation and original journal artwork are unchanged.

Three heading expressions are selectable under Settings → 매거진 타이포그래피 and persisted per device as `folio-editorial-style`:

| Expression | Title font | Treatment |
| --- | --- | --- |
| 모던 매거진 (default) | Folio grotesk stack | Medium weight, tight tracking, generous whitespace |
| 클래식 에디토리얼 | Self-hosted Folio Editorial Serif (Noto Serif CJK KR subset, OFL) / platform serif fallback | Regular serif titles, taller line height |
| 아트 저널 | Folio grotesk stack | Heavy title weight and stronger tracking |

Header/cover/journal titles, stock name, Insight headings and key statements share editorial roles. Numeric prices, tables, chart labels, body text, metadata and controls retain the UI font. Classic lazily loads `public/fonts/folio-editorial-serif.woff2`, a renamed Noto Serif CJK KR Regular subset covering all precomposed Korean syllables, Hangul jamo, Latin and punctuation. The original embedded copyright and upstream SIL OFL are included in `public/fonts/OFL.txt`. Default grotesk uses platform faces. Font fallback and rasterization still differ across OS; physical Safari remains unverified. Supplied FolioWordmark/icon/launch artwork stays authoritative.

Acceptance: style persists across navigation/reload; invalid preferences fall back to modern; font choice doesn't affect numeric calculation; control focus/disabled states remain clear; no horizontal clipping at 390/834/1366/1440; Light/Dark theme remains inherited in detail and fixed bars. Four-screen snapshots require inspected updates.
