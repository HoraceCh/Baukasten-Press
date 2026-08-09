# Publication domain contract

This is the Phase 0 canonical domain vocabulary. It is an in-memory, ORM-independent contract; it defines neither persistence layout nor workflow transition rules. BAP-10 owns the latter.

`PublicationItem` is the only mutable aggregate. It holds the current source and draft pointers plus a transition-neutral `stage`. Every other record is immutable, append-only evidence: `SourceNoteRef`, `ProcessingAttempt`, `PublicDraft`, `ReviewDecision`, `PublishAttempt`, `PublishedRecord`, and `SourceRevisionSignal`.

The source vault owns the note. Baukasten Press owns only an immutable captured `SourceNoteRef`; its path is a locator, not identity. Baukasten Press also owns all application-generated opaque IDs, correlation IDs, versions, relationships, review evidence, attempt evidence, and publication records. Humans supply review and confirmation inputs, while an external destination owns its resource. Providers and agents own no workflow state.

All related records carry the item correlation ID. Timestamps are application-clock UTC ISO strings. Content and receipts use lowercase 64-character SHA-256 hashes over exact UTF-8 data; the validator recomputes source and draft content hashes with Web Crypto. Source, draft, and attempt/signal sequences are positive and contiguous per item. A draft pins an immutable source reference; processing drafts pin a produced processing attempt, and human drafts pin their parent draft. Review decisions pin draft ID, version, and content hash. A publish attempt pins an approved exact-draft review decision and explicit human confirmation. A successful attempt has one matching immutable `PublishedRecord`, including the draft's exact source reference; failed attempts have none.

Failures are evidence, not replacement state: any number of failed processing or publication attempts may precede success. A source revision signal is likewise an immutable observation. It cannot mutate an existing `PublishedRecord`, including when detected after publication.

Persistence-only concerns are outside the domain types: schema versions, row keys, indexes, collection names, ORM relations, migrations, locks, leases, caches, and serialization details. The graph validator in `src/domain/publication-contract.ts` fails closed for broken identities, ownership/correlation, hashes/timestamps, contiguity, draft chains, review pins, confirmation/publish evidence, and record evidence.
