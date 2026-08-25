---
name: complexity-review
description: Review a retained Baukasten Press change or diff for avoidable complexity using the project's minimal implementation ladder. Produces structured delete/stdlib/native/yagni/shrink findings. Use when an approved change needs an explicit over-engineering review before handoff, QA, or commit.
---

# Complexity review

Explicitly invoked, read-only by default. Review one retained change per invocation.

## Establish the subject

1. Read `AGENTS.md`, this Skill, and `docs/AGENCY_AGENTS_ADOPTION.md`.
2. Take the retained diff or the named paths as the review subject. Do not expand into unrequested files or refactors.
3. Read the live issue's required scope so YAGNI judgments never override requirements the issue explicitly demands.

## Review against the ladder

Apply the seven-step minimal implementation ladder (need, project reuse, standard library, native Obsidian/Web/Node capability, installed dependency, smallest direct implementation, minimal new code) and record a finding only where a smaller sufficient level was skipped:

- `delete` — code, configuration, or documentation serving no current requirement
- `stdlib` — Node standard library coverage instead of custom code
- `native` — Obsidian or Web platform capability instead of a custom abstraction
- `yagni` — speculative flexibility, options, or future-proofing without a current consumer
- `shrink` — a smaller direct implementation of the same behavior

Findings are complexity observations only. They are not correctness or security findings and never replace normal QA validation.

## Required-complexity exceptions

Never flag complexity required by security boundaries, recovery or idempotency guarantees, required validation, accessibility, data-loss prevention, lifecycle correctness, failure containment, or hardware/platform calibration as removable. That is essential complexity and stays.

## Structured output

Emit exactly one JSON document:

```json
{
  "skill": "complexity-review",
  "subject": "<retained diff description or path>",
  "verdict": "PASS | FINDINGS",
  "findings": [
    {
      "id": "CR-1",
      "category": "delete | stdlib | native | yagni | shrink",
      "location": "<path>:<lines>",
      "observation": "<what exists today>",
      "recommendation": "<the smaller sufficient alternative>",
      "confidence": "high | medium | low"
    }
  ],
  "notes": ["<scope limits, exceptions applied>"]
}
```

## Fixture demonstration (deterministic)

Input — retained diff excerpt:

```diff
+++ src/application/retry.ts
+export type RetryOptions = {
+  attempts?: number;
+  backoff?: "linear" | "exponential";
+  jitter?: boolean;
+};
+
+export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
+  // generic retry loop with configurable backoff and jitter
+}
```

Output:

```json
{
  "skill": "complexity-review",
  "subject": "src/application/retry.ts (new generic retry helper)",
  "verdict": "FINDINGS",
  "findings": [
    {
      "id": "CR-1",
      "category": "yagni",
      "location": "src/application/retry.ts:1-5",
      "observation": "RetryOptions exposes attempts, backoff, and jitter knobs with no second consumer; the single caller uses defaults.",
      "recommendation": "Remove the options surface until a second real consumer needs it; keep only behavior the live issue requires.",
      "confidence": "high"
    },
    {
      "id": "CR-2",
      "category": "shrink",
      "location": "src/application/retry.ts:7-9",
      "observation": "A generic retry helper duplicates budget logic already owned by the publication state machine (repair capped at two).",
      "recommendation": "Reuse the transition authority's repair budget instead of introducing a parallel retry abstraction.",
      "confidence": "high"
    }
  ],
  "notes": ["No correctness or security judgment expressed; findings are advisory."]
}
```

## Boundaries

- Read-only by default: never modifies files, the worktree, commits, pushes, publishes, vaults, providers, credentials, or Linear.
- Explicit invocation only. Not always-on; no lifecycle hooks, global mode state, or automatic subagent injection.
- Recommendations are advisory. Implementing one follows the normal owner routing, the BAP-47 minimal implementation ladder, and the focused-commit rules in Git Governance.
- This Skill is subordinate to AGENTS.md, canonical architecture, publication/domain contracts, testing requirements, security requirements, routing authority, and Git Governance.

## Provenance

Adapted without copying upstream prose from the pinned snapshot of `DietrichGebert/ponytail`, tag `v4.8.4`, commit `bc9ee949d5f439e8b9f3bb92c6d6d3d1e6ebd324`, MIT license, as recorded in `docs/AGENCY_AGENTS_ADOPTION.md`. Upstream content is advisory provenance only and remains subordinate to every project authority listed above.
