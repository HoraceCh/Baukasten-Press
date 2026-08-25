# Agency Agents adoption record

## Ponytail provenance and adoption boundary

- Upstream repository: `DietrichGebert/ponytail`
- Pinned release snapshot: tag `v4.8.4`, commit `bc9ee949d5f439e8b9f3bb92c6d6d3d1e6ebd324`
- License: MIT
- Dependency status: advisory provenance only; no package, plugin, script, runtime dependency, floating `main` reference, or online dynamic loading is permitted.

This record adopts only three bounded ideas from the pinned snapshot: a minimal implementation ladder, over-engineering review, and repository audit. They remain advisory inputs to project-local work; they do not install or register Ponytail content, change Agent ownership or routing, create publication authority, alter Git authority, or create an acceptance target based on upstream benchmark numbers.

The following Ponytail mechanisms are explicitly rejected: global plugin installation, lifecycle hooks, global mode state, the `ponytail-debt` backlog, and automatic subagent injection. Baukasten Press `AGENTS.md`, architecture and publication contracts, BAP-42 validation, and Git Governance remain authoritative and override every upstream suggestion.

Any future upstream refresh must pin a new release snapshot and repeat content, compatibility, and authority review before its results may be recorded here. QA must be able to verify the adopted and rejected subsets from this repository alone, without a network lookup.

## Provenance and disposition

- Upstream pattern library: `msitarzewski/agency-agents`
- Reviewed commit: `ebe9c99acb5c96f9468de368d8bead775387d1a7`
- Disposition: adapt selected principles into project-local ownership; do not install, sync, dynamically import, or register upstream agents under their original names.
- Authority: this repository's `AGENTS.md`, domain contracts, canonical UI specification, project-local Skill, routing document, and agent files override all upstream content.

The upstream repository is advisory provenance, not a dependency or runtime. The entries below summarize retained ideas and deliberately stripped assumptions without copying upstream prompts.

## Candidates adapted

| Upstream candidate | Local destination | Retained principle | Rejected or stripped assumptions | Local effect |
| --- | --- | --- | --- | --- |
| Multi-Agent Systems Architect | `press_system_architect` | Explicit topology, bounded handoffs, failure taxonomy, least privilege, human gates, context ownership, and auditability. | Always producing usable content; automatic mesh or hierarchy; fixed evaluation counts; generic model fallback authority. | **New rule:** created a cross-boundary-only architect and required explicit safe failure states rather than degraded publishable artifacts. |
| Workflow Architect | `press_system_architect`; `publication_contract_guardian` | Explicit branches, state maps, handoff schemas, recovery paths, and assumption tracking. | Automatic discovery outside task scope; exhaustive workflow registry; invented universal timeouts. | **New rule:** split topology from publication semantics and made owning contract decisions serial prerequisites for implementation. |
| Prompt Engineer | `agent_runtime_security_engineer` | Versioned prompts, input/output schemas, regression cases, model/profile provenance, and known limitations. | Chain-of-thought output; fixed temperature; cross-model folklore; unvalidated universal success targets. | **New rule:** established a future runtime-security contract owner without implementing any prompt, profile, provider, or runtime. |

## Principles extracted into local ownership

