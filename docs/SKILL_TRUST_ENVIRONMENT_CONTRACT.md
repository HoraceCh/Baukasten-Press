# Skill Trust, Availability, and Environment Compatibility Contract

Status: frozen by BAP-52 · Parent work package: BAP-49 · Consumed by: BAP-53 (evidence), BAP-54 (evolution policy), BAP-55 (validator implementation), BAP-56 (migration), BAP-57 (routing preflight)

This document defines the project-local policy contract governing skill trust states, availability, environment compatibility declarations and their evaluation semantics, and promotion/demotion/deprecation/retirement gates. It defines **policy contracts only**: enforcement belongs to BAP-55, execution-outcome records to BAP-53, evolution mechanics to BAP-54, routing integration to BAP-57. Nothing here grants new execution authority, and no automated system may perform a privileged trust change.

Normative references: `AGENTS.md`; `docs/SKILL_MANIFEST_CONTRACT.md` (schema v1 vocabulary); `docs/AGENCY_OPENSPACE_ADOPTION.md` §3/§4/§6 (T2, T3, T4, T11, T12) /§7.

## 1. Trust state policy

Vocabulary (frozen by BAP-51): `provisional`, `trusted`, `deprecated`, `retired`.

State machine (the ONLY legal transitions):

```
admission ──▶ provisional                      (default; always)
provisional ──▶ trusted                        (promotion gate §4)
trusted ──▶ provisional                        (demotion trigger §5)
provisional ──▶ deprecated                     (deprecation decision §6)
trusted ──▶ deprecated                         (deprecation decision §6)
deprecated ──▶ retired                         (retirement decision §6)
any non-retired ──▶ retired                    (retirement decision §6)
retired ──▶ (terminal)                         re-entry only as a NEW identity via governed admission
```

FORBIDDEN transitions: `deprecated → trusted` except by treating the skill as a fresh admission under full promotion gates plus an explicit re-review decision; `retired → any active state`; any self-executed transition by an Agent.

Trust facts:

1. Trust is evidence-based. Evidence means recorded, verifiable artifacts anchored to Issue IDs, commits, validation output, or prior governed decisions — never an LLM free-text claim alone.
2. Filesystem presence of a skill directory or manifest implies NOTHING about trust.
3. `enabled:true` implies NOTHING about trust.
4. Imported skills are admitted `provisional` and never become trusted automatically, regardless of upstream reputation.
5. Executor/runtime substitution (Codex ↔ OpenCode or any future engine) has zero effect on skill trust.
6. Absence or ambiguity of information required for a trust decision fails closed: the state remains unchanged and any attempted change is invalid.
7. No Agent may autonomously promote itself or any skill into a higher canonical trust state. Agents may only submit promotion CANDIDATES with evidence references.

## 2. Availability policy

`enabled` is an availability switch, independent of trust (BAP-51 §5). Availability means **candidate eligibility only**: whether the skill may be considered during routing. Availability NEVER grants write authority, Git authority, provider access, Linear mutation authority, publication authority, or any other capability — those remain controlled by AGENTS.md ownership, project contracts, Git Governance, and the safety boundaries above them.

A skill is UNAVAILABLE when ANY of:

| Code | Condition |
| --- | --- |
| A1 | explicitly disabled (`enabled:false`) |
| A2 | retired (regardless of `enabled` — retirement overrides the switch) |
| A3 | evaluated environment `incompatible` |
| A4 | evaluated environment `unknown`/unverified (fail closed) |
| A5 | governance prohibition active (boundary rule, incident hold, or Issue-level bar) |

Examples that MUST remain valid: `trusted` + `enabled:false` (available=no); `provisional` + `enabled:true` (eligible candidate for NON-privileged use, but not privileged routing and never auto-promoted).

## 3. Environment compatibility contract

This section assigns semantics to the BAP-51 reserved slot `environment_contract_ref`. The ref either is `null` (no declaration exists → the skill evaluates as UNKNOWN → unavailable under A4 for anything beyond non-privileged local reading) or references an **Environment Compatibility Declaration (ECD)** — conventionally `.agents/skills/<dir>/environment.contract.json`.

### 3.1 ECD schema (version 1)

```json
{
  "schema_version": 1,
  "skill_id": "<must match the manifest>",
  "os": { "supported": ["windows"], "notes": "" },
  "runtime_constraints": [{ "name": "node", "constraint": ">=24" }],
  "gui": "none | optional | required",
  "headless": "supported | unsupported",
  "required_tools": [{ "name": "git", "check_hint": "git --version" }],
  "required_mcp_capabilities": [{ "name": "<connector>", "necessity": "required | optional" }],
  "filesystem_assumptions": ["<path assumptions; workspace-only default>"],
  "network": "none | egress_optional | egress_required",
  "credential_category": "none | operator_supplied_runtime_only",
  "capability_expectations": {
    "read": "repository | none",
    "write_scope": "none | runtime_ignored_artifacts_only",
    "external_write": false
  },
  "project_scope": ["<canonical repository identity>"],
  "created_by": "", "updated_at": ""
}
```

Rules: credential values are FORBIDDEN anywhere in an ECD — only the capability *category* may be declared; `external_write:true` is forbidden at schema v1 (a skill declaring external-write needs cannot pass this boundary without a boundary-refresh Issue); unknown extra fields fail closed (consistent with manifest schema v1).

