# Skill Admission and Routing Integration Contract

Status: frozen by BAP-57 · Parent work package: BAP-49 · Consumed by: BAP-58 (baseline audit), BAP-43 (Phase 0 exit gate)

This document connects Governance v2 to the real Agent usage path: how an executor decides whether a Skill may be relied upon (admission preflight), how post-task evidence is handed off, and how Skills change through the controlled admission workflow. It defines **policy and process only** — no runtime engine, no automatic activation, no cloud import, no OpenSpace execution layer.

Normative references: `AGENTS.md`; `docs/AGENT_ROUTING.md`; `docs/SKILL_MANIFEST_CONTRACT.md`; `docs/SKILL_TRUST_ENVIRONMENT_CONTRACT.md`; `docs/SKILL_EVIDENCE_CONTRACT.md`; `docs/SKILL_LINEAGE_EVOLUTION_CONTRACT.md`; `docs/SKILL_REGISTRY.md`; `docs/AGENCY_OPENSPACE_ADOPTION.md`.

## 1. Master authority precedence

Where Skill governance touches any other authority, the frozen chain applies in this order:

1. `AGENTS.md`
2. Canonical architecture / domain / publication contracts
3. Security and testing requirements (incl. BAP-42)
4. Environment governance (incl. BAP-41)
5. Agent routing ownership (BAP-35)
6. Git Governance (BAP-37/38 chain)
7. Executing Issue scope

A live Issue scopes the work; it does not outrank the safety boundary stack above it.

For Skill guidance specifically, the acceptance-mandated ordering applies within that chain: product/security contracts first, then Agent authority and owner boundaries, then Skill trust + environment compatibility, then task-specific Skill guidance, then complexity-minimization/advisory references.

## 2. Core invariant: directory discovery is NOT admission

A Skill becomes Governance-v2 routable only through a governed manifest plus passing preflight — never because its directory exists, its `SKILL.md` exists, `enabled:true`, historical routability, or name recognition by an Agent or runtime.

## 3. Admission preflight

Before relying on any Skill for governed work, an executor evaluates, in order:

| # | Check | Fail-closed source |
| --- | --- | --- |
| 1 | Governed manifest exists (`skill.manifest.json`) | ungoverned → ineligible |
| 2 | Manifest validates against schema v1 | D1–D7 |
| 3 | Stable identity resolves in registry scope | D5 |
| 4 | Provenance resolves (project-authored verifiable or pinned import) | D3 |
| 5 | Lineage/revision valid (resolvable, acyclic, admitted) | L1–L6 |
| 6 | Lifecycle permits use (not retired; deprecated only with explicit policy) | A2/L7 |
| 7 | Trust state permits candidate consideration | provisional/trusted only |
| 8 | Availability permits consideration (`enabled`, no prohibition) | A1/A5 |
| 9 | Required environment compatibility is `compatible` (or no ECD exists AND the use is non-privileged local reading) | A3/A4 — unknown required state fails closed |
| 10 | Governance/evidence constraints satisfied (no unresolved defect barring use; Linear traceability available for governance-relevant tasks) | per contract |

Preflight outcome is **candidate eligibility only**. Eligibility NEVER grants repository write authority, Git mutation authority, Linear mutation authority, provider access, publication authority, or issue-specific authority — those remain owned by AGENTS.md routing, project contracts, and Git Governance.

## 4. Governed versus ungoverned skills (current registry)

| Skill | Status | Preflight result |
| --- | --- | --- |
| `baukasten.press-ui` | governed, provisional, enabled | eligible candidate (non-privileged uses) |
| `baukasten.complexity-review` | governed, provisional, enabled | eligible candidate (non-privileged uses) |
| `baukasten.complexity-audit` | governed, provisional, enabled | eligible candidate (non-privileged uses) |
| fixing-accessibility | **ungoverned local directory** — no manifest; third-party LICENSE present but upstream provenance unpinned | INELIGIBLE for Governance-v2 reliance until a governed import transaction admits it |
| fixing-motion-performance | **ungoverned local directory** (same basis) | INELIGIBLE (same rule) |
| review-animations | **ungoverned local directory** (same basis) | INELIGIBLE (same rule) |

The three ungoverned directories are preserved untouched. They are NOT represented as governed anywhere, receive no invented manifests or pins, and cannot silently route as Governance-v2 skills. Their future path: an operator identifies each upstream repository and immutable commit/tag → governed import transaction under §5.1 → admission as `provisional` at best.

## 5. Controlled admission workflows

