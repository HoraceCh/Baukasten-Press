# Integration contracts

This document defines the Phase 0 public boundaries of Baukasten Press. It is a contract, not an adapter implementation, persistence schema, authorization grant, or workflow engine.

## Ownership and direction

| Boundary | Owner | Direction | Not shared |
| --- | --- | --- | --- |
| Obsidian source vault | Vault user | Press requests a read-only capture | Source writes, absolute paths, `.obsidian`, backlinks, unrelated metadata |
| Baukasten Press | Press | Owns source snapshots, drafts, deterministic workflow, confirmations, evidence, and records | Website/Admin private state, credentials, provider state |
| Horace Website | Website | Receives one exact confirmed draft through `PublishAdapterV1`; returns a normalized result | Website DB, ORM, private models and API objects |
| Horace Website Admin | Admin | No direct Press integration in v1 | Press workflow mutation, Admin sessions/models, publication confirmation authority |

Website Admin may manage Website through Website-owned contracts. Any direct Admin-to-Press workflow needs a new versioned contract and ADR.

## Versioning

`ObsidianSourceIntakeV1` and `PublishAdapterV1` each require the exact string version `1.0`. Unknown versions fail closed. A major change is breaking; an additive minor version still requires explicit support and is never accepted merely because its major version matches. Multiple explicitly supported versions may coexist. Website or Admin internal schema versions are never Press contract versions.

## Read-only source intake

Press creates `sourceNoteRefId`, `publicationItemId`, `correlationId`, and the positive `sourceVersion`; it supplies a vault-relative `sourcePath` locator and application-clock `requestedAt`. A captured result echoes every pin and supplies exact UTF-8 Markdown, its lowercase SHA-256 hash, `capturedAt`, and optional observational `sourceModifiedAt`.

`sourceNoteRefId` identifies one immutable snapshot, not a note over time. The path is not identity. A failed result echoes only its pins and a safe normalized error; it never carries content, hashes, or partial `SourceNoteRef` data and does not consume a persisted source version. Reusing an accepted reference ID is valid only as a byte-identical replay.

The intake boundary cannot write source notes. A later change is observed through BAP-10's `observe_source_revision`, not by rewriting captured history.

## Publishing port

`PublishAdapterV1` is a TypeScript port only. The request uses active publish operation `requestId` as its exact-payload idempotency key and includes the exact source/draft/review/confirmation pins, draft UTF-8 Markdown, destination and version. It never includes source content/path, a workflow stage, credentials, or Website/Admin internal objects.

The application validates BAP-10 approval, confirmation, destination-version, and active-operation pins before calling the port. The adapter cannot receive or mutate workflow state.

On success, `downstreamId` maps to BAP-9 `destinationReference`; `downstreamRevision` maps to `destinationRevision`; an absolute HTTP(S) `downstreamUrl` is presentation metadata only. Press computes `receiptHash` from recursively canonicalized success JSON (sorted object keys; array order and nulls retained; UTF-8 SHA-256).

On failure, the adapter returns only a known code, safe one-line summary, boolean `retryable`, and optional HTTP status. Raw bodies, stack traces, tokens, credentials, private models, and source/draft content are prohibited. `retryable` is evidence for a human decision, never permission to retry, regenerate, or reuse confirmation.

Before `start_publish`, a rejected integration preflight remains `publish_ready` without workflow mutation. After `start_publish`, malformed, mismatched, or thrown adapter behavior must become a normalized failed `PublishAttempt`, pass only through `transitionPublication` to `publication_failed`, create no `PublishedRecord`, and require fresh confirmation.

## Audit and future work

Audit may retain IDs, versions, hashes, correlation, destination, normalized status/code, downstream ID/revision and receipt hash. It must omit content, unnecessary paths, raw responses, stacks, private Website/Admin state, tokens, and credentials.

A future Horace Website repository issue must implement an idempotent v1 endpoint/client that returns the normalized success/failure envelope. No Admin implementation is required in v1.
