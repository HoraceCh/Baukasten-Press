# 0004: Versioned publish adapter isolation

- Status: Accepted
- Date: 2026-08-09
- Deciders: press_system_architect, publication_contract_guardian
- Supersedes: none
- Superseded by: none

## Context

Press must deliver confirmed drafts without importing Website internals.

## Decision

Use a versioned `PublishAdapterV1` port and normalized envelopes; no concrete client is part of Phase 0.

## Boundaries and invariants

`requestId` is the active-operation idempotency key. Exact pins echo in results. Success IDs/revisions map to immutable domain evidence; URLs are presentation only. Failures are normalized and never restart generation.

## Alternatives considered

Importing a Website client or private schema would couple repositories and expose authority; the isolated port was chosen.

## Consequences

Website can implement independently while Press validates contract data fail-closed.

## Follow-ups

Create a Website-owned idempotent v1 endpoint/client issue when downstream work is authorized.