All admissions and lifecycle transitions require explicit review by the named routing-designated owner; Agents may ONLY propose candidates. Every workflow ends with validator PASS (`npm run validate:agents`) before the admission decision is recorded.

### 5.1 Third-party import
identify upstream repo + immutable tag/commit + license → provenance pin review → stable identity assignment → manifest creation (imported form) → lineage root → trust/environment declaration (`provisional`, ECD as applicable) → validator PASS → governed admission decision → preflight eligibility.

### 5.2 Project-authored new Skill
need statement from live Issue → authoring under `.agents/skills/<dir>/` → manifest (authored root) → lineage root rev-0001 → trust/environment declaration → validator PASS → admission decision → eligibility.

### 5.3 FIX
defect evidence (BAP-53 records) → FIX candidate proposal (same identity, new revision) → owner review of fix + evidence → validator PASS → new admitted revision; prior history remains auditable.

### 5.4 DERIVED
divergence purpose → new stable identity + parent linkage proposal → owner review → validator PASS → admitted as new governed skill (`provisional`).

### 5.5 CAPTURED
reusable subworkflow candidate with ALL FOUR guardrail prerequisites (procedure evidence, independent postcondition validation, capability boundary, limitations/preconditions) → owner review → validator PASS → admitted `provisional`.

### 5.6 Deprecate / retire
trigger evidence (staleness indicators, defects, governance change) → recommendation → owner decision recorded → transition applied to manifest(s) → validator PASS → routing treats per BAP-52 §6/A2.

## 6. Maintenance evidence behavior

Post-task evidence follows `docs/SKILL_EVIDENCE_CONTRACT.md` and hands off into the EXISTING maintenance/QA mechanisms — no parallel log system. Evidence MAY support: candidate recommendations, stale warnings, demotion recommendations, FIX candidates, fallback recommendations. Evidence MUST NOT automatically: rewrite `trust_state`, modify `enabled`, mutate manifests, rewrite lineage, reactivate retired skills, or grant authority. Secrets are never recorded (T5/T9).

## 7. Executor substitution neutrality

Agent ROLE/authority ≠ execution runtime. Codex, OpenCode, or another approved executor performs the same role under the same routing and authority contract. Runtime identity MUST NOT promote skill trust, bypass admission, widen repository scope, or alter QA independence.

## 8. Dry-run matrix (deterministic walkthroughs)

| # | Scenario | Walkthrough | Result |
| --- | --- | --- | --- |
| D1 | Governed skill end-to-end | Task needs an audit → resolve `baukasten.complexity-audit` in registry → preflight: manifest validates, identity/provenance/lineage resolve, lifecycle=provisional permits, enabled=true, environment null-ECD + non-privileged reading → eligible → execute audit procedure → run validation → record evidence shape per BAP-53 (`completed`, validation refs, verified redaction) | eligible used correctly; evidence handoff defined |
| D2 | Stale/negative-evidence degradation | Evidence shows repeated skill-attributed failures → recommendation: demotion candidate / FIX candidate created (same identity, new revision proposal) → NO trust/manifest mutation occurs automatically → named owner reviews and decides per BAP-52 §5 / BAP-54 §4.1 | recommendation-only honored |
| D3 | Ungoverned local directory | Executor considers fixing-accessibility → registry resolve fails (no manifest) → preflight check 1 fails → INELIGIBLE; directory untouched; future path = §5.1 import with pins | fail closed |
| D4 | Retired/unavailable skill | Manifest slice `trust_state:"retired"` (+`enabled:true`) → preflight check 6/8 fails (A2/L7) → ineligible regardless of switch | fail closed |
| D5 | Unknown high-risk environment | ECD requires tool/MCP/network element that evaluates `unknown` → preflight check 9 fails (A4) → ineligible | fail closed |
| D6 | Executor substitution | Same governed skill, same task, executed via Codex instead of OpenCode → identical preflight inputs → identical eligibility → identical evidence requirements; runtime name appears only as non-authority metadata | authority unchanged |

## 9. Linear traceability

Governance-relevant changes cite their BAP Issue, commit SHA, and validation evidence in Completion Evidence comments (established practice across BAP-50–57). Evidence records carry optional `task_ref` anchors. Neither substitutes for the other (BAP-53 §9).

## 10. Authority precedence

This document is subordinate to the master chain in §1 and creates no new Agent owner, no second top-level policy, no runtime dependency, and no execution authority. Where any wording here appears to conflict with a frozen contract, the frozen contract wins.
