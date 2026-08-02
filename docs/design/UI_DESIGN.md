# Baukasten Press UI design system

## Purpose

Baukasten Press is a controlled-publication workbench for an author who needs to move a note through preparation, inspection, human review, and explicit publication without losing the relationship to the source. Its interface should feel like a precise instrument inside Obsidian: compact enough for repeated use, quiet enough for long review sessions, and unambiguous about state and authority.

This document is the canonical UI contract for every command, view, modal, settings surface, and notice owned by Baukasten Press.

## Source and adaptation boundary

The visual direction is an original Obsidian adaptation informed by:

- `F:\Projects\Design\Linear\DESIGN.md` and its identical Horace Website backup;
- the light/dark surface hierarchy in `F:\Projects\Horace_Website\src\styles\global.css`;
- the compact publication panels, tables, status rows, and diff presentation in `F:\Projects\Horace_Website_Admin`;
- the reviewed accessibility and UI-audit practices stored in the Horace projects.

These sources are references, not implementation dependencies. Do not copy Linear branding, product screenshots, proprietary assets, website layouts, framework components, fixed color palettes, or external fonts. Do not claim affiliation with Linear. In this project, “Linear-style” describes compact geometry, restrained surfaces, hairline structure, tight hierarchy, and state-forward interaction.

## Design principles

### 1. State is the visual subject

The publication lifecycle is the interface's defining structure. Queue position, current stage, attempt counts, review readiness, stale data, and publication confirmation must be easier to scan than decorative content.

The signature element is the **publication trail**: a real ordered sequence from queued to published, annotated with completed checks, repair/regeneration attempts, and intervention points. It exists because order and provenance are meaningful, not as decoration.

### 2. Precision without visual noise

- Use a 4px spacing base and compact control density.
- Use 6px radii for controls and small status elements.
- Use 12px radii for panels and large contained regions.
- Separate regions with one-pixel semantic borders; avoid ambient drop shadows.
- Use one primary action per decision area. Secondary actions remain neutral.
- Keep headings modest. Workflow screens are tools, not landing pages.

### 3. Native to Obsidian

Linear-style character comes from geometry, density, and hierarchy. Color, typography, and focus behavior come from Obsidian so the plugin remains coherent with built-in and community themes.

- Inherit the host interface font.
- Use Obsidian semantic color variables.
- Use native Obsidian controls and icons when they express the required behavior.
- Never override the application's global theme or core component styling.

### 4. Safety is visible but not theatrical

Show read-only, preview, stale, unavailable, and pending-confirmation states in plain language. Use warning and error color only as supporting signals. Avoid alarm-heavy banners for ordinary workflow information.

## Theme and token mapping

All component selectors live under `.baukasten-press`. The project aliases below describe roles; `styles.css` maps them to the host.

| Baukasten Press role | Obsidian source |
| --- | --- |
| Canvas | `--background-primary` |
| Raised surface | `--background-primary-alt` |
| Muted surface | `--background-secondary` |
| Hovered surface | `--background-modifier-hover` |
| Form field | `--background-modifier-form-field` |
| Hairline | `--background-modifier-border` |
| Focus edge | `--background-modifier-border-focus` |
| Primary text | `--text-normal` |
| Secondary text | `--text-muted` |
| Tertiary text | `--text-faint` |
| Accent/action | `--interactive-accent` and `--interactive-accent-hover` |
| Text on accent | `--text-on-accent` |
| Success/warning/error | `--text-success`, `--text-warning`, `--text-error` |

Do not substitute fixed light and dark hex values. Do not detect the operating system theme: Obsidian's active theme is authoritative and may differ from the OS.

## Geometry and typography

### Spacing

Use the 4px scale deliberately: 4, 8, 12, 16, 20, 24, and 32px. Use 8px for related controls, 12–16px for panel internals, 20–24px for major panel padding, and 24–32px between workflow sections.

### Shape

- Control, input, compact badge: 6px.
- Panel, review pane, confirmation region: 12px.
- Full pill: reserved for a short status or count whose shape improves scanning.
- Avoid radii above 12px on workflow containers.

### Type

- Inherit Obsidian's UI font and base size.
- Use weight 600 for page and panel titles, 500–600 for labels, and regular weight for explanatory text.
- Use the host monospace font for note paths, revision identifiers, hashes, attempt counters, and diff content.
- Use tight letter spacing only on short headings; never compress body or form text.
- Keep interface copy in sentence case.

## Layout patterns

### View shell

Use one restrained header followed by the current workflow surface. The header contains the view title, a short current-state summary, and at most one primary action. Do not reproduce a website navigation bar inside Obsidian.

### Queue

