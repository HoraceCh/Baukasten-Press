# Skill Execution Evidence and Quality Record Contract

Status: frozen by BAP-53 · Parent work package: BAP-49 · Consumed by: BAP-52 promotion gates (P1), BAP-54 (evolution policy input), BAP-55 (validator implementation), BAP-56 (migration)

This document defines the project-local contract for recording governed Skill executions, their outcomes, attributions, and quality records. It defines **contracts only**: no evidence storage engine, no validator code, no runtime behavior change, no parallel logging system. Evidence collection reuses existing maintenance/incident/QA mechanisms; Git commits and validation output are repository evidence; Linear Issue IDs serve as optional traceability anchors.

Normative references: `AGENTS.md`; `docs/SKILL_MANIFEST_CONTRACT.md`; `docs/SKILL_TRUST_ENVIRONMENT_CONTRACT.md` (gates P1/P4 consume this contract); `docs/AGENCY_OPENSPACE_ADOPTION.md` §6 (T5, T9).

## 1. Execution evidence record (schema version 1)

One record per governed Skill use. Format: JSON, UTF-8, no comments, unknown fields forbidden (fail closed).

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `evidence_schema_version` | integer | yes | Must be `1`. |
| `evidence_id` | string | yes | Unique within registry scope, e.g. `evd-000123`. |
| `task_ref` | string \| null | yes | Task/Issue identifier (e.g. `BAP-xx`) or `null` when no governed task exists. Optional traceability anchor — never fabricated to satisfy a form. |
| `skill_id` | string | yes | Must resolve against the registry (E2). |
| `revision_id` | string | yes | Must match an admitted revision of that skill (E3). |
| `outcome` | string | yes | One of `selected`, `applied`, `completed`, `fallback`, `failed` (§2). |
| `invoking_agent_owner` | string | yes | Agent owner per AGENTS.md routing (e.g. `press_app_implementer`). Identity metadata ONLY — never authority (§4). |
| `invoking_runtime` | string | yes | Execution engine name (e.g. `opencode`). Non-authority metadata; executor substitution never affects trust or evidence weight. |
| `repository_head` | string | yes | 40-hex commit SHA of the repository state during execution. |
| `recorded_at` | string | yes | ISO 8601 UTC. Ordering: `recorded_at` then `evidence_id` lexicographic; equal timestamps do not imply simultaneity. |
| `actor` | string | yes | Human/owner actor responsible for the governed action. |
| `environment_result_ref` | string \| null | yes | Reference to the BAP-52 evaluation for this execution (`compatible/incompatible/unknown`) or `null` when none was performed (then treated as `unknown` for eligibility purposes). |
| `tool_observations` | array | yes | Tool/dependency observations as classified references (`{"name","status":"available\|unavailable\|degraded"}`). No raw outputs. |
| `validation_refs` | array | yes | References to validation runs/outputs (command + result class). Empty allowed only for `selected`. |
| `qa_outcome` | string \| null | yes | `pass \| fail \| warning \| not_performed \| null`. |
| `failure_attribution` | string \| null | yes | One of `skill`, `tool`, `environment`, `user_input`, `unknown`; required non-null exactly when `outcome:"failed"` (E-class E4b otherwise). |
| `fallback_reason` | string \| null | yes | Required non-null exactly when `outcome:"fallback"`. |
| `quality_record_id` | string \| null | yes | Reference to the separate quality record (§3); required non-null whenever positive-evidence eligibility is claimed for a `completed` outcome (E5). |
| `provenance_refs` | array | yes | Provenance anchors used (adoption doc refs, import pins). |
| `redaction_status` | string | yes | `verified_redacted`, `unknown`, or `violated` (§6). |
| `producer` | object | yes | `{ "identity": "human:<name> | <agent-owner> | validator:<class>", "mechanism": "<how produced>" }`. Must be verifiable (E7). |

## 2. Outcome vocabulary

| Outcome | Meaning | Evidence class |
| --- | --- | --- |
| `selected` | Chosen for a governed task; not yet applied. | neutral/incomplete |
| `applied` | Procedure actually followed; completion not yet recorded. | neutral/incomplete |
| `completed` | Execution finished. By itself a FACT about execution, NOT a quality judgment. | successful basis (positive only with §3 support) |
| `fallback` | Fell back to an alternative path; `fallback_reason` mandatory. | negative-leaning (honest record) |
| `failed` | Execution failed; `failure_attribution` mandatory. | negative |

Classification rules: "execution completed" is NEVER equivalent to "quality passed". Positive trust evidence requires `completed` + passing validation refs + an admissible quality record (§3) + verified redaction (§6). `failed` with `attribution:"environment"` or `"tool"` is negative for THAT cause but MUST NOT be counted against the Skill's quality (§4).

## 3. Quality record (separate, linked)

```json
{
  "quality_schema_version": 1,
  "quality_record_id": "qr-000045",
  "evidence_id": "<linked evidence>",
  "validation_status": "pass | fail | not_run",
  "independent_qa_status": "pass | fail | warning | not_performed",
  "deterministic_checks": [{ "name": "", "result": "pass | fail" }],
  "warnings": [""],
  "defect_classification": null | "minor | major | critical",
  "output_acceptance": "accepted | rejected | pending",
  "reviewer_reference": "<named reviewer/authority>",
  "evidence_basis": ["<refs>"],
  "quality_category": "satisfactory | conditional | unsatisfactory"
}
```

Quality records are FACTS/EVIDENCE, not autonomous trust decisions. No numeric scoring system exists in this contract — only the categorical `quality_category`. Reviewer reference must identify a named human/routing authority or an independent QA instance.

## 4. Attribution and aggregation rules

`failure_attribution` vocabulary: `skill`, `tool`, `environment`, `user_input`, `unknown`.

