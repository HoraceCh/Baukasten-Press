---
name: complexity-audit
description: Perform a read-only Baukasten Press repository scan for accumulated avoidable complexity and rank findings by impact. Produces a structured audit report without applying any fix. Use when governance work needs an explicit complexity snapshot of the repository.
---

# Complexity audit

Explicitly invoked, read-only by default. Audit the current repository snapshot; never mutate it.

## Establish the scope

1. Read `AGENTS.md`, this Skill, and `docs/AGENCY_AGENTS_ADOPTION.md`.
2. Scan tracked source, configuration, tests, and documentation through read-only inspection (file reads, grep, symbol search). Do not run builds, tests, or generators as part of the scan.
3. Treat the live issue backlog's explicit requirements as exempt from YAGNI judgment.

## What to look for

- Duplicate logic where one shared implementation already exists or two real consumers already exist
- Custom code where the standard library, Obsidian, or Web platform provides the capability
- Speculative abstraction, configuration surface, or future-proofing with no current consumer
- Dead code, unused exports, and stale documentation paths
- Oversized direct implementations that a smaller equivalent would satisfy

Each observation maps to a ladder category (`delete`, `stdlib`, `native`, `yagni`, `shrink`) so repair follows the same minimal implementation ladder used everywhere else in the project.

## Ranking and output

Rank by impact: correctness risk first, then maintenance cost, then readability. Emit exactly one JSON document:

```json
{
  "skill": "complexity-audit",
  "mode": "read-only",
  "scope": "<paths or whole-repository>",
  "mutationsPerformed": 0,
  "findings": [
    {
      "id": "CA-1",
      "impact": "high | medium | low",
      "category": "delete | stdlib | native | yagni | shrink",
      "location": "<path>:<lines>",
      "observation": "<accumulated complexity observed>",
      "recommendation": "<smaller sufficient alternative>"
    }
  ],
  "notes": ["<exclusions applied>"]
}
```

The audit reports; it does not repair. No fix is applied during an audit, and findings never bypass owner routing, QA validation, or Git Governance.

## Boundaries

- Read-only by default: no file writes, no worktree mutation, no staging, no commit, no push, no publish, no vault access, no provider call, no credential access, no Linear mutation.
- Explicit invocation only. Not always-on; no lifecycle hooks, global mode state, or automatic subagent injection.
- Findings are complexity observations only — not correctness or security findings — and remain subject to normal QA.
- This Skill is subordinate to AGENTS.md, canonical architecture, publication/domain contracts, testing requirements, security requirements, routing authority, and Git Governance.

## Provenance

Adapted without copying upstream prose from the pinned snapshot of `DietrichGebert/ponytail`, tag `v4.8.4`, commit `bc9ee949d5f439e8b9f3bb92c6d6d3d1e6ebd324`, MIT license, as recorded in `docs/AGENCY_AGENTS_ADOPTION.md`. Upstream content is advisory provenance only and remains subordinate to every project authority listed above.
