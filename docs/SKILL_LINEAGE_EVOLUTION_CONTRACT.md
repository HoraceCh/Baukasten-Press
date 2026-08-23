# Skill Revision Lineage and Controlled Evolution Policy Contract

Status: frozen by BAP-54 · Parent work package: BAP-49 · Consumed by: BAP-55 (validator implementation), BAP-56 (migration), BAP-57 (routing/maintenance/admission)

This document freezes revision lineage semantics, the controlled evolution lifecycle, and evidence-backed transition policy for project-local Skills. It defines **policy contracts only**: no evolution engine, no registry validator, no automatic transitions. Detection belongs to BAP-55; migration to BAP-56; routing integration to BAP-57.

Normative references: `AGENTS.md`; `docs/SKILL_MANIFEST_CONTRACT.md` (identity vocabulary, D1–D7); `docs/SKILL_TRUST_ENVIRONMENT_CONTRACT.md` (trust states, P-gates); `docs/SKILL_EVIDENCE_CONTRACT.md` (evidence records consumed by evolution decisions); `docs/AGENCY_OPENSPACE_ADOPTION.md` §3/§6 (T6, T12).

## 1. Identity versus revision

BAP-51 stable identity semantics are preserved verbatim:

- Same `skill_id` + new `revision_id` = SAME logical Skill under governed revision evolution; provenance preserved; every prior revision remains auditable.
- New `skill_id` = DISTINCT logical Skill identity — required for true derivatives/copies where identity diverges.
- Path movement or rename alone creates NEITHER a new identity NOR a new revision.

## 2. Revision model

Admitted revisions are IMMUTABLE. A revision is never silently overwritten (violation L5); corrections require a new `revision_id`, or the explicitly governed supersession mechanism of §6.

Every admitted revision records at minimum:

| Field | Rules |
| --- | --- |
| `revision_id` | Unique within the skill identity (L5 on collision). |
| `parent_revision_ids` / `parent_skill_ids` | Per origin rules §4; must resolve (L2), never self (L3), never cyclic (L1). |
| `origin_kind` | One of `authored`, `fixed`, `derived`, `captured`, `imported`. |
| `source_task_ref` | Task/Linear Issue anchor (`null` allowed only for roots with no governing task). |
| `change_summary` | Factual description of what changed versus the parent. |
| `content_hash` | Deterministic hash of the revision content; differs across revisions (L5 detection basis). |
| `content_retention_strategy` | `full_snapshot` or `bounded_diff`; the chosen strategy and any size bound MUST be declared by BAP-55 implementation — undeclared ad hoc truncation is prohibited (L6). |
| `evidence_refs` | Resolvable BAP-53 evidence records justifying this revision (§5). |
| `created_by` | Named actor per AGENTS.md conventions. |
| `admission_decision` | `{decision, decided_by, decided_at, rationale}` — the governed review verdict that admitted this revision (candidates carry a pending decision until admitted). |

## 3. Lifecycle state machine

```
candidate ──(governed admission)──▶ provisional ──▶ trusted ──▶ deprecated ──▶ retired
    │                                    ▲            │             │              (terminal)
    └─▶ rejected (terminal)              └────────────┘
                                   failure-driven demotion
```

- `candidate`: a proposed revision or new skill NOT yet admitted. Not present in registry routing scope; cannot be executed as canonical guidance.
- Admission requires the `admission_decision` review verdict (named owner + rationale).
- `provisional/trusted/deprecated/retired` semantics are owned by BAP-51/BAP-52; this contract adds only the candidate pre-stage and the transition GATES below.
- Failure-driven `trusted → provisional` demotion follows BAP-52 §5.
- Agents may create candidates and recommendations ONLY (§5).

## 4. Origin-kind semantics

Vocabulary matches BAP-51 exactly (`authored`, `fixed`, `derived`, `captured`, `imported`).

### 4.1 FIX — repair of the same logical Skill

- Preserves the stable `skill_id`; creates a NEW `revision_id`.
- Requires exactly one `parent_revision_id` (the previous revision of the same identity).
- Requires resolvable evidence justifying the repair (what broke, how the fix addresses it).
- NEVER silently replaces history: the parent revision remains fully auditable, and prior negative evidence is not erased — a FIX does not retroactively clean the record (E-class heritage: contradictory claims fail closed).
- A "FIX" whose `skill_id` differs from its parent revision is identity laundering (L4a), INVALID.

### 4.2 DERIVED — distinct logical Skill from predecessors

- REQUIRES a NEW stable `skill_id`.
- One or more `parent_skill_ids` (+ optional parent revision pins), all resolvable, acyclic, non-self.
- Source provenance preserved via `provenance_refs`; the reason/boundary for identity divergence recorded in `change_summary` at minimum.
- A derived skill reusing a parent `skill_id` is identity laundering (L4b), INVALID. A copied directory NEVER silently inherits the parent identity.

### 4.3 CAPTURED — new Skill candidate from a verified reusable subworkflow

Creates a NEW identity (`captured` root). Whole-task success ALONE is insufficient proof of a capturable capability. Admission requires ALL FOUR co-requisites:

1. Procedure evidence (the repeatable steps actually exercised);
2. Independent postcondition validation (verification performed outside the producing run);
3. A stated capability boundary (what the captured workflow does and does not cover);
4. Documented limitations/preconditions.

Captured content never bypasses BAP-51 provenance rules or BAP-52 trust gates; it enters `provisional` at best, never trusted directly.

### 4.4 IMPORTED — third-party Skill entry

