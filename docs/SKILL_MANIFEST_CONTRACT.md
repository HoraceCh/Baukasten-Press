# Skill Manifest and Stable Identity Contract

Status: frozen by BAP-51 · Parent work package: BAP-49 · Consumed by: BAP-55 (registry/validator implementation), BAP-52 (trust/environment semantics), BAP-53 (evidence contract), BAP-54 (evolution policy), BAP-56 (migration)

This document defines the canonical manifest format, stable identity semantics, provenance and lineage rules, and fail-closed registry behaviors for Baukasten Press project-local Skills. It defines **contracts only**: enforcement is implemented by BAP-55, trust/environment *policy* by BAP-52, evidence *semantics* by BAP-53, and evolution *policy* by BAP-54. Nothing here grants new execution authority.

Normative references: `AGENTS.md`; `docs/AGENCY_OPENSPACE_ADOPTION.md` §3 (adopted subset), §6 (threat controls T1, T4, T6, T10), §7 (authority precedence); `docs/TEST_STRATEGY.md`.

## 1. Manifest schema (version 1)

Every governed project-local Skill carries one machine-readable manifest co-located with its procedure file:

- Location: `.agents/skills/<directory>/skill.manifest.json`
- Format: JSON object, UTF-8, no comments, deterministic key order recommended
- Separation of duties: `SKILL.md` = procedure/guidance for humans and agents; `skill.manifest.json` = governance identity/metadata. Neither substitutes for the other; identity never derives from `SKILL.md` content or headings.

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `schema_version` | integer | yes | Must be `1` for this contract. |
| `skill_id` | string | yes | Stable logical identifier. See §2. Immutable after admission. |
| `name` | string | yes | Human-readable display name. MAY change freely; never identity-bearing. |
| `category` | string | yes | One of `tool_guide`, `workflow`, `reference` (structural vocabulary adopted from the pinned OpenSpace snapshot). |
| `revision_id` | string | yes | Current revision within this identity, e.g. `rev-0001`. Changes on every admitted change of the skill. |
| `provenance` | object | yes | Mandatory. See §4. Missing or non-conforming → INVALID. |
| `trust_state` | string | yes | One of `provisional`, `trusted`, `deprecated`, `retired`. Structural states only; promotion/demotion/retirement POLICY is BAP-52/BAP-54 territory. |
| `enabled` | boolean | yes | Availability switch. Independent of `trust_state` (§5). |
| `environment_contract_ref` | string \| null | yes | Reference slot for the environment compatibility contract. Semantics owned by BAP-52; `null` is valid until BAP-52 defines it. Never contains credential values. |
| `lineage` | object | yes | See §4.3. Present even for roots (empty parents). |
| `lineage.origin_kind` | string | yes | One of `authored`, `fixed`, `derived`, `captured`, `imported`. |
| `lineage.parent_skill_ids` | string[] | yes | Logical parents. Non-empty exactly for `derived`. Acyclic; every entry must resolve. |
| `lineage.parent_revision_ids` | string[] | yes | Revision parents. Exactly one previous-revision entry for `fixed`; must resolve when present. |
| `evidence_ref` | string \| null | yes | Reference slot for execution-evidence records. Semantics owned by BAP-53; `null` is valid until then. |
| `path` | string | yes | Current location, informational ONLY. Never identity-bearing (§2). |
| `created_by` | string | yes | Actor that admitted the skill/revision (`human:<name>` or agent owner name from AGENTS.md routing). |
| `updated_at` | string | yes | ISO 8601 UTC timestamp of the current revision. |

Unknown additional fields are forbidden at schema v1 (fail closed on unknown keys) so future contract versions cannot be silently assumed by old validators.

## 2. Stable identity semantics

1. A `skill_id` is logical and permanent. It is an opaque dotted lowercase label (segments `[a-z0-9-]+`, dot-separated, e.g. `baukasten.ui-design-system`). It is assigned once at admission.
2. `skill_id` MUST NOT be derived from filesystem path, directory name, display title, or `SKILL.md` content.
3. Renaming the directory or moving the skill changes `path` only; `skill_id` MUST remain identical. A rename that mints a new `skill_id` is a violation (identity spoofing class).
4. Duplicate `skill_id` values within registry scope MUST fail closed (violation class D1).
5. A copy of a skill MUST be admitted as a NEW identity (`derived`) with explicit parent linkage; silent inheritance of the source `skill_id` is forbidden (T-control: adoption boundary §6/T1, T6).
6. `FIX` keeps the SAME `skill_id` (same logical skill), creates a NEW `revision_id`, and pins the parent revision. `DERIVED` and `CAPTURED` mint a NEW `skill_id` with recorded parents. Provenance is never erased across any of these transitions.

