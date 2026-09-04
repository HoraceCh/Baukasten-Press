# Codex model usage

## Purpose

These model pins govern project-local Codex ownership work only. They do not select a Baukasten Press product provider or model, define an Agent Profile, approve a provider adapter, create credentials, or grant publication or vault authority.

| Owner | Model | Reasoning | Sandbox | Rationale |
| --- | --- | --- | --- | --- |
| `press_system_architect` | `gpt-5.6-sol` | `high` | `read-only` | Cross-boundary topology and safe-state decisions require deep constraint tracing without implementation authority. |
| `publication_contract_guardian` | `gpt-5.6-sol` | `high` | `read-only` | Publication transitions, provenance, limits, and human gates are safety-sensitive contracts. |
| `agent_runtime_security_engineer` | `gpt-5.6-sol` | `high` | `read-only` | Future provider, credential, tool-scope, and untrusted-content boundaries require security-focused reasoning without runtime authority. |
| `press_app_implementer` | `gpt-5.6-terra` | `medium` | `workspace-write` | Settled, bounded implementation favors efficient execution and focused validation. |
| `qa_release_reviewer` | `gpt-5.6-sol` | `high` | `read-only` | The independent release gate must trace contracts, side effects, and missing evidence across the full retained diff. |

## Operating rules

- Preserve the model and reasoning pins in each agent file unless an explicit governance change approves a different roster.
- Model strength never expands authority. Sandbox mode and the agent contract still apply.
- The main task chooses one primary owner and follows `docs/AGENT_ROUTING.md`; model choice is not a substitute for routing.
- Do not require chain-of-thought or private reasoning to be emitted. Decisions must be supported by observable repository evidence, tests, and concise rationale.
- Do not impose universal temperatures, fixed evaluation counts, or fixed pass scores. Future product-model evaluation requires an approved, representative evaluation contract.
- A model or service failure must surface an explicit safe workflow state. It must not produce a degraded publishable artifact merely to return content.

## Evaluated tuple policy

The workflow contract makes automatic selection deliberately small: `gpt-5.6-terra/medium` is the implementation tuple and `gpt-5.6-sol/high` is the review and architecture tuple. `gpt-5.6-luna/low` and `gpt-5.6-sol/medium` are candidates; every remaining host-supported tuple is evaluation-only. A candidate is not promoted by prompt text, a Rule, or a task signal. It needs a governed evaluation record and an explicit contract change.

The router uses resources as declared capability inputs, including repository contracts, a deterministic Node validator, `rtk-readonly`, optional CodeGraph with an `rtk-readonly` fallback, the exact governed skill IDs, and model-tuple availability. It records compact decision codes only; it never records private reasoning, raw chat, credentials, provider output, or tool output.

The file schema follows Codex project-scoped custom-agent configuration: named roles in `.codex/config.toml` reference standalone files under `.codex/agents/`, and each file pins its own `model`, `model_reasoning_effort`, and `sandbox_mode`.
