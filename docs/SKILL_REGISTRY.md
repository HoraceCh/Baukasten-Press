# Skill Registry Representation

Status: frozen by BAP-55 · Consumed by: BAP-56 (migration), BAP-57 (routing integration), BAP-58 (audit)

This document defines the deterministic, project-local registry representation that `scripts/validate-skill-registry.mjs` enforces. The registry is **governance metadata only**: a derived index assembled from tracked repository files at validation time. It contains no runtime component, no database, no network discovery, no cloud services, and grants no execution authority.

## 1. Registry scope and resolution

| Source | Role |
| --- | --- |
| `.agents/skills/<dir>/skill.manifest.json` | Governed skill admission surface. A directory opts into governance by containing a manifest; the sibling `SKILL.md` remains the procedure file (BAP-51 separation of duties). |
| `docs/fixtures/{skill-manifest,skill-trust-env,skill-evidence,skill-lineage}/` | Contract fixture suite — test vectors for the frozen BAP-51–54 contracts. Fixtures live in the harness layer; they are NOT registry content. |
| `docs/fixtures/expected-verdicts.json` | Static harness metadata declaring the expected verdict (and contextual relational inputs) per fixture. |

Resolution is purely derived from these tracked files on every validation run. There is no persistent index to drift.

## 2. Activation policy (BAP-56 boundary)

The six active skills under `.agents/skills/` do not yet carry manifests; until BAP-56 migrates them, the governed-skill set is empty and the validator reports it as a counted pending state rather than an error. Once a manifest appears in a skill directory, the full manifest v1 contract applies immediately, including D2: a governed skill whose sibling `SKILL.md` or required manifest structure is missing fails closed. Migration MUST NOT change any active Skill's trust state merely to satisfy validation.

## 3. Enforcement matrix

The validator detects the frozen violation classes without reinterpreting them:

| Contract | Classes | Mechanism |
| --- | --- | --- |
| BAP-51 | D1–D7 | Manifest structural evaluation + directory-scoped lineage-parent resolution (including D4 broken lineage) + D1 contextual duplicate detection via declared duplicate target. |
| BAP-52 | A3/A4 structural rules | Environment Compatibility Declaration schema evaluation + host-context compatibility checks (`unknown` fails closed). Promotion/demotion gate shape checks (P1/P2/P4 presence; agents propose only). |
| BAP-53 | E1–E9 | Evidence record conditional-field evaluation, quality-record schema, redaction eligibility, link-resolution scan across inline and standalone quality records. |
| BAP-54 | L1–L7 | Revision bundle graph evaluation: resolvability, acyclicity, self-parenting, FIX identity preservation, DERIVED identity minting, content-hash collision, retired reactivation, CAPTURED guardrail prerequisites. |

Relational classes that cannot be decided from a single standalone record (D1 contextual duplicates, D4 manifest-parent resolution, E3 admission, E6 external links) are enforced through bundled records, declared deterministic context inputs in `expected-verdicts.json`, and built-in self-test probes. The harness requires every invalid fixture to name a nonempty exact violation class and every valid fixture to name `null`; unrelated findings cannot satisfy an expected class.

## 4. Self-test probes

Every validator run executes deterministic in-memory probes asserting that each core detector catches its synthetic violating case (D1, D3, D4, L1, L2, L5, L7, A4), including exact-class matching. A probe miss is itself a validator defect and fails the run. Probes are internal evaluator invariants — never a second authority.

## 5. Failure behavior

All findings accumulate and exit non-zero with deterministic messages naming fixture/skill, violated class, and location. The validator performs zero writes: no repository mutation, no repair, no trust/state change, no activation/deactivation. It is a pure function of tracked repository files — deterministic in a clean checkout without network access, OpenSpace installation, provider credentials, hidden global config, or mutable external state.

## 6. Command surface

The helper runs inside the existing `npm run validate:agents` pipeline via `scripts/validate-agent-infrastructure.mjs`; `npm run validate` consumes it transitively. No competing command family exists or may be added without a boundary-refresh Issue.

## 7. Authority precedence

Subordinate to `AGENTS.md`, canonical architecture/publication/domain contracts, security/testing requirements (incl. BAP-42), environment governance (BAP-41), routing authority (BAP-35), Git Governance, and executing-Issue scope. The registry validates; it never authorizes.