Use a compact list or semantic table depending on the data. Always show note title/path, queue state, last transition, and the next available action. Preserve horizontal scrolling for wide tabular data; do not shrink text below the host's readable UI size.

### Production progress

Use the publication trail with explicit text for generation, initial check, up to two repairs, and at most one regeneration. Show `1 of 2 repairs` rather than an unexplained progress bar. After the limit, replace the next automatic action with “Needs manual intervention.”

### Human review

Use two logical panes when width permits:

- source snapshot: always read-only and labelled as such;
- public copy: editable, with revision and unsaved state visible.

Place the traceable diff beside or immediately below the two panes. On narrow panes, stack source, public copy, then diff without changing their order. Returning to production must preserve the reason and current revision.

### Publication confirmation

The confirmation region must show:

- what public copy will be published;
- the destination when one is configured;
- the reviewed source snapshot and public-copy revision;
- outstanding warnings;
- the exact effect of the final action.

Use a neutral “Back to review” action and one primary confirmation action. Never pre-check acknowledgement controls. A preview, validation, or prepared operation is not a publication success.

### Published records

Favor a dense chronological list with paths, revision, destination reference, and publication time. Filters should look like compact controls, not marketing-style pills.

### Agent and rule settings

Group settings by user-recognizable responsibility: publication scope, production rules, Agent profiles, and execution safety. Provider credentials and server details must not be exposed in ordinary status text. Use Obsidian's setting components unless they cannot express the approved interaction.

## State contract

Every asynchronous or stateful surface must consider:

| State | Required presentation |
| --- | --- |
| Loading | Stable layout, concise status text, and `aria-busy` where applicable. |
| Empty | Explain what is absent and name the action that can populate it. |
| Success | Name the completed action and resulting state. |
| Error | State what failed, what remained unchanged, and the recovery action. |
| Stale | Identify which source or draft changed and require a refresh before confirmation. |
| Disabled | Pair the control with visible explanatory text. |
| Unavailable | Distinguish missing configuration from temporary failure. |
| Needs intervention | Preserve attempt history and route to human review. |

Status badges supplement these words. Never encode a stage or severity only with hue, icon, position, or animation.

## Interaction and copy

- Use native `button`, `input`, `select`, `textarea`, list, and table semantics.
- Give every control an accessible name and every field a visible label.
- Keep the same verb through action, progress, and completion: “Generate public copy,” “Generating public copy,” “Public copy generated.”
- Use direct labels such as “Preview changes,” “Return to production,” and “Confirm publication.” Avoid “Submit,” “Proceed,” or vague “Continue” when a more exact action exists.
- Errors do not apologize. They explain the failure and next step.
- A destructive action must name its object and must not sit adjacent to the primary action without separation.

## Focus, keyboard, and announcements

- All actions must be reachable and operable by keyboard.
- Preserve a visible `:focus-visible` outline derived from the host focus variable.
- Opening a modal or overlay must place focus meaningfully, trap it when modal, close on Escape where appropriate, and return focus to its trigger.
- Associate errors and helper text with their fields.
- Announce important loading completion, errors, and state transitions with an appropriate status or live region; do not rely only on notices or toasts.
- Do not assign positive `tabindex` values.

## Motion and high-contrast modes

Motion is optional and functional. Prefer short color, border, and opacity transitions. Do not animate workflow layout, progress position, or review content for decoration.

When reduced motion is requested, remove non-essential transition and animation duration inside the plugin. In forced-colors mode, retain native system colors, visible borders, focus outlines, and text labels. Do not suppress forced-color adjustment to preserve brand appearance.

## Prohibited patterns

- Fixed light-only or dark-only palettes.
- Global selectors or Obsidian core-style overrides.
- `:root`, `body`, `.theme-dark`, `.theme-light`, or `prefers-color-scheme` in plugin CSS.
- Custom web navigation, landing-page heroes, screenshot mockups, bento marketing grids, gradients, glass effects, or ambient motion.
- Framework-specific components copied from Horace projects.
- New UI dependencies without explicit approval.
- Color-only status, hover-only disclosure, hidden failure explanations, or a disabled button with no reason.
- Editing the source note from a review surface.

## Review checklist

Before accepting a UI change, verify:

- the surface follows this document and remains scoped to `.baukasten-press`;
- the publication state and next action are understandable without color;
- source and public-copy ownership remain unmistakable;
- light, dark, and at least one community theme inherit correctly;
- keyboard navigation, focus, labels, errors, and announcements work;
- narrow panes preserve task order and usable controls;
- reduced motion and forced colors remain functional;
- no new dependency, framework, font, or icon set was introduced;
- a preview or confirmation preparation cannot be mistaken for completed publication.
