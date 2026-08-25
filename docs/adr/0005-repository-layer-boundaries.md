# 0005: Repository layer boundaries

- Status: Accepted
- Date: 2026-08-18
- Deciders: press_system_architect, press_app_implementer
- Supersedes: none
- Superseded by: none

## Context

Baukasten Press needs a repository-local dependency direction that lets future application, adapter, agent, and UI work consume the frozen Phase 0 contracts without creating another workflow authority or requiring a broad directory refactor.

## Decision

`src/domain/` owns pure entities, invariant validation, and workflow transition authority. `src/contracts/` owns versioned boundary DTO validation. Future `src/application/` code coordinates commands and declared ports by consuming those authorities. Future adapters/infrastructure, agents, and UI/Obsidian composition depend inward through application ports and never own workflow state, confirmations, or external-write authority. Tests provide deterministic evidence and do not become a second business-rule source.

The tracked pre-foundation pending-queue scaffold and legacy mappings remain non-canonical until their future authorized reconciliation; they are not rewritten as part of this decision.

## Boundaries and invariants

Domain does not import UI, Obsidian, agents, providers, adapters, or infrastructure. Contracts do not import Website/Admin private schemas. UI visibility is not authorization. Agent output is untrusted evidence. Adapters normalize versioned boundary values and cannot mutate workflow state. Cross-project interaction uses explicit versioned ports and no shared mutable persistence.

## Alternatives considered

Making the existing directory layout authoritative would preserve ambiguous legacy behavior. A broad Phase 0 refactor would expand scope and risk changing user work. The logical layer map is therefore frozen now; later implementation reconciles only its authorized module.

## Consequences

Future work has a single inward dependency direction and can test canonical domain, transition, and integration authorities without duplicating them. Any change to these boundaries or authority ownership requires a new ADR.

## Follow-ups

Reconcile the pre-foundation pending-queue scaffold during its authorized Phase 1 work; do not use it as a substitute for the frozen contracts.
