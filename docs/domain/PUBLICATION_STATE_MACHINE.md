# Publication state-machine contract

`transitionPublication` is the sole state-transition authority. It is pure: callers persist its returned aggregate and immutable evidence, but no agent, provider, UI, queue, or adapter can change a stage directly.

Canonical stages are `pending`, `selected`, `processing`, `validating`, `repairing`, `review_ready`, `in_review`, `approved`, `publish_ready`, `publishing`, `published`, `publication_failed`, and `needs_human_intervention`. The legacy words `production`, `human-review`, `publish-confirmation`, and `pending-publish` are non-authoritative and non-lossless; they must not be mapped back into this contract.

Each input has a unique trigger ID, item ID, correlation ID, expected item version, actor, UTC timestamp, and relevant immutable pins. A byte-equivalent duplicate returns its saved result without state or evidence changes; reuse with different data is a conflict. Item/correlation/version/pin/operation/budget failures fail closed without effects. Every accepted input increments item version, sets `updatedAt`, preserves correlation, and appends an immutable audit record with versions, pins, budgets, actor, timestamp, and result evidence.

Validation is structured evidence (`draftId`, draft version/hash, pass/fail, code, summary), and must pin the actual current draft. Review can begin only after an exact passing validation. Approvals and requested changes are immutable `ReviewDecision` records pinned to that same exact draft. Active operations retain their kind and pins; publish completion must exactly match the active approval, confirmation, destination contract, draft, and receipt. Receipt fingerprints use recursive canonical serialization, so a nested payload change is a duplicate-ID conflict; accepted duplicates return the current aggregate without replaying historical state. Source signals must be contiguous and exactly preserve the configured source baseline path/hash/ref and valid observation shape.

| From | Trigger | To | Required effect |
| --- | --- | --- | --- |
| pending | select_publication | selected | selection evidence |
| selected | start_generation | processing | unique active operation |
| processing | processing_produced | validating | append produced attempt and draft; set current draft |
| processing | processing_failed | needs_human_intervention | append failed attempt |
| validating | validation_passed | review_ready | validation evidence |
| validating | validation_failed | repairing / intervention | choose repair, then regeneration, else intervene |
| repairing | start_repair / start_regeneration | processing | consume the selected budget; activate operation |
| review_ready | begin_review | in_review | review begins |
| in_review | approve_review | approved | append exact current-draft approval |
| in_review | submit_human_revision | validating | append human draft; invalidate approval/confirmation |
| in_review | request_changes | repairing / intervention | choose recovery or intervene |
| approved | revise_approved_draft | validating | append draft; invalidate authority |
| approved | confirm_publication | publish_ready | pin exact approval, destination contract, explicit human confirmation |
| publish_ready | revise_confirmed_draft | validating | append draft; invalidate authority |
| publish_ready | start_publish | publishing | exact pins and one active operation |
| publishing | publish_succeeded | published | append attempt and exactly one immutable PublishedRecord |
| publishing | publish_failed | publication_failed | append failed attempt; never restart generation |
| publication_failed | reconfirm_publication | publish_ready | fresh human confirmation of exact approved draft/destination |
| publication_failed | escalate_publication_failure | needs_human_intervention | intervention evidence |
| needs_human_intervention | submit_human_revision | validating | only when a current draft exists |

No other stage transition is legal. `published` has no outgoing stage transition. Repairing is recovery chosen but not yet started; `approved` is not confirmation; `publish_ready` pins approval, destination contract, and explicit confirmation. Budgets are maximum two repairs and one regeneration.

`observe_source_revision` appends a `SourceRevisionSignal`; it is an observation, never a stage. It moves all pre-publication stages (including `publication_failed`) to `needs_human_intervention`, leaves `needs_human_intervention` unchanged, leaves `publishing` unchanged because cancellation cannot be assumed, and leaves `published` unchanged. It never mutates a historical `PublishedRecord`.