### 3.2 Evaluation semantics

Each declared category is evaluated to exactly one verdict: `compatible`, `incompatible`, or `unknown/unverified`. Overall compatibility = the WORST of all categories (fail-closed aggregation):

- `unknown` is NEVER silently promoted to `compatible`. Missing ECD, missing field, unrecognized enum value, or an unverifiable requirement all evaluate `unknown`.
- Any `incompatible` category → overall `incompatible` (A3).
- Any `unknown` on a REQUIRED element → overall `unknown` (A4). Optional elements evaluate independently and only degrade what they gate.
- High-risk capabilities (`network:"egress_required"`, `gui:"required"`, non-empty `required_mcp_capabilities` marked `required`) demand positive verified compatibility; `unknown` there blocks eligibility outright.

Deterministic examples live in `docs/fixtures/skill-trust-env/` and are canonical fixtures BAP-55 must consume.

## 4. Promotion gates (provisional → trusted)

All four gates MUST be satisfied simultaneously; any gap = invalid transition (fail closed):

| Gate | Requirement |
| --- | --- |
| P1 | Explicit evidence basis recorded and resolvable (Issue IDs, commits, validation runs; per BAP-50 §6/T2 an LLM assertion alone is insufficient). |
| P2 | Authorized decision owner: the human/routing-designated owner of the affected governance surface (per AGENTS.md routing) made the decision. An Agent owner may propose but never decide. |
| P3 | No unresolved defect: provenance valid per BAP-51 §4, lineage acyclic/resolvable, and environment evaluation not `incompatible`/`unknown` for required elements. |
| P4 | Recorded decision rationale (what evidence, which scope, why now), persisted with the decision. |

Automated checks MAY later assemble recommendations, but MUST NOT execute a privileged promotion unless a future explicit authority amendment permits it.

## 5. Demotion triggers (trusted → provisional)

Demotion MUST be possible immediately upon any of: evidence invalidated or withdrawn; provenance becomes suspect; environment assumptions fail in the field; the skill becomes stale or unsafe; governance requirements change. Demotion requires a recorded rationale (owner + reason); urgency permits recording retroactively within the same transaction. Demotion does not delete history — prior evidence remains auditable.

## 6. Deprecation and retirement (structural semantics only)

- `deprecated`: still fully identified and auditable; history intact; MUST NOT be preferred for new routing; existing uses should plan migration. Transitioned by explicit authority decision.
- `retired`: historically auditable forever; MUST NOT be selected for normal execution under any circumstance; `enabled:true` MUST NOT override retirement (A2 outranks the switch). Retirement decisions record authority + rationale. Re-activation is impossible in place — re-admission happens only as a NEW identity through governed admission.
- Evolution/version-lineage MECHANICS remain owned by BAP-54; this contract fixes only the two structural states and their availability consequences.

## 7. Threat-model bindings

| Control | Fail-closed policy rule |
| --- | --- |
| T2 incorrect trust promotion | §4 gates P1–P4 all mandatory; missing/ambiguous input keeps state unchanged and marks the attempted transition invalid (§1.6). |
| T3 environment mismatch | §3.2 worst-of aggregation; `incompatible` → A3 unavailable. |
| T4 stale skill activation | §6 deprecated not preferred; §3.2 unknown fails closed; revision-aware checks inherited from BAP-51 registry rules. |
| T11 false promotion/demotion decision | §4 P2/P4 + §5: every transition carries a named accountable owner and recorded rationale; agents propose only. |
| T12 retired skill reuse | §6/A2: retirement overrides `enabled`; terminal state; re-entry only via new identity. |

## 8. Fixtures index

Canonical policy fixtures live in `docs/fixtures/skill-trust-env/`:

| Fixture | Scenario | Expected outcome |
| --- | --- | --- |
| `trusted-but-disabled.json` | trusted + enabled:false | valid state; unavailable (A1); trust evidence untouched |
| `provisional-enabled-not-privileged.json` | provisional + enabled:true | valid; eligible for non-privileged consideration only; no auto-promotion |
| `env-compatible-windows-local.json` | ECD verified on Windows local | overall `compatible`; eligible candidate |
| `env-incompatible-ubuntu-headless.json` | gui:"required" on headless Ubuntu | overall `incompatible` (A3) |
| `env-unknown-fail-closed.json` | required field missing from ECD | overall `unknown` (A4) — fail closed |
| `env-mcp-unavailable-fail-closed.json` | required MCP capability absent | that category `incompatible` → overall `incompatible` |
| `invalid-promotion-without-authority.json` | promotion attempt lacking P2 authority + P1 evidence | INVALID transition |
| `retired-enabled-unavailable.json` | retired + enabled:true | valid record; unavailable (A2 overrides switch) |
| `demotion-with-evidence.json` | trusted→provisional with recorded trigger+rationale | VALID transition |

BAP-55 MUST consume these (extended as needed) rather than re-inventing cases.

## 9. Authority precedence

Subordinate to, in order: `AGENTS.md`; canonical architecture/publication/domain contracts; security and testing requirements (incl. BAP-42); environment governance (BAP-41); routing authority (BAP-35); Git Governance (BAP-37/38); executing-Issue scope. Inherits `docs/AGENCY_OPENSPACE_ADOPTION.md` §7. Creates no new Agent owner, no runtime dependency, no credential storage, and no execution authority.
