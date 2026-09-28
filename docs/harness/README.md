# Pepper Harness

## Daily use

Run `npm ci`, then `npm run harness:check`. For UI work, run `npm run build` and `npx playwright install chromium`, then `npm run test:ui`.

Claude Code reads CLAUDE.md; Codex reads AGENTS.md. Both lead to CONTRACT.md. Canonical skills are in harness/skills; `npm run harness:sync` generates .claude/skills, .agents/skills and plugin copies. CI rejects drift.

Default division: Claude plans/refactors, Codex implements/tests, then the other reviews only the diff and acceptance criteria. Reverse when useful. Avoid two simultaneous writers on the same branch/files. Reviewer definitions are in .claude/agents (Markdown) and .codex/agents (TOML); model selection inherits the user's client configuration, with no hard-coded paid model.

## Hooks and permissions

Both clients have PostToolUse hooks for edits, backed by scripts/harness/hook.cjs. They run the fast contract gate, not the full browser suite on every keystroke. Shell-mediated edits may not match these tool filters: always run the final gates and rely on CI. Codex must trust the project and review the exact hooks through `/hooks`; the repository cannot grant that trust. Older clients without hook support still use the same npm commands and CI. These settings do not alter a managed ChatGPT session's permissions.

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
