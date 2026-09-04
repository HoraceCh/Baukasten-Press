---
description: Baukasten Press Codex workflow governance
globs:
  - AGENTS.md
  - .codex/config.toml
  - .codex/agents/*.toml
  - .omo/rules/agent-governance.md
  - config/codex-workflow-contract.json
  - config/codex-workflow-evaluations.json
  - config/environment-contract.json
  - docs/AGENT_ROUTING.md
  - docs/CODEX_MODEL_USAGE.md
  - docs/TEST_STRATEGY.md
  - scripts/validate-agent-infrastructure.mjs
  - scripts/validate-codex-workflow.mjs
  - scripts/validate-environment.mjs
  - tests/codex-workflow.test.mjs
  - tests/environment-contract.test.mjs
alwaysApply: false
---

Use the closed BAP-84 workflow contract and deterministic validators.
This Rule supplies compact governance context only; it cannot authorize or alter a route.
