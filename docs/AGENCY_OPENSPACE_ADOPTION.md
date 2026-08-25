# Agent & Skill Governance v2 — OpenSpace Provenance, Threat Model, and Adoption Boundary

Status: frozen by BAP-50 · Parent work package: BAP-49 · Feeds: BAP-51 → BAP-52 → BAP-53 → BAP-54 → BAP-55 → BAP-56 → BAP-57 → BAP-58

This document freezes the traceable upstream provenance, license, adopted/adapted/rejected capability boundary, and threat model that all Agent & Skill Governance v2 (BAP-51+) work must cite. It is deliberately offline-auditable: every claim below can be verified from this repository plus one immutable upstream snapshot reference. No OpenSpace code is installed, vendored, or executed.

## 1. Pinned upstream snapshot

| Field | Value |
| --- | --- |
| Upstream repository | https://github.com/HKUDS/OpenSpace |
| Description | "OpenSpace: The Skill Management Layer for AI Agents" |
| Pinned tag | `v2.0.0` |
| Pinned immutable commit | `fadc4bccab0e056226507eb5381b4272967f6bd3` |
| License | MIT (`LICENSE`, blob `d10e4dfee4f4dbd44b02d74ae0f1101b38e39aa2`; copyright "(c) 2026 Data Intelligence Lab@HKU") |
| Default branch HEAD at time of review | `38277815ed44a53d757973c2bc4454c3b6426698` (recorded for context only; NOT authoritative) |

Review method: GitHub REST API metadata plus raw file reads fetched directly at the pinned ref `fadc4bccab0e056226507eb5381b4272967f6bd3`. Floating `main` is explicitly not authority. Any refresh of this pin requires a new content, compatibility, and authority review under a new Issue.

## 2. Reviewed upstream surface

| Path (at pinned SHA) | Blob / tree SHA | Review observation |
| --- | --- | --- |
| `README.md` | `ecc1ec376c1ead991026a74536b0f6dffbcf4c12` (38,546 B) | Positions OpenSpace as a quality-first skill hub with cloud browsing, MCP serving, dashboard/TUI apps, task-trace uploads as quality evidence, and evidence-driven evolution. Confirms the rejected surfaces listed in §5. |
| `openspace/skill_engine/types.py` | reviewed content | Defines `SkillCategory` (tool_guide/workflow/reference), `SkillVisibility` (private/public, cloud-scoped), `SkillTrustState` (**only `provisional` / `trusted`** — no deprecated/retired states), `EvolutionType` (`FIX`/`DERIVED`/`CAPTURED`), `SkillOrigin` (`IMPORTED`/`CAPTURED`/`DERIVED`/`FIXED` root-and-parent DAG rules), `SkillLineage` (revision DAG: parents, generation, change summary, content hash/diff/snapshot, provenance refs, actor), `SkillJudgment` (per-task skill assessment). |
| `openspace/skill_engine/store.py` | `9bcb7ff00d1b5a2c3cfd24ac26e7b818e1d8e59c` (110,330 B) | Upstream skill-store runtime implementation. Inventoried (path/blob/size pinned); conceptually informs storage-layer thinking only — not adopted as code. |
| `openspace/skill_engine/registry.py` | `1ffddd4aff23479eb20597d6cb2b32da28256025` (72,128 B) | Upstream registry runtime. Same treatment as `store.py`. |
| `openspace/skill_engine/evidence/` | tree `ff080e70cd785e4de63745f9a681a94012a30086` | Evidence subsystem: packet builder, memory adapter/refs, profiles, and a dedicated `redaction.py`. The existence of explicit redaction confirms upstream treats evidence hygiene as first-class; Baukasten Press adopts the concept under BAP-53 with its own stricter rules. |
| `openspace/skill_engine/evolution/` | tree `eb6504f93bb3c21d0b7460cefb3d46a0537ff989` | Evolution subsystem implementing the FIX/DERIVED/CAPTURED candidate flow. Adopted conceptually under BAP-54 with human-authority gates added. |
| `openspace/host_skills/` | tree | Host-agent skills `delegate-task/` and `skill-discovery/` plus integration README describing dynamic discovery/MCP hosting — the concrete shape of the rejected dynamic-activation surface. |

## 3. Adopted conceptual subset (finite, closed)

Adopted as governance *concepts* to be re-specified project-locally by downstream Issues — never as upstream code or runtime:

1. Stable logical identity independent of file path (feeds BAP-51).
2. Evidence-backed trust state on skill revisions (feeds BAP-51/BAP-52). Note the deliberate extension: upstream defines only `provisional`/`trusted`; Baukasten Press adds `deprecated`/`retired`.
3. Availability separated from trust (`enabled`/`disabled` orthogonal to trust state) (BAP-52).
4. Execution evidence records tied to real task outcomes, with redaction discipline (BAP-53).
5. Revision lineage as a version DAG with `FIX` / `DERIVED` / `CAPTURED` origins and `IMPORTED`-style roots (BAP-54).
6. Local-first review before any third-party content becomes usable (BAP-51/BAP-57).

## 4. Adapted subset (upstream capability, project-local semantics)

