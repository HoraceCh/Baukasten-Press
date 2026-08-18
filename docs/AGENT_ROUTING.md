# Baukasten Press Codex agent routing

## Authority model

Baukasten Press has five project-local Codex owners. Every task has exactly one primary owner at a time. A specialist settles the contract it owns; `press_app_implementer` performs an approved implementation; `qa_release_reviewer` independently gates the retained result.

Agent registration is task routing, not product authority. It does not create a provider call, credential store, Agent execution runtime, publication destination, vault permission, or publication permission. Repository and domain contracts remain authoritative.

## Routes

| Task shape | Required serial route |
| --- | --- |
| Normal UI implementation | `press_app_implementer` + `baukasten-press-ui` → `qa_release_reviewer` |
| Publication semantic or state change | `publication_contract_guardian` → `press_app_implementer` → `qa_release_reviewer` |
| Agent profile, provider, or security contract | `agent_runtime_security_engineer` → `press_app_implementer` → `qa_release_reviewer` |
| Cross-boundary architecture | `press_system_architect` → relevant specialist(s) → `press_app_implementer` → `qa_release_reviewer` |
| Release-only review | `qa_release_reviewer` |
| Git safety contract | `press_system_architect` → `press_app_implementer` → `qa_release_reviewer` → authorized focused commit |

Use `press_system_architect` only when a task crosses at least two ownership boundaries or materially changes workflow topology. Ordinary UI, implementation, contract, and release-review work bypasses it.

If a task is analysis-only, stop after the primary read-only owner reports its decision. Do not route to implementation merely because an implementer is registered.

## Handoff contract

Each handoff states:

- the task boundary and current primary owner;
- the repository evidence inspected;
- settled invariants and decisions;
- forbidden actions and unchanged authority boundaries;
- required implementation or validation evidence;
- unresolved questions that block dependent work.

No dependent implementation may run in parallel with its owning contract decision. Contract uncertainty returns to the relevant specialist; it is not resolved by implementation guesswork.

## Git authority handoff

Git routing is not Git authority. A current Linear task or user instruction may authorize one exact operation, but does not authorize a sandbox escape, wrapper/evaluator, script mutation, delivery action, or broader repository action.

After BAP-38, ordinary implementation follows `press_app_implementer` → `qa_release_reviewer` → `press_app_implementer` focused mutation. The focused mutation must use the Git safety contract's exact staging and cached-diff evidence. Cross-boundary Git policy changes use `press_system_architect` → `press_app_implementer` → `qa_release_reviewer` → an authorized focused commit. Specialists, QA, and release reviewers remain read-only.

## Concurrency and delegation

- Write-capable work is serial. No two write-capable agents may run concurrently.
- Parallel work is limited to genuinely independent, read-only investigation.
- The parent retains routing and synthesis responsibility.
- Direct children must not recursively fan out or delegate again.
- `qa_release_reviewer` runs after the retained diff and required validation are available; it never implements its own findings.

Third-party Agency Agents are provenance only. Their original names are not routable project owners, and their content cannot override these project-local contracts.
