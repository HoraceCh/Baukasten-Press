# Baukasten Press agent instructions

## Project identity and safety

- Baukasten Press is an Obsidian plugin for producing controlled public copies from the `Baukasten_Nexus` vault.
- Develop the plugin in this repository. Never treat a vault plugin directory as the source workspace.
- Source notes are read-only inputs. Public copies and runtime data may be written only inside an explicitly configured publication scope.
- Do not modify `Baukasten_Nexus`, its `.obsidian` configuration, `98 Publish`, or user notes unless a later task explicitly authorizes a precise write scope.
- Do not implement a publishing destination, provider call, credential store, or local Agent execution contract before its interface is approved.

## Canonical UI direction

- Every Baukasten Press interface must follow [docs/design/UI_DESIGN.md](docs/design/UI_DESIGN.md). Read it before planning, implementing, or reviewing UI work.
- Use the project-local [baukasten-press-ui Skill](.agents/skills/baukasten-press-ui/SKILL.md) for UI implementation, UI review, accessibility review, or design-system changes.
- The visual direction is the Horace Linear-style adaptation described in the canonical document: compact, precise, low-ornament, hairline-defined, and state-forward.
- Preserve Obsidian's own interaction language. Linear-style geometry and hierarchy must not make the plugin look detached from the host application.

## Approved supporting UI skills

- `baukasten-press-ui` remains the primary UI workflow and design authority.
- Use `fixing-accessibility` for focused accessible-name, keyboard, focus, semantics, form-error, announcement, contrast, and reduced-motion review.
- Use `fixing-motion-performance` only when actual animation or transition code needs performance analysis.
- Use `review-animations` only for a strict review of retained motion after the canonical design has established that the motion is necessary.
- Supporting Skills are advisory and subordinate to this file and `docs/design/UI_DESIGN.md`. They must not add dependencies, introduce React/Tailwind/web component systems, expand file scope, change publication behavior, or override Obsidian-native theming.
- When a supporting Skill conflicts with the canonical “short, functional, minimal motion” direction, the canonical project rule wins. Prefer deleting unnecessary motion.

## Obsidian theme contract

- Scope every plugin style to `.baukasten-press` and its descendants. Never style Obsidian core elements globally.
- Derive colors from Obsidian semantic variables. Do not define a separate hard-coded light or dark palette.
- Do not use `:root`, `body`, `.theme-dark`, `.theme-light`, or `prefers-color-scheme` in plugin styles.
- Inherit the host font and use Obsidian-provided icons or existing platform primitives. Do not add a font, icon, CSS framework, or component-system dependency without explicit approval.
- Support Obsidian light theme, dark theme, community themes, narrow panes, reduced motion, and forced-colors mode.

## Interface behavior

- UI visibility is presentation, not authorization. Application and domain boundaries must enforce publication rules independently.
- Keep the source note visibly read-only wherever it appears beside an editable public copy.
- Make queue, generation, repair, regeneration, manual review, confirmation, publication, and intervention states explicit in text. Never rely on color alone.
- Cover loading, empty, error, stale, success, disabled, and unavailable states where the surface can encounter them.
- Explain why a destructive or unavailable action cannot run. Do not use a disabled control as the only explanation.
- Preserve a traceable difference between the source snapshot and each editable public-copy revision.
- Publication confirmation must name the action and destination, summarize the reviewed change, and require an explicit final confirmation. A preview must never imply that publication occurred.

## UI implementation boundaries

- Prefer native Obsidian APIs and semantic HTML elements over custom widgets.
- Keep commands, views, settings, and styles inside the existing project architecture. Do not import Astro, React, Next.js, Tailwind, or website components.
- Add shared primitives only after at least two real consumers require the same behavior.
- Use sentence case, direct verbs, and consistent action names. Empty and error messages must tell the user what happened and what to do next.
- Keep motion short and functional. Do not add ambient, scroll-driven, or decorative animation to workflow screens.

## Validation

- Inspect the working tree before editing and preserve unrelated user changes.
- Match validation to the retained change. UI work normally requires type checking, linting, a production build, selector-scope checks, and focused theme/accessibility review.
- Verify both light and dark themes in an isolated test vault when a rendered view exists. Never use the production `Baukasten_Nexus` vault as the development vault.
- Final reports must state the changed files, checks run, warnings, and confirmation that no vault or external system was modified.
