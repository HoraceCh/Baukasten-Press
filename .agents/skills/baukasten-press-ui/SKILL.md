---
name: baukasten-press-ui
description: Design, implement, or review Baukasten Press Obsidian interfaces using the project's Horace Linear-style system, host-native light/dark/community theming, publication-state semantics, and accessibility constraints. Use for any Baukasten Press view, modal, command UI, settings surface, CSS change, interaction polish, or UI quality audit.
---

# Baukasten Press UI

Use this workflow for one coherent plugin surface at a time.

## Establish the contract

1. Read `AGENTS.md` and `docs/design/UI_DESIGN.md` completely.
2. Name the user task, the current publication stage, the source-of-truth data, and every action the surface may trigger.
3. Trace existing Obsidian view, command, setting, and CSS ownership before proposing new files or primitives.
4. Keep source notes read-only and keep preview, confirmation, and publication states semantically distinct.

## Plan the surface

- List loading, empty, error, stale, success, disabled, unavailable, and intervention states that can actually occur.
- Identify one primary action for each decision region and name its exact effect.
- Choose semantic HTML and native Obsidian APIs first.
- Reuse existing project classes and tokens. Add a shared primitive only when multiple real consumers need it.
- Keep every style under `.baukasten-press`; derive color and focus from Obsidian variables.

## Implement with restraint

- Express the Linear-style direction through compact spacing, 6px controls, 12px panels, hairline borders, quiet surfaces, and clear state hierarchy.
- Inherit host typography and icons. Do not add UI packages, web frameworks, fonts, or icon libraries without explicit approval.
- Preserve visible labels for state and safety. Color, icons, and motion are supporting signals only.
- Keep motion functional, interruptible where relevant, and removable under reduced motion.
- Do not change domain, security, publication, or persistence behavior as UI polish.

## Accessibility pass

Verify accessible names, field labels, keyboard order, visible focus, native semantics, modal focus handling, error associations, live status announcements, non-color state cues, disabled explanations, narrow-pane behavior, reduced motion, and forced colors.

Prefer a small semantic correction over an ARIA-heavy custom widget. Do not use a toast as the only record of a critical result.

## Theme pass

Check the surface with Obsidian light and dark themes and at least one community theme when rendered testing is available. Reject fixed palette values, global selectors, theme-class overrides, and OS color-scheme detection. Confirm that accent-colored controls retain readable text and focus.

## Validation and report

Run the checks appropriate to the retained files: selector-scope search, type check, lint, production build, and focused rendered review. Report exact files, states tested, theme/accessibility results, remaining warnings, and whether any vault or external system was touched.

## Provenance

This project-authored workflow is informed by the Horace Linear design references and by the MIT-licensed `ibelick/ui-skills` UI-audit, accessibility, and motion-performance snapshots recorded in `F:\Projects\Horace_Website_Admin\skills-lock.json`. It is rewritten for Obsidian and contains no React, Astro, Next.js, Tailwind, or third-party component code.
