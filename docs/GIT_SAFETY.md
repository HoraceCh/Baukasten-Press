# Git safety and commit contract

`config/git-safety-contract.json` is the sole machine-readable authority for Git command safety. Repository identity remains owned by `config/environment-contract.json`; this contract does not create repository, delivery, vault, provider, credential, publication, or external-write authority.

The contract is active after the BAP-38 commit. Until that commit is made, the previously committed governance controls the BAP-38 focused commit itself.

## Command classes

Only the recognized read-only forms in the contract may be used without mutation authority. They must be transported through `rtk`; aliases, wrappers, evaluators, `GIT_*` environment overrides, `git -C`, `--git-dir`, `--work-tree`, and `git -c` are not authority-preserving forms and fail closed. The repository-local validator is the sole exception: after it has verified the canonical root, it invokes Git through `execFile` with `shell: false`, an empty environment, and one literal `-c safe.directory=<canonical-root>` argument. This does not inherit user Git context, apply to any other root, or grant mutation authority.

Implementation mutation is limited to `git add <exact-relative-path>` or `git add -p <exact-relative-path>` and `git commit -m <Conventional Commit subject>`. It requires a live BAP issue, explicit operation authority, `press_app_implementer` as the write owner, an exact reviewed path allowlist, preservation of unrelated work, focused validation, independent QA, cached name/status/stat/check/full-diff evidence, and post-commit Linear evidence. Broad staging, globs, absolute paths, `..`, ignored outputs, intent-to-add, low-level index/object operations, and path commits are denied.

Commit commands fail closed when they use `-a`/`--all`, amend, no-verify, allow-empty, fixup/squash, signing, message reuse, or an evaluator. A Conventional Commit subject must carry the live BAP issue in its body or the completion evidence; the focused commit subject remains concise.

Reconciliation mutation is a separate, narrowly scoped boundary. It does not inherit implementation or delivery authority and does not widen ordinary delivery. The only recognized command form is `rtk git pull --ff-only origin main`; general `pull`, a pull without `--ff-only`, another remote or branch, and every merge, rebase, reset, restore, checkout, force, or history-rewriting form remain denied.

Before that exact reconciliation command may run, `authorizeReconciliationMutation` requires a fresh evidence bundle that proves all of the following together: explicit reconciliation authority; the canonical repository root; the exact canonical HTTPS origin; branch `main`; an empty worktree and index; lowercase 40-character approved starting and target SHAs; current `HEAD` equal to the starting SHA; the live `origin/main` value equal to the target SHA; verified ancestry from the starting SHA to the target SHA; and RTK as the transport. The exact command supplies the fast-forward-only, `origin`, and `main` facts. A missing, malformed, stale, or contradictory fact returns `RECONCILIATION_AUTHORIZATION_REQUIRED`. Delivery authority cannot substitute for reconciliation authority, and reconciliation authority cannot authorize delivery.

The evidence collector must obtain repository identity, origin, branch, cleanliness, current `HEAD`, the live `origin/main` target, and ancestry through separately approved, literal RTK forms. The two additional read-only forms are exact: `rtk git ls-remote --heads origin refs/heads/main` for the live target and `rtk git merge-base --is-ancestor <starting-sha> <target-sha>` for ancestry, with both placeholders replaced by lowercase 40-character SHAs. Passing values into the authorization function records those verified facts; it is not permission to infer or synthesize them. The authorized target must be rechecked immediately before the exact reconciliation command so a changed remote target fails closed.

Delivery mutation is separately human-authorized, operation-specific work. It includes push, remote-branch, pull-request, ruleset, and branch-protection operations; direct-main delivery is denied. BAP-39 supplies its own checks and does not inherit delivery or reconciliation authority from this document.

The sole pull-request workflow is validated as an exact, pinned, least-privilege delivery surface. Its GitHub-hosted execution metadata is environment identity only: it does not widen Git, provider, credential, network, publication, vault, or external-write authority. Package installation and action setup there are ephemeral validation bootstrap, not a second authority or validation truth source.

Destructive/history-rewriting and repository-topology commands are prohibited, including reset, clean, restore, checkout, stash, rebase, cherry-pick, force/history filters, rm/mv, ref/object mutation, reflog/gc/prune, init/clone, submodule, and worktree commands. A blocked or ambiguous command must not be substituted with a wrapper or script.

## Target-object preparation before reconciliation

A stale checkout can discover the live canonical target while lacking that commit object locally. It must not attempt ancestry until a separately authorized preparation has acquired the exact approved object. Preparation is neither read-only nor reconciliation nor delivery: `reconciliationPreparationMutation` is the sole command class for `rtk git fetch --no-tags --no-write-fetch-head origin <target-sha>`, where `<target-sha>` is a lowercase full 40-character SHA. It cannot fetch a ref, update a ref, fetch tags, prune, force, select another remote, or use a general fetch form.

`authorizeReconciliationPreparationMutation` fails closed unless explicit preparation authority, canonical root, canonical HTTPS origin, branch `main`, a clean worktree and index, approved lowercase starting and target SHAs, `HEAD` equal to the starting SHA, and a freshly read live `origin/main` equal to the approved target are all proved with RTK/literal transport. Delivery and reconciliation authority cannot substitute for preparation authority, and preparation authority cannot authorize either final reconciliation or delivery.

Immediately after the exact fetch, `authorizeReconciliationPreparationPostcondition` must prove that the target object exists; `HEAD`, branch, worktree, index, refs, and `FETCH_HEAD` are unchanged; a fresh live `origin/main` read still equals the approved target; and literal `merge-base --is-ancestor <starting-sha> <target-sha>` now passes. If the remote moved, possession of the older object is insufficient and the process stops without silently upgrading to the new target. Only this successful postcondition permits the separate BAP-77 `rtk git pull --ff-only origin main` authorization to be evaluated.

The Git-safety test uses only disposable operating-system temporary repositories, local bare remotes, sanitized `execFile` argument arrays, and verified cleanup to reproduce this condition. It performs no project-repository fetch or mutation and is designed without POSIX shell syntax for later native-Windows acceptance.

## Indirect callers and validation

`npm` scripts are audited as indirect Git callers. Lifecycle scripts may not invoke Git. The only version helper is `version:files`, which runs `version-bump.mjs` and does not stage files; its output must be reviewed and staged through the implementation-mutation gate. The environment validator and Git-safety validator make only read-only project-repository queries. The Git-safety test may use a disposable operating-system temporary repository with literal `execFile` arguments, `shell: false`, a sanitized environment, local fixture identity, and verified cleanup; it never mutates or performs delivery against the project repository.

Run `npm run validate:git-safety` and the unified `npm run validate` before a governed focused commit. These checks are evidence, not authority. Specialists, QA, release review, Agent registration, UI visibility, and Linear issue access are read-only or routing roles unless a current task grants the exact operation authority.