- Immutable external provenance mandatory (pinned tag AND commit AND license AND boundary-doc reference per BAP-51 §4.1).
- Enters according to BAP-52 trust rules: admitted `provisional` at best; NEVER inherits trusted status from origin reputation; gains NO runtime/write authority from its source.

## 5. Evidence-backed evolution decisions

Evolution decisions MAY consume BAP-53 evidence records. Evidence SUPPORTS decisions; it never autonomously executes a privileged transition.

Minimum evidence basis per candidate type:

| Candidate | Required evidence basis |
| --- | --- |
| FIX | Evidence of the defect (failure/attribution records) AND of the repair effect (post-fix validation). |
| DERIVED | Parent lineage references + statement of divergence purpose + postcondition checks for the composed capability. |
| Deprecation recommendation | Recorded defects/staleness indicators or governance change reference. |
| Retirement recommendation | Sustained negative evidence, superseded capability, or governance prohibition reference. |
| Trust demotion recommendation | BAP-52 §5 trigger with attributable evidence records. |

Promotion/demotion authority remains EXACTLY as frozen by BAP-52 §4/§5: named routing-designated owner decides; automated systems and Agents may detect evidence, generate candidates, and recommend — they may NOT autonomously promote trust, erase demotion, reactivate retired skills, overwrite canonical lineage, or grant execution authority.

## 6. Rollback and supersession

A broken admitted revision is corrected by a NEW revision (`fix`) whose record marks the broken predecessor via `supersedes` linkage (mirroring BAP-53 evidence supersession). Rollback of ROUTING to a prior good revision is a governed decision recording: target revision, authority, rationale — the broken revision itself is never deleted or rewritten. Superseded revisions remain auditable forever.

## 7. Deprecated and retired (evolution refinement)

Refines BAP-52 §6 only as needed:

- `deprecated`: remains resolvable/auditable; may remain enabled only if explicit policy permits; MUST NOT be preferred for new routing.
- `retired`: terminal for that identity/revision lineage under normal routing; historically auditable forever; `enabled:true` alone never re-enables it.
- If a retired capability genuinely returns: governed readmission is REQUIRED — typically as a new identity (derived/captured/imported) under fresh admission, or via an explicitly authorized exception decision recorded like an admission decision.

## 8. Staleness indicators (deterministic)

A skill is STALE when any of: environment assumptions evaluated incompatible/unknown; provenance invalidated; superseded by a newer admitted revision; repeated attributed failures in evidence (per BAP-53 aggregation); deprecated/retired state; incompatibility with a current governance contract version.

Stale DETECTION alone MUST NOT silently rewrite trust or lineage — it produces a candidate/recommendation for governed handling (T4 control).

## 9. Violation classes (fail closed)

| Class | Violation |
| --- | --- |
| L1 | cyclic ancestry |
| L2 | unresolved parent (skill or revision), including fabricated parents/evidence references |
| L3 | self-parenting |
| L4a | FIX changing stable identity |
| L4b | DERIVED/CAPTURED reusing a parent identity |
| L5 | duplicate revision identity or silent in-place content overwrite (hash collision across admitted revisions of one identity) |
| L6 | provenance loss (lineage admitted without required provenance anchors or undeclared content-retention truncation) |
| L7 | retired reactivation without governed authority |

No validator code is defined here; BAP-55 implements detection.

## 10. Threat bindings

| Control | Fail-closed rule |
| --- | --- |
| T6 lineage/provenance fraud | §4 parent-resolution + acyclicity + no-self-parenting; L1–L4, L6 fail closed; provenance preserved across every legal transition. |
| T12 retired skill reuse | §7/A2 retirement terminality; L7 fails closed; readmission only via new identity or explicit authorized exception. |

## 11. Fixtures index

Canonical fixtures live in `docs/fixtures/skill-lineage/`:

| Fixture | Scenario | Expected verdict |
| --- | --- | --- |
| `valid-fix-same-identity.json` | FIX: same `skill_id`, rev-0001→rev-0002, parent pinned | VALID |
| `valid-derived-new-identity.json` | DERIVED: new `skill_id`, single parent | VALID |
| `valid-captured-lineage.json` | CAPTURED with all four guardrail prerequisites | VALID |
| `valid-imported-lineage.json` | IMPORTED root with pinned external provenance | VALID |
| `valid-multi-parent-derived.json` | DERIVED with two resolved parents | VALID |
| `valid-supersession-rollback.json` | superseded revision + governed routing rollback | VALID |
| `invalid-lineage-cycle.json` | two skills parenting each other | INVALID (L1) |
| `invalid-unresolved-parent.json` | parent reference does not resolve | INVALID (L2) |
| `invalid-fix-changing-identity.json` | "FIX" minting a different `skill_id` | INVALID (L4a) |
| `invalid-derived-reusing-parent-id.json` | DERIVED reusing parent identity | INVALID (L4b) |
| `invalid-retired-reactivation.json` | attempt to re-enable a retired lineage | INVALID (L7) |
| `invalid-historical-overwrite.json` | same revision_id, different content hash | INVALID (L5) |
| `invalid-self-parenting.json` | revision listing itself as parent | INVALID (L3) |

BAP-55 MUST consume these (extended as needed) rather than re-inventing cases.

## 12. Authority precedence

Subordinate to, in order: `AGENTS.md`; canonical architecture/publication/domain contracts; security and testing requirements (incl. BAP-42); environment governance (BAP-41); routing authority (BAP-35); Git Governance; executing-Issue scope. Inherits adoption-boundary precedence. Creates no engine, no new owner, no runtime dependency, and no execution authority.
