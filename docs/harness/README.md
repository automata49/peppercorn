# Pepper Harness

## Daily use

Run `npm ci`, then `npm run harness:check`. For UI work, run `npm run build` and the relevant browser tests. For Folio brand, Home, theme, loading, responsive or PWA changes, the minimum gate is:

```bash
npm run harness:check
npm run build
npm run test:identity
npm run test:ui
```

Claude Code reads `CLAUDE.md`; Codex reads `AGENTS.md`. Both lead to `docs/harness/CONTRACT.md` and `docs/harness/HANDOFF.md`. Folio identity work must also read `docs/design/FOLIO_IDENTITY_V2.md`.

Canonical skills are in `harness/skills`; `npm run harness:sync` generates `.claude/skills`, `.agents/skills` and plugin copies. CI rejects drift. For Folio visual work use both `folio-identity` and `pepper-ui`. Reviewers use `identity-reviewer` plus `ui-reviewer` for cross-device identity changes.

## Folio identity gate

The authoritative visual rule is the **seven identity files supplied by the user on 2026-10-07**, still within Folio's Sunset Editorial direction. `docs/design/FOLIO_DESIGN_BASELINE.md` remains Level-0 for layout/touch/type roles, while brand pixels come from the supplied files. `FolioWordmark` displays the supplied light/dark wordmark derivatives; `folio-b-icon-*` are static size derivatives of the supplied black icon; loading uses the supplied 9:16 hero; Home identity imagery uses the supplied Typography and Photography assets. Procedural redraws of the wordmark/xx/hero are prohibited. Robinhood remains a benchmark for hierarchy, simplicity, familiar navigation and progressive disclosure, not copied branding or trade-entry UI.

`scripts/harness/identity.mjs` is part of `npm run harness:check`. It verifies the design/contract files exist, exact B artwork files are committed, the exact-B CSS lock and Inter/Neue-Grotesk stack are present, the superseded Robinhood override and generic icon generator remain removed, theme modes stay present, and PWA/deploy references use only `folio-b-icon-*`. It also requires the app to place the B launch hero, B motif and C photography treatment. These source checks do not replace browser tests.

`npm run test:identity` runs the focused identity suite: launch/brand/PWA metadata, System/Light/Dark, compact B styling and compact titlebar behavior. The full `npm run test:ui` remains required before merge because identity changes can regress navigation, dialogs, sector exploration, charts and workspaces outside the focused suite.

Physical iPhone/iPad Safari is not implied by Chromium emulation. If it was not tested on-device, state that explicitly. An already installed iOS Home Screen icon may also require remove/re-add because the OS can retain the old icon independently of the web app theme.

## Position Growth

For Position Growth, read `POSITION_GROWTH.md` before changing collection, valuation, labels, UI, or thesis. It maps the supplied requirements to the current app and lists phase-by-phase acceptance checks. `npm run harness:check` also validates Position AI evidence fixtures and allowed database write targets; these offline checks do not activate a Position pipeline.

## Agent division and review

Default division: Claude plans/refactors, Codex implements/tests, then the other reviews only the diff and acceptance criteria. Reverse when useful. Avoid two simultaneous writers on the same branch/files. Reviewer definitions are in `.claude/agents` (Markdown) and `.codex/agents` (TOML); model selection inherits the user's client configuration, with no hard-coded paid model.

For identity/UI changes, the read-only reviewers must check B consistency across desktop/mobile/iPad, System/Light/Dark, PWA asset references, semantic gain/loss colours, touch/overflow behavior and unchanged investment/ranking rules.

## Hooks and permissions

Both clients have PostToolUse hooks for edits, backed by `scripts/harness/hook.cjs`. They run the fast contract gate, including deterministic identity invariants, not the browser suite on every keystroke. Shell-mediated edits may not match these tool filters: always run the final gates and rely on CI. Codex must trust the project and review the exact hooks through `/hooks`; the repository cannot grant that trust. Older clients without hook support still use the same npm commands and CI. These settings do not alter a managed ChatGPT session's permissions.

Codex config uses workspace-write/on-request; Exec Policy rules are narrow defense-in-depth, not a complete shell security boundary. Claude excludes local secret files from Read. Never enable bypass-permissions, overwrite global settings, or assume a rule blocks every equivalent shell command.

## Packaging

`plugins/pepper-harness` contains Claude and Codex compatibility manifests plus generated portable skill content. Optional local Claude installation: `claude --plugin-dir ./plugins/pepper-harness`. Codex plugin distribution follows the official local marketplace flow; project-scoped skills already work without installing the plugin. Do not enable both repo skills and the optional plugin if duplicate skill discovery is distracting. Hooks, project policies and review agents remain in the repository; installing the skill bundle alone is not full project setup.

## Evidence and limits

AI Analyst schema/fixtures are offline engineering gates. They check provenance references, dates, strategy separation and unavailable/missing-data states. They cannot determine whether a natural-language claim is entailed by a source. Before enabling a live provider, add sourced financial golden cases, adversarial source-instruction cases, numerical recomputation, human factual review, provider timeout/cost tests and secret-safe telemetry. The current checkout has no live Analyst adapter; no model service is activated by this setup.

UI tests use synthetic market responses and never write to production. They inspect actual rendered CSS/layout and interactions. Browser results cover Chromium emulation, not a physical iPad Safari session.

## Official configuration references (checked 2026-09-28)

- https://learn.chatgpt.com/docs/agent-configuration/subagents
- https://learn.chatgpt.com/docs/hooks
- https://learn.chatgpt.com/docs/agent-configuration/rules
- https://developers.openai.com/plugins/build/plugins
- https://code.claude.com/docs/en/hooks
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/plugins-reference

Do not assume a feature's availability merely from the comparison table; verify installed client versions and hook trust.
