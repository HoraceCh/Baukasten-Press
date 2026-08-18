# Development environment contract

`config/environment-contract.json` is the sole authority for the Phase 0 environment contract. `config/environment.example.json` is an exact two-key selector for the `local` profile; it is not a local override mechanism and cannot carry environment values.

Run `npm run validate:environment` before changing the governed development baseline. The validator is read-only and fails closed. It checks the repository identity, locked toolchain, lockfile resolution, and ignored runtime locations without installing packages, changing Git state, writing files, reading secrets, or contacting a provider, vault, publisher, or external production system.

The contract deliberately has no configurable environment variables, secrets, defaults, or optional values. `BAUKASTEN_PRESS_*` environment variables are rejected even when empty. `local` governs local development, `test` governs isolated validation, and `production-like` governs boundary rehearsal. All three profiles deny provider, publication, credential, network, vault, and external-production-write capabilities; profile visibility never grants authority.

The project may persist plugin runtime data only through the later approved plugin boundary in the ignored `data.json` location. Build artifacts and local dependency/cache directories are likewise ignored exactly as listed by the environment contract. They are not sources of truth and must not be committed. Other persistent, generated, temporary, or cache locations require an explicit future contract.

The validator enforces the canonical JSON authority. This document intentionally does not repeat version literals, repository paths, package versions, or ignore patterns: read `config/environment-contract.json` for those exact facts. `package-lock.json` remains the sole dependency-resolution record; it is not an environment configuration file.
