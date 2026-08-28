# Development environment contract

`config/environment-contract.json` is the sole authority for the Phase 0 environment contract. `config/environment.example.json` is an exact two-key selector for the `local` profile; it is not a local override mechanism and cannot carry environment values.

Run `npm run validate:environment` before changing the governed development baseline. The validator is read-only and fails closed. It checks the repository identity, locked toolchain, lockfile resolution, and ignored runtime locations without installing packages, changing Git state, writing files, reading secrets, or contacting a provider, vault, publisher, or external production system.

The contract deliberately has no configurable environment variables, secrets, defaults, or optional values. `BAUKASTEN_PRESS_*` environment variables are rejected even when empty. `local` governs local development, `test` governs isolated validation, and `production-like` governs boundary rehearsal. All three profiles deny provider, publication, credential, network, vault, and external-production-write capabilities; profile visibility never grants authority.

The local repository root remains mandatory and is explicitly pinned per platform: Windows uses `F:\Projects\Baukasten Press`, while Linux/WSL uses `/home/legion/projects/Baukasten-Press`. The validator selects only the root for the actual runtime platform; unknown platforms fail closed. A GitHub-hosted pull-request runner may use its checked-out workspace only when the contract's exact CI identity metadata, canonical origin, clean worktree, script-derived root, current directory, and Git top-level all agree. That metadata identifies the execution environment only; it grants no provider, credential, network, publication, vault, or repository-write authority. Dependency hydration and pinned action setup in that runner are ephemeral delivery bootstrap, not application capability.

The project may persist plugin runtime data only through the later approved plugin boundary in the ignored `data.json` location. Build artifacts and local dependency/cache directories are likewise ignored exactly as listed by the environment contract. They are not sources of truth and must not be committed. Other persistent, generated, temporary, or cache locations require an explicit future contract.

The validator enforces the canonical JSON authority. This document intentionally does not repeat version literals, package versions, or ignore patterns: read `config/environment-contract.json` for the exact contract facts. `package-lock.json` remains the sole dependency-resolution record; it is not an environment configuration file.

## Governed WSL mutation evidence

For a governed WSL mutation, the implementation mutation owner must be identifiable as `press_app_implementer`, and independent QA must prove its effective read-only sandbox. Governed staging, cached evidence, and commits use RTK transport. `bp_git_commit` is a non-default, narrow operation; it does not grant delivery or network authority. Push and pull-request actions remain separately authorized.

## BP WSL Codex Execution Plane

`bp-codex-exec`, a user/runtime launcher outside this repository, is the canonical BP WSL Codex Execution Plane entrypoint. It starts Codex with `features.apps=false`; ordinary `codex` is not the canonical entrypoint. The Execution Plane must expose no usable Linear authority. `codex mcp list` alone cannot prove that absence because Apps and connectors are a separate surface; actual runtime tool exposure is authoritative. If launcher, isolation, repository identity, or worktree admission cannot be established, the plane fails closed.

Inspection and QA run read-only by default; workspace-write requires fresh Issue mutation authority. The launcher grants no Git metadata, delivery, provider, publication, vault, credential, or external authority, and the Execution Plane returns evidence only. The Trusted Governance Plane persists Linear evidence and owns status transitions.