## 3. Registry discovery precedence and fail-closed behaviors

Discovery precedence (for BAP-55): project-local canonical directories first, then explicitly approved copied-skill locations, then other reviewed sources. Dynamic/cloud discovery is rejected per the adoption boundary and MUST NOT be added later without a boundary-refresh Issue.

Fail-closed violation classes (each MUST be detected by BAP-55; none may auto-heal):

| Class | Violation |
| --- | --- |
| D1 | duplicate `skill_id` anywhere in registry scope |
| D2 | path collision (two manifests claiming the same `path`) or missing manifest beside a discovered `SKILL.md` in a canonical directory |
| D3 | missing/non-conforming `provenance` (including floating upstream refs — see §4.2) |
| D4 | broken lineage (unresolvable `parent_skill_ids`/`parent_revision_ids`, cycles, or origin/parent-shape mismatches) |
| D5 | identity spoofing (declared identity inconsistent with recorded admission evidence, or path-derived ID substitution) |
| D6 | unknown schema version or unknown extra fields |
| D7 | `retired` skill offered as a default routing candidate (enforcement shape here; routing integration is BAP-57) |

Registry validation grants no execution authority: trust, environment, and Agent-owner checks always apply independently (adoption boundary precedence §7).

## 4. Provenance and lineage rules

### 4.1 Provenance is mandatory

Exactly one of:

```json
"provenance": {
  "origin": "project-authored",
  "created_from_issue": "<BAP-id or null>"
}
```

or, for externally sourced skills (third-party import):

```json
"provenance": {
  "origin": "imported",
  "source_url": "https://github.com/<org>/<repo>",
  "source_tag": "<tag>",
  "source_commit": "<40-hex immutable sha>",
  "license": "<spdx>",
  "boundary_doc_ref": "docs/AGENCY_OPENSPACE_ADOPTION.md"
}
```

A pinned tag AND commit are both required for imports; floating branch references are not valid provenance authority. `boundary_doc_ref` must point at a frozen adoption boundary document when the import derives from a governed upstream.

### 4.2 Lineage object

Roots (`authored`, `captured` roots, `imported`): empty parents. `fixed`: one parent revision, same identity. `derived`: one or more parent skills, new identity. All parent references MUST resolve against the registry and MUST NOT form cycles; unresolved or cyclic lineage is INVALID (class D4).

### 4.3 Worked scenarios (authoritative examples live in `docs/fixtures/skill-manifest/`)

| Fixture | Scenario | Expected verdict |
| --- | --- | --- |
| `valid-canonical.json` | original project-authored skill; `trusted` + `enabled:false` proves axis orthogonality | VALID |
| `rename-before.json` / `rename-after.json` | directory move; identical `skill_id`, changed `path` | both VALID |
| `derived-copy-new-identity.json` | copy of another skill → NEW `skill_id`, `origin_kind:"derived"`, parent linked | VALID |
| `fix-lineage.json` | repair of existing skill → same `skill_id`, new `revision_id`, parent revision pinned | VALID |
| `invalid-duplicate-id.json` | reuses an existing `skill_id` at a different path | INVALID (D1) |
| `invalid-missing-provenance.json` | `provenance` absent | INVALID (D3) |
| `invalid-broken-lineage.json` | parent references a nonexistent skill | INVALID (D4) |

These eight files are the canonical fixture definitions. BAP-55 MUST materialize and consume them (extended as needed) as its valid/invalid suite rather than re-inventing cases.

## 5. Trust versus availability

`trust_state` and `enabled` are independent axes (adoption boundary §3 items 2–3):

- A `trusted` skill may be `enabled:false`.
- An `enabled` skill is never automatically trusted; admission defaults every new skill to `trust_state:"provisional"` unless an authority decision recorded under BAP-52/BAP-54 rules says otherwise.
- No automatic promotion exists in this contract. Promotion/demotion/retirement decisions belong to BAP-52/BAP-54; this contract fixes only the state vocabulary and the structural rule that the two axes do not imply each other.

## 6. Authority precedence

This contract is subordinate to, in order: `AGENTS.md`; canonical architecture/publication/domain contracts; security and testing requirements (incl. BAP-42); environment governance (BAP-41); routing authority (BAP-35); Git Governance (BAP-37/38); and the executing Issue's own scoped authority. It inherits the OpenSpace adoption subordination chain from `docs/AGENCY_OPENSPACE_ADOPTION.md` §7 and creates no new Agent owner, no runtime dependency, and no execution authority.
