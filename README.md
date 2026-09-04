# Baukasten Press

Baukasten Press (`baukasten-press`) is an Obsidian plugin for creating and publishing controlled public copies of notes from the `Baukasten_Nexus` vault.

This repository is deliberately separate from the vault. The vault's `.obsidian/plugins` directory is only a later manual-test target for compiled release artifacts; it is not the development workspace.

## Current status

The current foundation provides:

- a minimal loadable Obsidian plugin entry point;
- an Obsidian command that adds the active Markdown note to a persistent pending queue;
- the official sample plugin's TypeScript, esbuild, and ESLint approach;
- initial domain types for the agreed publication workflow;
- a project-local Horace Linear-style UI baseline adapted to Obsidian themes;
- no publishing integration, model call, custom queue view, or source-note write.

## Add the current note to the queue

With a Markdown note active, run **Baukasten Press: 加入待处理队列** from Obsidian's command palette. The command records only the note's vault-relative `sourcePath` and an ISO `queuedAt` timestamp. Adding the same path again leaves the queue unchanged and shows a native Obsidian notice.

The schema-v1 queue is stored through Obsidian's plugin data API in Baukasten Press's own `data.json`:

```json
{
  "schemaVersion": 1,
  "queue": [
    {
      "sourcePath": "folder/note.md",
      "queuedAt": "2026-08-02T00:00:00.000Z"
    }
  ]
}
```

The command does not read or modify the note body, frontmatter, or any other vault file. A queue view, source snapshots, public-copy generation, Agent execution, review, and publishing remain outside this feature.

## Safety boundaries

- Source notes are read-only inputs.
- Pending-queue metadata is stored only in the plugin-owned `data.json` through Obsidian's plugin data API.
- A public copy and processing runtime data may only be written under an explicitly configured publication scope.
- No publication scope is selected by default.
- Agent profiles, subtasks, and repair loops belong to Baukasten Press and must remain isolated from general-purpose vault agents.
- This project must not modify `Baukasten_Nexus`, its `.obsidian` configuration, `98 Publish`, or user notes during development.

## Planned workflow boundaries

The UI and orchestration will be added incrementally under these boundaries:

1. Add the active note to the publication queue.
2. Process queued notes into public copies and run an initial check.
3. Attempt at most two repairs, then at most one full regeneration.
4. Route remaining failures to manual intervention.
5. Review the read-only source beside an editable public copy with traceable differences.
6. Confirm publication and retain a published record.
7. Configure publication rules and Baukasten Press-specific agent profiles.

Source layout:

- `src/main.ts`: Obsidian lifecycle entry point and future feature registration.
- `src/domain/publication.ts`: workflow vocabulary and safety-relevant data shapes.
- `src/application/publication-queue.ts`: schema-v1 queue validation and idempotent enqueue behavior.
- `docs/design/UI_DESIGN.md`: canonical UI, theme, accessibility, and workflow-state contract.
- `.agents/skills/baukasten-press-ui/SKILL.md`: repeatable workflow for implementing and reviewing plugin UI.
- `styles.css`: Obsidian-native, `.baukasten-press`-scoped design tokens and baseline component styles.
- Future `src/ui/`: Obsidian views, commands, and settings UI.
- Future additions under `src/application/`: later workflow coordination beyond the pending queue.
- Future `src/adapters/`: storage, model-provider, OpenCode, and publishing integrations selected later.

## UI baseline

All Baukasten Press interfaces use the canonical rules in `docs/design/UI_DESIGN.md`. The direction adapts Horace's Linear-style precision to Obsidian: compact spacing, hairline structure, restrained surfaces, explicit publication states, and minimal motion.

Colors, typography, focus, and theme contrast come from Obsidian semantic variables. Plugin CSS must remain under `.baukasten-press`; it must not override Obsidian core styles or define separate light and dark palettes. This makes the baseline compatible with Obsidian light, dark, and community themes. UI work must also preserve keyboard access, visible focus, reduced motion, forced colors, read-only source ownership, traceable differences, and explicit publication confirmation.

## Development

Prerequisites:

- [mise](https://mise.jdx.dev/) is the project-local toolchain resolver. On Windows, install it with Scoop or WinGet; on Linux or WSL, use `mise.run`; on macOS, use `mise.run` or Homebrew. From this repository root, run `mise --version`, `mise install`, and `mise config` to record the available resolver and effective configuration. Shell activation is optional.
- npm is the package manager used by this project. `packageManager` and `devEngines` are declarative npm-native metadata and guards; repository acceptance is enforced by `mise exec -- npm run validate`, not independently by `npm run dev` or `npm run build`.

On Windows, use PowerShell or Windows Terminal at the repository root after installing mise. On WSL, Linux, and macOS, open a shell at the repository root after installing mise. In every environment, run `mise install` first, then use `mise exec -- npm ci` and `mise exec -- npm run validate`. A `mise.local.toml` or `mise.local.lock` may contain only local resolver state and is intentionally ignored.

Global Node.js or npm installations may coexist, but local, parent, and global mise overrides may not change the tracked Node.js 24.14.1 and npm 11.19.1 pins. Trust is limited to configuration content, not a directory, parent configuration, or global installation. macOS toolchain support likewise does not grant canonical-root admission; the environment contract remains the sole admission boundary.

Commands:

```sh
mise exec -- npm ci
mise exec -- npm run dev
mise exec -- npm run typecheck
mise exec -- npm run lint
mise exec -- npm run build
```

`npm run dev` watches `src/main.ts` and writes `main.js`. `npm run build` performs a type check and creates a minified production bundle. The generated `main.js` is intentionally ignored by Git.

On the scaffold machine, the system npm cache was not writable, so the initial install used `npm install --cache .npm-cache`. That project-local cache is ignored by Git and can be used again if the same permission issue recurs.

For a later manual test, copy `manifest.json`, the generated `main.js`, and `styles.css` into a test vault at `.obsidian/plugins/baukasten-press/`. Do not use the production `Baukasten_Nexus` vault as the development vault.

## Environment and unresolved interfaces

The following choices are intentionally deferred until their contracts are agreed:

- the publication-scope layout and persistence format beyond the plugin-owned pending queue;
- how source snapshots and editable public-copy revisions are stored for traceable diffs;
- the website publishing target and its confirmation/rollback contract;
- credential storage and transport for OpenAI, Anthropic, DeepSeek, and compatible endpoints;
- the local, non-destructive OpenCode invocation contract;
- model-profile schema, task prompts, cancellation, retry, and audit records;
- whether future local execution requires marking the plugin desktop-only;
- the minimum supported Obsidian version for the first release.
- release author attribution and repository license.

Until those decisions are made, the project contains no real provider or publishing implementation.
