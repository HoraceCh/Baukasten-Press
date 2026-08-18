# Git safety and commit contract

`config/git-safety-contract.json` is the sole machine-readable authority for Git command safety. Repository identity remains owned by `config/environment-contract.json`; this contract does not create repository, delivery, vault, provider, credential, publication, or external-write authority.

The contract is active after the BAP-38 commit. Until that commit is made, the previously committed governance controls the BAP-38 focused commit itself.

## Command classes

Only the recognized read-only forms in the contract may be used without mutation authority. They must be transported through `rtk`; aliases, wrappers, evaluators, `GIT_*` environment overrides, `git -C`, `--git-dir`, `--work-tree`, and `git -c` are not authority-preserving forms and fail closed.

Implementation mutation is limited to `git add <exact-relative-path>` or `git add -p <exact-relative-path>` and `git commit -m <Conventional Commit subject>`. It requires a live BAP issue, explicit operation authority, `press_app_implementer` as the write owner, an exact reviewed path allowlist, preservation of unrelated work, focused validation, independent QA, cached name/status/stat/check/full-diff evidence, and post-commit Linear evidence. Broad staging, globs, absolute paths, `..`, ignored outputs, intent-to-add, low-level index/object operations, and path commits are denied.

Commit commands fail closed when they use `-a`/`--all`, amend, no-verify, allow-empty, fixup/squash, signing, message reuse, or an evaluator. A Conventional Commit subject must carry the live BAP issue in its body or the completion evidence; the focused commit subject remains concise.

Delivery mutation is separately human-authorized, operation-specific work. It includes push, remote-branch, pull-request, ruleset, and branch-protection operations; direct-main delivery is denied. BAP-39 supplies its own checks and does not inherit delivery authority from this document.

Destructive/history-rewriting and repository-topology commands are prohibited, including reset, clean, restore, checkout, stash, rebase, cherry-pick, force/history filters, rm/mv, ref/object mutation, reflog/gc/prune, init/clone, submodule, and worktree commands. A blocked or ambiguous command must not be substituted with a wrapper or script.

## Indirect callers and validation

`npm` scripts are audited as indirect Git callers. Lifecycle scripts may not invoke Git. The only version helper is `version:files`, which runs `version-bump.mjs` and does not stage files; its output must be reviewed and staged through the implementation-mutation gate. The environment validator and Git-safety validator make only read-only project-repository queries. The Git-safety test may use a disposable `.npm-cache/git-safety-fixtures` repository with literal `execFile` arguments, `shell: false`, a sanitized environment, local fixture identity, and verified cleanup; it never mutates or performs delivery against the project repository.

Run `npm run validate:git-safety` and the unified `npm run validate` before a governed focused commit. These checks are evidence, not authority. Specialists, QA, release review, Agent registration, UI visibility, and Linear issue access are read-only or routing roles unless a current task grants the exact operation authority.
