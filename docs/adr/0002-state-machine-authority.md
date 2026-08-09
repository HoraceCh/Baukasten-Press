# 0002: Deterministic workflow state authority

- Status: Accepted
- Date: 2026-08-09
- Deciders: publication_contract_guardian
- Supersedes: none
- Superseded by: none

## Context

Publication safety requires one transition authority across UI, automation and adapters.

## Decision

Only BAP-10 `transitionPublication` changes workflow state.

## Boundaries and invariants

UI, agents, adapters, Website and Admin never mutate stages. Explicit confirmation remains distinct from review and preview.

## Alternatives considered

UI-, agent-, or adapter-owned state was rejected because it can bypass deterministic validation and audit.

## Consequences

Integration contracts carry immutable pins and normalized evidence, never a workflow stage.

## Follow-ups

Future orchestration must invoke the state machine rather than bypass it.