1. Environment compatibility contracts — upstream has host/environment awareness; Baukasten Press specifies its own OS/GUI/headless/tool/MCP schema with `unknown` failing closed (BAP-52).
2. Promotion / demotion lifecycle — upstream trusts on evidence automatically inside its engine; Baukasten Press requires explicit project authority decisions plus evidence gates, adding demotion and deprecation paths absent upstream (BAP-52/BAP-54).
3. Retirement semantics — not modeled upstream at all; introduced project-locally (BAP-52/BAP-54).
4. Project-local registry + mechanical validators — upstream relies on its Python runtime/cloud services; Baukasten Press implements dependency-free repository-local validation integrated into `npm run validate:agents` (BAP-55).

## 5. Rejected subset (never adoptable)

1. The autonomous OpenSpace runtime / engine (`store.py`/`registry.py`/`protocol.py` execution stack) — no installation, vendoring, or embedding.
2. Cloud automatic import and any cloud skill-hub service dependency.
3. Unreviewed dynamic skill activation, including `host_skills/skill-discovery` style flows without local review.
4. The OpenSpace MCP execution layer (SSE/streamable-HTTP MCP hosting).
5. Dashboard / TUI application dependencies.
6. Any runtime dependency, provider integration, credential handling, vault write, publication authority, or external-repository write derived from upstream capabilities.
7. Upstream benchmark scores or cloud quality summaries as project authority.
8. A second Agent ownership model — BAP-35 ownership remains sole authority.

## 6. Threat model and Baukasten Press control boundaries

| # | Risk | Baukasten Press control boundary |
| --- | --- | --- |
| T1 | Identity collision / impersonation (two skills claiming one `skill_id`) | BAP-51 stable-ID uniqueness + registry duplicate-ID fail-closed validation (BAP-55); path rename never mints identity. |
| T2 | Incorrect trust promotion (trusted without real evidence) | BAP-52 promotion requires explicit project authority decision + evidence prerequisites; single success never auto-promotes (BAP-53 aggregation rule); BAP-58 audit dry-run. |
| T3 | Environment mismatch (skill used where OS/tools/MCP unavailable) | BAP-52 environment contract with `compatible`/`incompatible`/`unknown`; `unknown` fails closed; preflight check in routing (BAP-57). |
| T4 | Stale Skill activation (outdated revision still routed) | Availability/trust separation + revision-aware registry resolution (BAP-51/BAP-52); retired/deprecated excluded from default candidates (BAP-55 validation class). |
| T5 | Fabricated or incomplete evidence (LLM-invented "success") | BAP-53 evidence records only verifiable facts anchored to Issue IDs, commits, and validation output; LLM free-text alone is insufficient; redaction discipline inherited from upstream evidence concept. |
| T6 | False lineage / provenance spoofing (fake parent or source claim) | BAP-54 lineage DAG validation: parent existence, cycle detection, origin rules; provenance refs must resolve to this document's pinned snapshot or declared project-authored origin (BAP-55 validation class). |
| T7 | Third-party import risk (malicious or low-quality external skill) | Local-first review gate before any import becomes usable (adopted concept §3.6); admission workflow requires explicit review (BAP-57); no automatic cloud import (rejected §5.2). |
| T8 | Prompt injection through skill content | Skills remain advisory guidance subordinate to project contracts (AGENTS.md precedence §7); trust state gates availability; security/testing requirements always outrank skill instructions (BAP-49 constraints). |
| T9 | Credential exfiltration via skill instructions | No credential values in manifests/environment contracts (capability categories only); Git Governance + safety validators prohibit secret persistence; evidence redaction rules (BAP-53). |
| T10 | Unreviewed dynamic activation | Rejection of dynamic/cloud activation (§5.3); registry resolution only over project-local canonical directories and explicitly approved copied skills (BAP-51 discovery precedence). |
| T11 | False promotion / demotion decisions | Promotion/demotion require named authority + evidence gate (BAP-52/BAP-54); agents may only propose candidates (BAP-35 ownership preserved). |
| T12 | Retired Skill reuse | Retired state enforced in registry/routing (BAP-55 validation class "retired default-use"); retirement decisions recorded, never silent deletes (BAP-56). |

## 7. Authority precedence

OpenSpace-derived concepts are advisory provenance and strictly subordinate to, in order:

1. `AGENTS.md`
2. Canonical Baukasten Press architecture, publication, and domain contracts
3. Security and testing requirements (including BAP-42)
4. Environment governance (including BAP-41)
5. Routing authority (owner routing and QA independence from BAP-35)
6. Git Governance (BAP-37/38 chain)
7. Issue-specific authority for each executing Issue (BAP-50 → 58)

OpenSpace creates no new Agent owner, no competing top-level policy, and no hidden authority. Where upstream behavior and any Baukasten Press authority conflict, upstream loses.

## 8. Refresh policy

Changing the pinned snapshot, expanding the adopted subset beyond §3, or adopting anything currently in §5 requires a new Issue with fresh content, compatibility, and authority review. This boundary may be tightened at any time; loosening it may not.
