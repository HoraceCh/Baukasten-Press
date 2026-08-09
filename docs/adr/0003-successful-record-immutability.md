# 0003: Immutable successful publication records

- Status: Accepted
- Date: 2026-08-09
- Deciders: publication_contract_guardian
- Supersedes: none
- Superseded by: none

## Context

Published history must remain reliable when sources later change or a delivery fails.

## Decision

Successful `PublishedRecord` evidence is append-only and exact; later signals never rewrite it.

## Boundaries and invariants

Attempts and source-revision signals preserve failure/history. A failed delivery creates no record; a new attempt needs fresh confirmation.

## Alternatives considered

Updating a prior successful record would erase provenance, so append-only evidence was chosen.

## Consequences

Historical public success remains auditable even after source changes.

## Follow-ups

Persistence must preserve immutable record semantics.
