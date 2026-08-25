# 0001: Cross-project ownership boundary

- Status: Accepted
- Date: 2026-08-09
- Deciders: press_system_architect, publication_contract_guardian
- Supersedes: none
- Superseded by: none

## Context

Baukasten Press needs source intake and Website delivery without hidden shared state.

## Decision

Vault/user owns source notes; Press captures immutable read-only evidence and owns workflow records; Website owns its external resource. Website Admin has no direct Press boundary in v1.

## Boundaries and invariants

No source writes, shared database, ORM/private-model access, credentials, or Admin workflow mutation. Paths are locators, not identity.

## Alternatives considered

Shared persistence or private schemas would couple deployments and bypass authority; explicit public contracts were chosen.

## Consequences

Later projects integrate through versioned DTOs and cannot rely on hidden state.

## Follow-ups

Website needs a separately owned v1 endpoint/client issue.
