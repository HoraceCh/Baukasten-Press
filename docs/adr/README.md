# Architecture decision records

ADRs preserve decisions whose consequences cross Baukasten Press boundaries. Use permanent four-digit, monotonic filenames: `NNNN-kebab-case.md`; numbers are never reused. Status is `Proposed`, `Accepted`, `Deprecated`, or `Superseded`.

An Accepted ADR is not substantively rewritten. Replace it with a new ADR that links both ways through `Supersedes` / `Superseded by`. The relevant specialist settles a decision, the implementer records it, and independent QA verifies the retained evidence.

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-cross-project-ownership-boundary.md) | Accepted | Cross-project ownership boundary |
| [0002](0002-state-machine-authority.md) | Accepted | Deterministic workflow state authority |
| [0003](0003-successful-record-immutability.md) | Accepted | Immutable successful publication records |
| [0004](0004-publish-adapter-isolation.md) | Accepted | Versioned publish adapter isolation |
| [0005](0005-repository-layer-boundaries.md) | Accepted | Repository layer boundaries |
