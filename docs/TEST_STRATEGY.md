# Test strategy

This is the Phase 0 test authority. It verifies the contracts already owned by BAP-9, BAP-10, BAP-11, and BAP-41; it does not define a second workflow, an orchestration runtime, a provider, or a publication destination.

## Deterministic contract suite

`npm run test:contracts` is the only Phase 0 contract-suite entry point. It accepts no arguments, bundles exactly these tracked TypeScript suites with the locked `esbuild` into the ignored `.npm-cache/contract-tests/` directory, then invokes each suite through Node's built-in test runner with a fixed executable, fixed working directory, empty constructed environment, and Node permission mode:

| Suite | Contract mapped | Required proof |
| --- | --- | --- |
| `tests/publication-domain-contract.test.ts` | BAP-9 domain graph | immutable IDs, hashes, versions, timestamps, relationships, retained failures, and immutable published history |
| `tests/publication-state-machine.test.ts` | BAP-10 transition authority | every legal transition, illegal-transition failure without effects, budgets (two repairs and one regeneration), confirmation, idempotency, recovery, and source-revision handling |
| `tests/integration-contracts.test.ts` | BAP-11 integration ports | source read-only capture, exact pins and versions, normalized adapters, deterministic receipts, idempotency, and safe failures |
| `tests/publication-queue.test.ts` | BAP-12 queue application | canonical enqueue/migration, explicit batch selection, BAP-10 transitions, persistence atomicity, and replay behavior |
| `tests/environment-contract.test.mjs` | BAP-41 environment | repository/toolchain/config authority, exact profiles, ignored runtime paths, and fail-closed configuration |

The suite uses no glob, test-directory scan, caller argument, inherited environment, provider stub, credential, network capability, child-process capability, worker capability, native addon capability, filesystem-write permission, vault access, or publication write. The bundling step may write only its ignored cache directory. Test execution receives read access only to the repository root. A failure prints only a fixed stage code and exits nonzero; it does not print environment values, source content, raw adapter output, or stack traces.

Fixtures use literal stable IDs, fixed UTC timestamps, known hashes, and in-process fake boundary values. Clocks, random IDs, network, credentials, a vault, a Website/Admin instance, and a real publishing adapter are forbidden. A fake may model only a versioned request/result envelope or a normalized failure; it cannot mutate workflow state or perform an external write.

## Test layers and handoffs

| Layer | Owner and responsibility | Non-duplication and handoff |
| --- | --- | --- |
| Unit | Future implementation owns a single pure module's local calculations and error handling. | Unit tests do not restate domain invariants; they hand valid values to the BAP-9 graph validator or BAP-10 transition authority. |
| Domain contract | BAP-9 owns immutable entity graph validity in `tests/publication-domain-contract.test.ts`. | The graph validator is singular truth for entity relationships, hashes, versions, and retained evidence; callers consume its result rather than copy its rules. |
| State transition | BAP-10 owns legal/illegal workflow behavior in `tests/publication-state-machine.test.ts`. | `transitionPublication` is singular truth for stage, budget, audit, idempotency, and recovery effects; application code supplies commands and persists accepted evidence only. |
| Application contract | Future application implementation owns port orchestration, command shaping, and persistence-boundary behavior. | It must call BAP-9/BAP-10/BAP-11 canonical contracts and prove it cannot bypass them; it does not reimplement stage or entity validation. |
| Integration boundary | BAP-11 owns versioned source and publish envelope validation in `tests/integration-contracts.test.ts`. | Adapters normalize inputs/results to the port and hand them to the application/transition authority; they never own workflow state or external-write permission. |
| Regression | The issue that fixes a previously accepted defect owns a minimal deterministic reproduction. | A regression belongs beside the canonical layer it protects and references that layer's validator/authority; it must not create a parallel business-rule fixture or snapshot truth. |

Each handoff is explicit: unit and adapter evidence feed application contracts; application commands feed the state authority; accepted state/evidence must remain valid under the domain graph; integration envelopes remain versioned at their boundary. The layers are complementary checks, not alternative sources of publication behavior.

## Test files, fixtures, and snapshots

Canonical contract tests live directly in `tests/` as `<contract-name>.test.ts` (or `.test.mjs` for the dependency-free environment contract). A future test file follows `<module-or-boundary>.test.ts`; it names its local factory by the entity or request it creates, keeps fixed values adjacent to that factory, and does not import user-created tests or generated cache output. A fixture belongs to the test that owns its deterministic scenario unless two tests within the same canonical layer require an identical immutable value; only then may that layer introduce a narrowly named fixture module.

Fixture ownership includes stable IDs, fixed UTC clock values, deterministic hashes, and normalized fake envelopes. Factories must expose every material pin needed by the scenario and keep invalid mutations visible in the test, rather than hiding them behind a permissive builder. Fixtures cannot contain credentials, source-note content, vault paths, raw provider payloads, or live destination data.

Snapshots are exceptional: do not snapshot workflow state, adapter responses, source content, or generated cache output. A snapshot may cover a small stable presentation-free canonical serialization only when direct assertions would obscure the invariant; it must be reviewed as source, have a deterministic name, and be stored beside its owning test. Snapshot updates require the same contract review as a code change and never substitute for allow/deny assertions.

## Required behavior coverage

The contract matrix is allow-and-deny based. Each BAP-10 legal transition has an acceptance test; every unlisted stage transition and malformed pin must fail closed without mutating state. The suite specifically proves that repair is capped at two, regeneration at one, publish failure never restarts generation, duplicate operation IDs require byte-equivalent payloads, retry evidence never grants a retry, and source revision after publication does not rewrite a `PublishedRecord`.

The BAP-9 graph suite requires sequence continuity and retains failed processing/publish attempts as history before success. The BAP-11 suite requires identical request replay semantics, rejects unpinned or unsupported payloads, and verifies receipt canonicalization. These deterministic checks are the Phase 0 minimum for idempotency, recovery, retry safety, and historical preservation.

Future application work must add deterministic fixtures and an explicit allow/deny test whenever it introduces a new transition command, port version, recovery behavior, persistence boundary, or UI command. Application tests may call the canonical validators and transition authority, but must not duplicate their business rules. Integration, UI, provider, queue, and real destination tests remain future authorized work.

## Validation gates and evidence

`npm run validate` is the unified local and future PR validation input. Its fixed order is environment validation, agent governance validation, Git safety validation, deterministic contract tests, type checking, linting, and production build. A failed stage stops the command and is evidence of a failed gate; a successful run reports only the standard tool output and `Contract tests passed.`

Future PR validation consumes this command without broadening its permissions. Release review consumes the resulting command exit status, committed diff, and the known contract-suite mapping; it must remain read-only. No Phase 0 test result is evidence that a vault, Website, Admin, provider, credential store, queue, or publication destination was contacted.

`.npm-cache/contract-tests/` is generated, ignored evidence only. It is neither a fixture source nor a committed artifact. The canonical tests and this document are the reviewable source of truth.