Aggregation rules (binding on future policy consumers):

1. A single success NEVER auto-promotes trust (BAP-50 §6/T2; BAP-52 §1).
2. An `attributable` skill-caused failure MAY trigger a demotion CANDIDATE under BAP-52 §5 — candidacy only, decided by the authorized owner.
3. Tool-attributed and environment-attributed failures MUST NOT be miscounted against the Skill.
4. Only verifiable facts are recordable; an LLM free-form assertion of success alone is insufficient evidence.
5. Contradictory fields (e.g. `outcome:"failed"` with `failure_attribution:null`, or positive-evidence claim over `redaction_status:"violated"`) make the record INVALID (E9).

## 5. Trust boundary

Evidence MAY SUPPORT: promotion recommendation, demotion recommendation, continued provisional status, retirement/deprecation review. Evidence MUST NOT: automatically promote trust, automatically demote trust, mutate manifest `trust_state`, mutate `enabled`, route privileged execution. Those decisions remain governed by BAP-52/BAP-54/BAP-57 authority.

## 6. Redaction and secret safety (T5, T9)

Evidence MUST NEVER persist: credentials, access tokens, API keys, session secrets, raw secret-bearing environment values, or unnecessary copies of user content.

Safe treatment:

| Surface | Rule |
| --- | --- |
| Command arguments | Reference by purpose/class ("ran validation command") — never echo full argv containing secrets. |
| Environment metadata | Variable NAMES only, never values. |
| Provider/tool outputs | Truncated, classified summaries; no raw payloads. |
| File paths | Repository-relative preferred; absolute paths only where operationally necessary and non-sensitive. |
| Error messages | Sanitized: strip token-like substrings before recording; prefer error CLASS. |

`redaction_status` semantics: `verified_redacted` = producer affirmatively checked; `unknown` = not checked; `violated` = sensitive content detected. A record whose required redaction state is `unknown` or `violated` MUST NOT be eligible as positive trust evidence (E8); `violated` additionally triggers incident handling under existing mechanisms.

## 7. Evidence references (`evidence_ref`) semantics

The BAP-51 reserved slot resolves as follows: it references one or more admitted evidence records by `evidence_id`. A reference is RESOLVABLE iff the target record exists in registry scope, is well-formed schema v1, and has `redaction_status:"verified_redacted"`. Admitted records are IMMUTABLE; corrections are represented by a NEW superseding record carrying `supersedes:["<prior evidence_id>"]` — originals are never edited in place. Missing, malformed, or unresolvable references fail closed for every decision that depends on them (E6). No evidence database is created by this contract; storage mechanics belong to later implementation Issues.

## 8. Integrity violation classes (fail closed)

| Class | Violation |
| --- | --- |
| E1 | missing `skill_id` or `revision_id` |
| E2 | evidence refers to an unknown Skill |
| E3 | revision mismatch (revision not admitted for that skill) |
| E4 | malformed `outcome` value (E4b: missing `failure_attribution` on `failed`) |
| E5 | required quality record absent/malformed where claimed |
| E6 | unresolved `evidence_ref`/quality link |
| E7 | fabricated or unverifiable producer identity |
| E8 | redaction violation, or unknown redaction status claimed as positive evidence |
| E9 | contradictory fields |

No validator code is defined here; BAP-55 implements detection.

## 9. Boundary with Linear Evidence

Skill Execution Evidence is a PROJECT GOVERNANCE record. Linear Completion/Blocker Evidence is ISSUE-LEVEL execution audit evidence owned by AGENTS.md routing. They may reference each other (a Linear comment may cite `evidence_id`s; an evidence record may carry `task_ref`), but NEITHER substitutes for the other: absence of Linear evidence does not invalidate project evidence, and Linear narrative never replaces machine-checkable records. Agent-owned Linear Evidence responsibility remains unchanged.

## 10. Authority precedence

Subordinate to, in order: `AGENTS.md`; canonical architecture/publication/domain contracts; security and testing requirements (incl. BAP-42); environment governance (BAP-41); routing authority (BAP-35); Git Governance; executing-Issue scope. Inherits adoption-boundary precedence. Creates no new owner, no storage/network/provider authority, and no runtime behavior change.

## 11. Fixtures index

Canonical fixtures live in `docs/fixtures/skill-evidence/`:

| Fixture | Scenario | Expected verdict |
| --- | --- | --- |
| `valid-success-quality-pass.json` | completed + validation pass + quality accepted (linked via `quality_record_id`) | VALID, positive evidence |
| `qr-valid-success.json` | standalone quality-record example demonstrating external `quality_record_id` resolution | VALID |
| `valid-success-qa-warning.json` | completed + QA warning | VALID, conditional |
| `valid-fallback-execution.json` | fallback + reason | VALID, negative-leaning honest record |
| `valid-failed-environment-attributed.json` | failed, attribution `environment` | VALID, negative for environment, NOT against skill |
| `valid-failed-skill-attributed.json` | failed, attribution `skill` | VALID, demotion candidate |
| `valid-completed-quality-rejected.json` | completed + output rejected | VALID record, NOT positive evidence |
| `invalid-missing-required-fields.json` | `skill_id`/`revision_id` absent | INVALID (E1) |
| `invalid-revision-mismatch.json` | revision not admitted | INVALID (E3) |
| `invalid-unresolved-evidence-ref.json` | quality link unresolvable | INVALID (E6) |
| `invalid-redaction-violation.json` | secret-shaped content persisted | INVALID (E8) |

Quality records appear either embedded (`quality_record` object alongside the evidence record, matching `quality_record_id`) or as standalone resolvable files; production placement is a BAP-55 implementation choice. BAP-55 MUST consume these (extended as needed) rather than re-inventing cases.