| Upstream extract | Local destination | Retained principle | Rejected or stripped assumptions | Local effect |
| --- | --- | --- | --- | --- |
| Codebase Onboarding Engineer | `press_system_architect`; `press_app_implementer` | Source-first orientation and execution-path tracing. | Fixed multi-layer onboarding reports and artificial limits on inspected files. | **Clarified rule:** read broadly enough to prove correctness while keeping writes narrow. |
| Code Reviewer | `qa_release_reviewer` | Correctness, security, regression, and test-evidence review. | Reviewer persona expansion and a target count of findings. | **New rule:** independent evidence-driven final gate with four exact statuses. |
| Git Workflow Master | `AGENTS.md`; `qa_release_reviewer` | Inspect the worktree, preserve user changes, and audit diff scope. | New branching, commit, or release strategy. | **Already satisfied:** existing worktree-preservation rules remain; QA now checks retained diff scope. |
| Minimal Change Engineer | `press_app_implementer` | Every changed line needs a task-specific reason; defer worthwhile adjacent work. | Prohibiting reads of unmentioned files and mechanical abstraction thresholds. | **New rule:** smallest behavior-preserving diff with broad-enough inspection and narrow writes. |
| Developer Tooling Engineer | `scripts/validate-agent-infrastructure.mjs`; `press_app_implementer` | A focused, dependency-free infrastructure validator. | General CLI platform construction or new tooling dependencies. | **New rule:** added one read-only Node validator for this governance surface. |
| Privacy Engineer | `publication_contract_guardian`; `agent_runtime_security_engineer` | Data minimization, sensitive-content boundaries, and retention awareness. | Enterprise consent, DSAR, or privacy-platform machinery unrelated to this local plugin. | **Clarified rule:** publication-boundary minimization and isolated credential/content contracts; existing source-note protections remain. |
| UX Architect | `baukasten-press-ui`; `docs/design/UI_DESIGN.md` | Task hierarchy, state clarity, and host-native interaction. | Generic website design systems and duplicate UX ownership. | **Already satisfied:** canonical UI rules remain unchanged. |
| Persona Walkthrough Specialist | `baukasten-press-ui`; `qa_release_reviewer` | Review the complete real user journey and state sequence. | Invented personas and speculative research claims. | **Already satisfied:** the UI workflow covers real lifecycle states; QA may require journey evidence when UI changes. |
| UI Finish-Gate Reviewer | `qa_release_reviewer`; `baukasten-press-ui` | Compare the retained UI against its specification and rendered evidence. | A separate write-capable UI reviewer or style-only gate. | **Clarified rule:** QA owns final UI/accessibility evidence without duplicating the Skill. |
| Experiment Tracker | `agent_runtime_security_engineer`; `qa_release_reviewer` | Prompt/profile/model version and evaluation-run provenance. | Product A/B experimentation infrastructure. | **New future contract obligation:** evaluation provenance is owned, but no runtime or experiment system was added. |
| Test Results Analyzer | `qa_release_reviewer` | Aggregate evidence and classify failures accurately. | Score-driven conclusions and presumed failure states. | **New rule:** unrun tests remain missing evidence, never inferred passes. |
| Tool Evaluator | `agent_runtime_security_engineer`; `qa_release_reviewer` | Evaluate future adapters against explicit capability, safety, and evidence criteria. | A permanent generic evaluator or automatic provider selection. | **New future contract obligation:** provider-neutral evaluation ownership only. |
| Workflow Optimizer | `press_system_architect`; `qa_release_reviewer` | Detect retry waste, duplicate work, bottlenecks, and unsafe side effects. | Automatically changing workflow semantics or limits. | **Clarified rule:** optimization may recommend bounded changes but cannot override publication contracts. |
| Accessibility Auditor | `baukasten-press-ui`; `qa_release_reviewer` | Accessible names, keyboard and focus behavior, semantics, announcements, contrast, reduced motion, and forced colors. | Duplicating the project's mature accessibility checklist. | **Already satisfied, zero duplicate rule:** existing Skill and UI specification remain primary. |
| Test Automation Engineer | `qa_release_reviewer` | Deterministic transition tests and side-effect verification. | Introducing another test framework or universal coverage target. | **New rule:** QA checks behavior-matched deterministic evidence using the existing toolchain. |
| Security Architect | `agent_runtime_security_engineer` | Trust boundaries, least privilege, and explicit threat surfaces. | Enterprise-wide security architecture outside the plugin. | **New future contract obligation:** bounded runtime and provider security ownership only. |
| Application Security Engineer | `agent_runtime_security_engineer`; `qa_release_reviewer` | Untrusted input, path validation, and external-content handling. | Web-only checklists and unrelated authentication architecture. | **New rule:** runtime contracts and final QA explicitly cover untrusted content and paths. |
| AI-Generated Code Security Auditor | `agent_runtime_security_engineer`; `qa_release_reviewer` | Unsafe-default, secret-leakage, authority, and path-assumption review. | A new implementation owner or automatic fix authority. | **New rule:** security evidence is part of the read-only final gate. |
| Secrets & Credential Hygiene Engineer | `agent_runtime_security_engineer` | Credentials must be isolated, scoped, lifecycle-controlled, and absent from logs. | Implementing credential storage during governance adoption. | **New future contract obligation:** credential-boundary ownership with an explicit implementation prohibition. |
| Agentic Identity & Trust Architect | `agent_runtime_security_engineer` | Declared agent identity, allowed-action scope, and recorded consequential results. | PKI, signing infrastructure, delegation chains, reputation, and trust scoring. | **New future contract obligation:** least-privilege identity semantics without cryptographic infrastructure. |
| Model QA Specialist | `agent_runtime_security_engineer`; `qa_release_reviewer` | Reproducible, representative model/profile evaluation and regression baselines. | SHAP, calibration, traditional-ML metrics, fixed temperatures, or universal scores. | **New future contract obligation:** evaluation ownership without selecting or calling a product model. |
| Automation Governance Architect | `press_system_architect`; `publication_contract_guardian` | Human checkpoints, bounded retries, stop conditions, idempotency, manual fallback, source of truth, and audit trails. | n8n assumptions, business ROI scoring, and generic automation-platform design. | **Clarified rule:** existing attempt limits and human confirmation remain authoritative; architecture must fail to an explicit safe state. |

## Explicit rejections

| Upstream example | Reason rejected |
| --- | --- |
| Evidence Collector | Its conclusion-first target for a preset number of issues would bias an evidence-driven release gate. |
| Reality Checker | Its default NEEDS WORK posture predetermines the outcome instead of deriving status from criteria and evidence. |

Neither rejected example is registered, routable, or copied into local QA behavior. Reference-only and rejected upstream agents remain outside the project ownership system.
