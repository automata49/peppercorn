# Folio xx — lifetime UI implementation

## LIFETIME-JOURNEY-1 — user decision 2026-10-10 (current)

This decision supersedes older Home/navigation placement rules only. Primary navigation is **오늘 / 발견 / 저널 / 여정**. Today follows the Motion App Store editorial demo: four large cover cards in a staggered 3:2 / 2:3 desktop grid, one-column phone layout, shared frame/image/title expansion into an accessible detail, and reverse transition to the original card. Covers contain the latest own page, a question/due review, discovery, and journey; supplied assets remain authoritative. The former analytical Home remains accessible as **시장 요약** (`dashboard`); its existing market/category/leader/ETF parity contracts still apply there. Discover retains the existing stock analysis and ranking. Journal links to the canonical Thesis, Research and Trading Journal editors. Journey adds a read-only personal timeline before interest/holdings/trade tabs. No screening, ranking, market colours or supplied brand assets change.

Six implementation stages: Folio-token shadcn-style Button/Slot/CVA primitives; Radix Tabs and Dialog focus/keyboard behavior; Motion shared-element journal card transitions respecting reduced motion; lazily loaded Lightweight Charts actual daily close zoom (existing PriceRsChart remains the default); lazy Tiptap structured journal editor with photo, vector ink, questions and dated revisions; Ticker-inspired web digit transitions retaining exact accessible values (no Android package). Existing GSAP owns launch only.

New lifetime entries are **device-local, account-scoped IndexedDB**, explicitly labelled, with JSON export/import; existing cloud workspaces are unchanged. No claim of cloud sync, OCR, native PencilKit or live AI. Pen/mouse ink is implemented; physical Apple Pencil/Safari fidelity requires device validation. Backup imports do not overwrite existing records. Per-entry atomic writes preserve other tabs and reject stale same-record edits. Notebook payload is limited before saving to preserve export/import round trips. Questions are editable answers from fixed prompts, not generated investment advice.

Keep body content legible on Paper. Glass is for interactive controls and transient surfaces; existing analytical glass contracts remain. Minimum 44px controls, canonical 390/834/1366/1440 checks, supplied wordmark, default Light, Dark/System, and existing chart gap/RS rules remain acceptance criteria. New notebook tests cover create/reload/revision, concurrent tabs, backups, photo/ink, keyboard tabs, reduced motion and real-close chart.

## Reference implementations

- https://github.com/shadcn-ui/ui (composition pattern; theme-owned CSS)
- https://github.com/radix-ui/primitives
- https://github.com/motiondivision/motion
- https://examples.motion.dev/react/app-store (home composition and card-to-detail motion)
- https://github.com/tradingview/lightweight-charts (in-chart attribution + link retained)
- https://github.com/ueberdosis/tiptap (open editor, no paid service integration)
- https://github.com/robinhood/ticker (behavioral reference; independent web implementation)

## Storage boundary

New local pages use a separate notebook for guest and each authenticated account. Existing Research/Thesis/Trading Journal records retain original stores and identities. Saving an edited page appends the previous version; no auto-generated content overwrites user writing. Photo previews are resized to 1400px JPEG and original upload is not retained; vector ink remains editable. Export is the user-facing backup path; cloud media synchronization is a follow-up, not claimed complete.
