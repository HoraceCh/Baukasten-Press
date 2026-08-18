# Foundation architecture

This is the BAP-5 assembly and topology index. It links the normative Phase 0 contracts; it does not duplicate their schemas, transition table, or validation logic. BAP-5 is an architecture work package, not the Phase 0 exit gate.

## Normative authorities and prerequisite evidence

| Prerequisite | Commit | Normative evidence |
| --- | --- | --- |
| BAP-9 domain model | `6fe60f7` | [Publication domain](domain/PUBLICATION_DOMAIN.md): immutable evidence graph and `PublicationItem` aggregate. |
| BAP-10 state machine | `e47b564` | [Publication state machine](domain/PUBLICATION_STATE_MACHINE.md): sole transition authority, budgets, audit, and recovery. |
| BAP-11 integration contracts and ADRs | `0f7104b` | [Integration contracts](contracts/INTEGRATION_CONTRACTS.md) and [ADR registry](adr/README.md): versioned, fail-closed ports. |
| BAP-35 Agent Governance v1 | `b323701` | [Agent routing](AGENT_ROUTING.md) and `AGENTS.md`: one primary owner; agents have no workflow or external-write authority. |
| BAP-41 environment/config contract | `b40f50c` | [Development environment](DEVELOPMENT_ENVIRONMENT.md): exact configuration authority and fail-closed local profiles. |
| BAP-42 test/validation contract | `66a5a2c` | [Test strategy](TEST_STRATEGY.md): deterministic contract suite and unified validation gate. |

## System and data ownership

| System | Owns | May write | Contract direction | Must not own or receive |
| --- | --- | --- | --- | --- |
| Vault user / Obsidian vault | Source notes and vault configuration | Only the vault user under their own authority | `ObsidianSourceIntakeV1` supplies a read-only snapshot to Press | Press must not write source notes, `.obsidian`, `98 Publish`, user notes, or use absolute paths as identity. |
| Baukasten Press | Source snapshots, public drafts, workflow, confirmations, attempts, audit evidence, and published records | Only its explicitly configured future publication/runtime scope | Reads a source snapshot; sends an exact confirmed draft through `PublishAdapterV1` | Website/Admin databases, private models, provider state, credentials, and their workflow authority. |
| Horace Website | Its downstream resource and implementation | Its own resource only | Receives a versioned idempotent request; returns a normalized result | Press workflow stage, source content/path, Press persistence, or confirmation authority. |
| Horace Website Admin | Website administration through Website-owned contracts | Its own administration scope only | No direct Press boundary in v1 | Press records, sessions/models, workflow mutation, or publication confirmation authority. |

No cross-project shared mutable state, persistence, private schema, ORM, hidden identifier, or implicit authority is permitted. Versioned ports carry explicit identifiers, hashes, correlation, and supported contract versions; unknown versions fail closed.

## Repository layers and dependency direction

| Physical module/layer | Responsibility | Allowed dependencies |
| --- | --- | --- |
| `src/domain/` | Entities, values, immutable evidence validation, pure workflow invariants and transitions | Standard-library/pure utilities only; never UI, Obsidian, adapters, agents, providers, or infrastructure. |
| `src/contracts/` | Versioned boundary DTOs and fail-closed envelope validation | Domain value semantics where required; never concrete Website/Admin/client schemas. |
| `src/application/` | Future use-case command shaping, orchestration, and persistence-boundary coordination | Domain and contracts, then declared ports only. It must invoke—not recreate—the canonical validators and transition authority. |
| Future adapters / infrastructure | Storage, filesystem intake, and publish/provider boundary implementations behind approved ports | Application, contracts, and domain; may not own stages, confirmations, or business recovery. |
| Future agents | Generation, validation, and repair capability adapters | Application ports only; outputs are untrusted evidence, never workflow state or external-write authority. |
| `src/ui/` and Obsidian composition | Commands, presentation, and explicit user interaction | Application commands only; visible controls never authorize or mutate state directly. |
| `tests/` | Deterministic contract and future layer-specific evidence | Canonical modules under test; fixtures do not become a second business-rule source. |

Dependency direction is inward: UI, agents, and adapters depend on application ports; application depends on domain/contracts; domain does not depend outward. Forbidden imports include domain-to-UI/Obsidian/provider/infrastructure imports, adapters or agents importing state mutation authority other than the canonical application/domain path, and any Website/Admin private schema import. [ADR 0005](adr/0005-repository-layer-boundaries.md) records this repository-local mapping without requiring a cosmetic refactor.

### Existing non-canonical scaffold

Tracked `src/domain/publication.ts`, `src/application/publication-queue.ts`, and `src/main.ts` are pre-foundation pending-queue scaffold/legacy mapping. They are not canonical authority, are not evidence for this architecture, and require future Phase 1 reconciliation only. This index neither edits nor maps untracked later-phase product work into the Phase 0 design.

## Human gates and safe failures

The [state machine](domain/PUBLICATION_STATE_MACHINE.md) is the sole authority for the detailed commands and effects.

| Gate or failure | Required safe boundary |
| --- | --- |
| Review | A human examines the exact validated draft in `in_review`; review is not approval or publication. |
| Approval | Immutable decision pinned to the exact draft reaches `approved`; it is not confirmation. |
| Confirmation | Explicit human authorization of the exact approved draft and destination reaches `publish_ready`; preview is not publication. |
| Publication | Only a pin-matched successful adapter result reaches `published` and creates one immutable `PublishedRecord`. |
| Processing failure or exhausted repair/regeneration | Preserve failure evidence and move to `needs_human_intervention`; maximums remain two repairs and one regeneration. |
| Publication failure | Preserve a failed attempt, move to `publication_failed`, never restart generation implicitly, then require fresh confirmation or explicit escalation. |
| Source revision | Append an immutable signal; it never rewrites a historical `PublishedRecord` and invokes the state-machine intervention rule for pre-publication work. |

## BAP-5 acceptance mapping

| Acceptance requirement | Evidence |
| --- | --- |
| BAP-9, BAP-10, and BAP-11 are complete and mutually consistent | Prerequisite table and their linked canonical contracts. |
| One-primary-owner and write authority are explicit | `AGENTS.md` and [Agent routing](AGENT_ROUTING.md). |
| Environment/config fails closed | [Development environment](DEVELOPMENT_ENVIRONMENT.md) and `config/environment-contract.json`. |
| Core contracts have validation mapping | [Test strategy](TEST_STRATEGY.md), `npm run test:contracts`, and `npm run validate`. |
| Module ownership, dependency direction, and forbidden crossings are explicit | Repository layer map and [ADR 0005](adr/0005-repository-layer-boundaries.md). |
| System responsibilities, failures, human intervention, and independent integration are explicit | System matrix, human-gate map, and the BAP-9/BAP-10/BAP-11 normative authorities. |
| Architecture decisions remain traceable | [ADR registry](adr/README.md), including ADRs 0001–0005. |

## Scope boundary

Phase 0 freezes contracts, validation, and topology. It does not implement a pending queue, processing orchestrator, durable runtime, review workspace, concrete Website/Admin adapter, provider/credential integration, or external publication. Git lifecycle and release governance are separate Phase 0 work under BAP-37–40. BAP-5 completion does not start Phase 1; Phase 1 remains blocked until Git Governance and the separate BAP-43 Foundation Exit Gate pass.
