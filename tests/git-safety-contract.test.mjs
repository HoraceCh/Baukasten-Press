import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { auditIndirectCallers, auditPackageScripts, auditPrValidationWorkflow, auditRepository, authorizeDeliveryMutation, authorizeImplementationMutation, authorizeReconciliationMutation, authorizeReconciliationPreparationMutation, authorizeReconciliationPreparationPostcondition, canonicalValidatorGitArguments, classifyGitArguments, policyPath, repositoryRoot, validateExactRelativePath, validatePolicy } from '../scripts/validate-git-safety.mjs';
import { parseStrictJson } from '../scripts/validate-environment.mjs';

const executeFile = promisify(execFile);
const policy = parseStrictJson(await readFile(policyPath, 'utf8'));
const packageText = await readFile(path.join(repositoryRoot, 'package.json'), 'utf8');
const opencodeText = await readFile(path.join(repositoryRoot, 'opencode.jsonc'), 'utf8');
const manifest = parseStrictJson(packageText);
const exactNpmRun = async (command, argumentsList) => {
	assert.equal(command, 'npm'); assert.deepEqual(argumentsList, ['--version']); return '11.19.1';
};

async function createDisposableGitFixture({ gitExecutor = executeFile } = {}) {
	const disposableRoot = await mkdtemp(path.join(tmpdir(), 'bap-78-git-safety-'));
	const canonicalDisposableRoot = await realpath(disposableRoot);
	const fixtureEnvironment = { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '' };
	const runGit = async (cwd, argumentsList) => {
		const canonicalCwd = await realpath(cwd);
		const confined = canonicalCwd === canonicalDisposableRoot || canonicalCwd.startsWith(`${canonicalDisposableRoot}${path.sep}`);
		if (!confined) throw new Error('FIXTURE_CWD_OUTSIDE_DISPOSABLE_ROOT');
		return gitExecutor('git', argumentsList, { cwd: canonicalCwd, shell: false, env: fixtureEnvironment });
	};
	return Object.freeze({ root: canonicalDisposableRoot, runGit, cleanup: () => rm(canonicalDisposableRoot, { recursive: true, force: true }) });
}

test('policy is exact, strict, and recognizes only the safe command forms', () => {
	assert.equal(validatePolicy(policy), null);
	assert.throws(() => parseStrictJson('{"contractVersion":"1.0","contractVersion":"1.0"}'));
	assert.throws(() => parseStrictJson('{"contract\\u0056ersion":"1.0"}'));
	assert.equal(validatePolicy({ ...policy, transport: 'git' }), 'POLICY_INVALID');
	assert.equal(validatePolicy({ ...policy, extra: true }), 'POLICY_INVALID');
	for (const command of [['status'], ['status', '--short'], ['diff'], ['diff', '--check'], ['diff', '--cached'], ['diff', '--cached', '--check'], ['diff', '--cached', '--name-status'], ['diff', '--cached', '--stat'], ['log', '-1'], ['show', 'HEAD'], ['rev-parse', '--show-toplevel'], ['rev-parse', 'HEAD'], ['config', '--get', 'remote.origin.url'], ['ls-files'], ['grep', 'BAP-38'], ['branch', '--show-current'], ['remote', 'get-url', 'origin'], ['ls-remote', '--heads', 'origin', 'refs/heads/main'], ['merge-base', '--is-ancestor', '1'.repeat(40), '2'.repeat(40)]]) assert.equal(classifyGitArguments(command), 'read-only');
	assert.equal(classifyGitArguments(['add', 'docs/GIT_SAFETY.md']), 'implementation-mutation');
	assert.equal(classifyGitArguments(['add', '-p', 'docs/GIT_SAFETY.md']), 'implementation-mutation');
	assert.equal(classifyGitArguments(['commit', '-m', 'docs(git): define safety contract']), 'implementation-mutation');
	assert.equal(classifyGitArguments(['fetch', '--no-tags', '--no-write-fetch-head', 'origin', '1'.repeat(40)]), 'reconciliation-preparation-mutation');
	assert.equal(classifyGitArguments(['pull', '--ff-only', 'origin', 'main']), 'reconciliation-mutation');
	assert.equal(classifyGitArguments(['push']), 'delivery-mutation');
	assert.equal(classifyGitArguments(['branch', 'topic']), 'delivery-mutation');
});

test('validator Git context permits only the canonical repository with a literal safe-directory argument', () => {
	assert.deepEqual(canonicalValidatorGitArguments(repositoryRoot, ['ls-files']), ['-c', `safe.directory=${path.resolve(repositoryRoot)}`, 'ls-files']);
	assert.throws(() => canonicalValidatorGitArguments(path.join(repositoryRoot, 'unrelated-repository'), ['ls-files']));
	assert.throws(() => canonicalValidatorGitArguments(repositoryRoot, ['ls-files', '']));
});

test('validator fails closed when its isolated Git context cannot execute', async () => {
	const result = await auditRepository({ npmRun: exactNpmRun, run: async () => {
		const error = new Error('isolated Git execution failed');
		error.code = 'EPERM';
		throw error;
	} });
	assert.equal(result, 'COMMAND_FAILED');
});

test('paths and mutation/evaluator/history forms fail closed', () => {
	for (const pathname of ['', '.', 'docs', '.agents', '.codex', '.serena', '.github', '../README.md', 'C:/outside', '-u', '--update', '--renormalize', ':(top)README.md', ':!README.md', ':^README.md', '.vscode/a.json', '.idea/a.xml', 'a.iml', '.npm-cache/x', 'node_modules/x.js', 'data.json', 'main.js', 'main.js.map', '.DS_Store', 'Thumbs.db', 'docs/*.md', 'docs//a.md', 'docs\\a.md']) assert.equal(validateExactRelativePath(pathname), false);
	assert.equal(validateExactRelativePath('.github/workflows/validate.yml'), true);
	assert.equal(validateExactRelativePath('.agents/skills/baukasten-press-ui/SKILL.md'), true);
	assert.equal(validateExactRelativePath('.codex/config.toml'), true);
	for (const command of [['add', '.'], ['add', 'docs'], ['add', '-u'], ['add', '--update'], ['add', '--renormalize'], ['add', ':(top)README.md'], ['add', '--all'], ['add', '-N', 'docs/x.md'], ['commit', '-a', '-m', 'x'], ['commit', '--amend'], ['commit', '--no-verify', '-m', 'x'], ['commit', '-m', 'not conventional'], ['commit', '-m', 'x', 'docs/a.md'], ['diff', '--output=x'], ['diff', '--ext-diff'], ['diff', '--no-index', 'a', 'b'], ['show', '--textconv', 'HEAD'], ['status', '--porcelain=v2'], ['grep', '--cached', 'BAP'], ['ls-remote', 'origin'], ['ls-remote', '--heads', 'upstream', 'refs/heads/main'], ['merge-base', '--is-ancestor', 'HEAD', 'origin/main'], ['fetch'], ['fetch', 'origin', 'refs/heads/main'], ['fetch', '--no-tags', '--no-write-fetch-head', 'upstream', '1'.repeat(40)], ['fetch', '--no-tags', '--no-write-fetch-head', 'origin', 'A'.repeat(40)], ['fetch', '--tags', '--no-write-fetch-head', 'origin', '1'.repeat(40)], ['fetch', '--no-tags', '--prune', 'origin', '1'.repeat(40)], ['fetch', '--no-tags', '--no-write-fetch-head', '--force', 'origin', '1'.repeat(40)], ['fetch', '--no-tags', '--no-write-fetch-head', 'origin', 'refs/heads/main:refs/remotes/origin/main'], ['pull'], ['pull', 'origin', 'main'], ['pull', '--ff-only', 'upstream', 'main'], ['pull', '--ff-only', 'origin', 'release'], ['pull', '--no-ff', 'origin', 'main'], ['reset', '--hard'], ['clean', '-fd'], ['restore', '.'], ['checkout', 'main'], ['rebase', 'main'], ['merge', 'origin/main'], ['cherry-pick', 'HEAD'], ['push', '--force'], ['push', '--force-with-lease'], ['push', '-f'], ['git'], ['-C', '.', 'status'], ['status', 'GIT_DIR=x'], ['config', '--global', 'alias.x', 'status']]) assert.equal(classifyGitArguments(command), 'denied');
});

test('reconciliation preparation has distinct exact authority and a fail-closed postcondition', async () => {
	const startingSha = '1'.repeat(40); const targetSha = '2'.repeat(40);
	const base = { argumentsList: ['fetch', '--no-tags', '--no-write-fetch-head', 'origin', targetSha], explicitReconciliationPreparationAuthority: true, repositoryRootEvidence: await realpath(repositoryRoot), originUrl: 'https://github.com/HoraceCh/Baukasten-Press.git', currentBranch: 'main', worktreeStatus: '', indexStatus: '', expectedStartingSha: startingSha, expectedTargetSha: targetSha, actualHeadSha: startingSha, liveOriginMainSha: targetSha, transport: 'rtk' };
	assert.equal(await authorizeReconciliationPreparationMutation(base), null);
	for (const changed of [{ explicitReconciliationPreparationAuthority: false }, { explicitReconciliationPreparationAuthority: undefined, explicitDeliveryAuthority: true }, { explicitReconciliationPreparationAuthority: undefined, explicitReconciliationAuthority: true }, { expectedStartingSha: 'A'.repeat(40) }, { expectedTargetSha: 'A'.repeat(40), liveOriginMainSha: 'A'.repeat(40) }, { actualHeadSha: targetSha }, { originUrl: 'git@github.com:HoraceCh/Baukasten-Press.git' }, { currentBranch: 'fix/bap-78' }, { worktreeStatus: ' M docs/GIT_SAFETY.md' }, { indexStatus: 'M\tdocs/GIT_SAFETY.md' }, { repositoryRootEvidence: path.join(repositoryRoot, 'docs') }, { liveOriginMainSha: '3'.repeat(40) }, { transport: 'git' }]) assert.equal(await authorizeReconciliationPreparationMutation({ ...base, ...changed }), 'RECONCILIATION_PREPARATION_AUTHORIZATION_REQUIRED');
	const proof = { expectedStartingSha: startingSha, expectedTargetSha: targetSha, targetObjectExists: true, actualHeadSha: startingSha, currentBranch: 'main', worktreeStatus: '', indexStatus: '', refsUnchanged: true, fetchHeadUnchanged: true, liveOriginMainSha: targetSha, startingShaIsAncestor: true };
	assert.equal(authorizeReconciliationPreparationPostcondition(proof), null);
	for (const changed of [{ targetObjectExists: false }, { actualHeadSha: targetSha }, { currentBranch: 'fix/bap-78' }, { worktreeStatus: ' M x' }, { indexStatus: 'M\tx' }, { refsUnchanged: false }, { fetchHeadUnchanged: false }, { liveOriginMainSha: '3'.repeat(40) }, { startingShaIsAncestor: false }]) assert.equal(authorizeReconciliationPreparationPostcondition({ ...proof, ...changed }), 'RECONCILIATION_PREPARATION_POSTCONDITION_REQUIRED');
});

test('implementation mutation requires real regular-file evidence and the entire focused-commit bundle', async () => {
	const base = { argumentsList: ['add', 'AGENTS.md'], explicitOperationAuthority: true, actor: 'press_app_implementer', issueIdentifier: 'BAP-38', ownedPaths: ['AGENTS.md'], requestedPaths: ['AGENTS.md'], unrelatedWorkPreserved: true, validationPassed: true, qaStatus: 'PASS', cachedDiffEvidence: true };
	assert.equal(await authorizeImplementationMutation(base), null);
	assert.equal(await authorizeImplementationMutation({ ...base, argumentsList: ['add', '.agents/skills/baukasten-press-ui/SKILL.md'], ownedPaths: ['.agents/skills/baukasten-press-ui/SKILL.md'], requestedPaths: ['.agents/skills/baukasten-press-ui/SKILL.md'] }), null);
	assert.equal(await authorizeImplementationMutation({ ...base, argumentsList: ['add', '.codex/config.toml'], ownedPaths: ['.codex/config.toml'], requestedPaths: ['.codex/config.toml'] }), null);
	for (const key of ['explicitOperationAuthority', 'unrelatedWorkPreserved', 'validationPassed', 'cachedDiffEvidence']) assert.equal(await authorizeImplementationMutation({ ...base, [key]: false }), 'AUTHORIZATION_INVALID');
	assert.equal(await authorizeImplementationMutation({ ...base, actor: 'qa_release_reviewer' }), 'AUTHORIZATION_INVALID');
	assert.equal(await authorizeImplementationMutation({ ...base, issueIdentifier: 'BAP-X' }), 'AUTHORIZATION_INVALID');
	assert.equal(await authorizeImplementationMutation({ ...base, ownedPaths: ['README.md'] }), 'AUTHORIZATION_INVALID');
	assert.equal(await authorizeImplementationMutation({ ...base, ownedPaths: ['docs'], requestedPaths: ['docs'], argumentsList: ['add', 'docs'] }), 'AUTHORIZATION_INVALID');
	assert.equal(await authorizeImplementationMutation({ ...base, qaStatus: 'FAIL' }), 'AUTHORIZATION_INVALID');
	assert.equal(authorizeDeliveryMutation({ argumentsList: ['push'] }), 'DELIVERY_AUTHORIZATION_REQUIRED');
	assert.equal(authorizeDeliveryMutation({ argumentsList: ['push'], explicitDeliveryAuthority: true }), null);
});

test('reconciliation is independently authorized by exact SHA-locked fast-forward evidence', async () => {
	const startingSha = '1'.repeat(40);
	const targetSha = '2'.repeat(40);
	const base = {
		argumentsList: ['pull', '--ff-only', 'origin', 'main'],
		explicitReconciliationAuthority: true,
		repositoryRootEvidence: await realpath(repositoryRoot),
		originUrl: 'https://github.com/HoraceCh/Baukasten-Press.git',
		currentBranch: 'main',
		worktreeStatus: '',
		indexStatus: '',
		expectedStartingSha: startingSha,
		expectedTargetSha: targetSha,
		actualHeadSha: startingSha,
		liveOriginMainSha: targetSha,
		startingShaIsAncestor: true,
		transport: 'rtk',
	};
	assert.equal(await authorizeReconciliationMutation(base), null);
	for (const changed of [
		{ worktreeStatus: ' M docs/GIT_SAFETY.md' },
		{ indexStatus: 'M\tdocs/GIT_SAFETY.md' },
		{ repositoryRootEvidence: path.join(repositoryRoot, 'docs') },
		{ currentBranch: 'fix/bap-77' },
		{ originUrl: 'git@github.com:HoraceCh/Baukasten-Press.git' },
		{ actualHeadSha: '3'.repeat(40) },
		{ expectedTargetSha: 'A'.repeat(40), liveOriginMainSha: 'A'.repeat(40) },
		{ liveOriginMainSha: '3'.repeat(40) },
		{ startingShaIsAncestor: false },
		{ explicitReconciliationAuthority: false },
		{ explicitReconciliationAuthority: undefined, explicitDeliveryAuthority: true },
		{ transport: 'git' },
	]) assert.equal(await authorizeReconciliationMutation({ ...base, ...changed }), 'RECONCILIATION_AUTHORIZATION_REQUIRED');
	for (const argumentsList of [['pull'], ['pull', 'origin', 'main'], ['pull', '--ff-only', 'upstream', 'main'], ['pull', '--ff-only', 'origin', 'release'], ['pull', '--no-ff', 'origin', 'main']]) assert.equal(await authorizeReconciliationMutation({ ...base, argumentsList }), 'RECONCILIATION_AUTHORIZATION_REQUIRED');
	assert.equal(authorizeDeliveryMutation({ argumentsList: base.argumentsList, explicitDeliveryAuthority: true }), 'DELIVERY_AUTHORIZATION_REQUIRED');
});

test('package has no lifecycle or hidden Git/evaluator mutation and retains the exact validator chain', () => {
	assert.equal(auditPackageScripts(manifest), null);
	for (const script of ['git add README.md', 'powershell -Command git status', `e${'val'} git status`]) {
		const changed = structuredClone(manifest); changed.scripts.demo = script;
		assert.equal(auditPackageScripts(changed), 'PACKAGE_SCRIPT_INVALID');
	}
	const lifecycle = structuredClone(manifest); lifecycle.scripts.version = 'node version-bump.mjs';
	assert.equal(auditPackageScripts(lifecycle), 'PACKAGE_SCRIPT_INVALID');
	const version = structuredClone(manifest); version.scripts['version:files'] = 'node version-bump.mjs && git add manifest.json';
	assert.equal(auditPackageScripts(version), 'PACKAGE_SCRIPT_INVALID');
});

test('the sole PR workflow is pinned, least-privilege, and rejects structural or command drift', async () => {
	assert.equal(await auditPrValidationWorkflow(), null);
	const workflowPath = path.join(repositoryRoot, '.github', 'workflows', 'pr-validation.yml');
	const workflow = await readFile(workflowPath, 'utf8');
	const readDirectory = async () => [{ name: 'pr-validation.yml', isFile: () => true }];
	for (const changed of [workflow.replace('pull_request:', 'push:'), workflow.replace('branches:\n      - main', 'branches:\n      - release'), workflow.replace('contents: read', 'contents: write'), workflow.replace('ubuntu-24.04', 'ubuntu-latest'), workflow.replace('npm ci --no-audit --no-fund', 'npm ci'), workflow.replace('npm run validate', 'npm run typecheck'), `${workflow}\n# drift\n`]) assert.equal(await auditPrValidationWorkflow({ readDirectory, readText: async () => changed }), 'POLICY_INVALID');
	assert.equal(await auditPrValidationWorkflow({ readDirectory: async () => [{ name: 'pr-validation.yml', isFile: () => true }, { name: 'other.yml', isFile: () => true }], readText: async () => workflow }), 'POLICY_INVALID');
	assert.equal(await auditPrValidationWorkflow({ readDirectory: async () => [{ name: 'pr-validation.yml', isFile: () => false }], readText: async () => workflow }), 'POLICY_INVALID');
});

test('repository audit is read-only, redacts command failures, and tolerates an unrelated dirty worktree', async () => {
	assert.equal(await auditRepository({ npmRun: exactNpmRun }), null);
	const result = await auditRepository({ npmRun: exactNpmRun, readText: async () => { throw new Error('BAP38_SECRET_NEVER_ECHO'); } });
	assert.equal(result, 'POLICY_READ_FAILED');
	const emptyConfig = { stdout: '' };
	const failedInclude = await auditRepository({ npmRun: exactNpmRun, run: async (_command, args) => {
		if (args[0] === 'config' && args[2] === '^alias\\.') { const error = new Error('BAP38_SECRET_NEVER_ECHO'); error.code = 1; throw error; }
		if (args[0] === 'config' && args[2] === '^include\\.') { const error = new Error('BAP38_SECRET_NEVER_ECHO'); error.code = 2; throw error; }
		return args[0] === 'ls-files' ? { stdout: 'version-bump.mjs' } : emptyConfig;
	} });
	assert.equal(failedInclude, 'COMMAND_FAILED');
	const unsafeAlias = await auditRepository({ npmRun: exactNpmRun, run: async (_command, args) => {
		if (args[0] === 'config' && args[2] === '^alias\\.') return { stdout: 'alias.unsafe status' };
		if (args[0] === 'config') { const error = new Error('BAP38_SECRET_NEVER_ECHO'); error.code = 1; throw error; }
		return { stdout: 'version-bump.mjs' };
	} });
	assert.equal(unsafeAlias, 'GIT_ALIAS_INVALID');
});

test('nested Git-safety environment validation accepts only the minimized exact CI identity', async () => {
	const environmentAuthority = parseStrictJson(await readFile(path.join(repositoryRoot, 'config', 'environment-contract.json'), 'utf8'));
	const environment = { ...environmentAuthority.environment.repository.ciRootPolicy.metadata, GITHUB_WORKSPACE: repositoryRoot };
	const exactCiRun = () => {
		let lsFilesCalls = 0;
		return async (command, args) => {
			if (command === 'npm') return environmentAuthority.environment.toolchain.npm;
			if (args.includes('--show-toplevel')) return repositoryRoot;
			if (args.includes('status')) return '';
			if (args.includes('ls-files')) return (lsFilesCalls++ === 0 ? ['mise.toml', '.github/workflows/pr-validation.yml'] : ['AGENTS.md', 'mise.toml', 'version-bump.mjs', '.github/workflows/pr-validation.yml']).join('\n');
			if (args.includes('remote.origin.url')) return `https://github.com/${environmentAuthority.environment.repository.slug}.git`;
			const error = new Error('not configured'); error.code = 1; throw error;
		};
	};
	const validRun = exactCiRun();
	assert.equal(await auditRepository({ npmRun: exactNpmRun, environment, environmentRun: validRun, run: validRun, environmentPlatform: 'linux' }), null);
	assert.equal(await auditRepository({ npmRun: exactNpmRun, environment, environmentRun: exactCiRun(), run: exactCiRun(), environmentPlatform: 'win32' }), 'ENVIRONMENT_CONTRACT_INVALID');
	assert.equal(await auditRepository({ npmRun: exactNpmRun, environment: { ...environment, GITHUB_BASE_REF: 'release' }, environmentRun: exactCiRun(), run: exactCiRun(), environmentPlatform: 'linux' }), 'ENVIRONMENT_CONTRACT_INVALID');
	const failure = async () => { const error = new Error('post-environment failure'); error.code = 'EPERM'; throw error; };
	assert.equal(await auditRepository({ npmRun: exactNpmRun, environment, environmentRun: exactCiRun(), run: failure, environmentPlatform: 'linux' }), 'COMMAND_FAILED');
});

test('repository audit rejects wildcard OpenCode Git permissions without exposing configuration', async () => {
	const result = await auditRepository({ npmRun: exactNpmRun, readText: async (file) => file.endsWith('opencode.jsonc') ? opencodeText.replace('"rtk git status": "allow"', '"rtk git status*": "allow"') : readFile(file, 'utf8') });
	assert.equal(result, 'ENVIRONMENT_CONTRACT_INVALID');
});

test('indirect caller audit denies undeclared or dynamic Git surfaces without exposing their text', async () => {
	assert.equal(await auditIndirectCallers(['version-bump.mjs'], { readText: async () => 'const x = 1;' }), null);
	assert.equal(await auditIndirectCallers(['scripts/rogue.mjs'], { readText: async () => "execFile('git', ['push'])" }), 'INDIRECT_CALLER_INVALID');
	assert.equal(await auditIndirectCallers(['version-bump.mjs'], { readText: async () => "execFile('git', ['add', 'x'])" }), 'INDIRECT_CALLER_INVALID');
	assert.equal(await auditIndirectCallers(['scripts/validate-environment.mjs'], { readText: async () => "run('git', ['push'])" }), 'INDIRECT_CALLER_INVALID');
	assert.equal(await auditIndirectCallers(['esbuild.config.mjs'], { readText: async () => "execFile('git', ['push'])" }), 'INDIRECT_CALLER_INVALID');
	const fixtureText = await readFile(path.join(repositoryRoot, 'tests', 'git-safety-contract.test.mjs'), 'utf8');
	assert.equal(await auditIndirectCallers(['tests/git-safety-contract.test.mjs'], { readText: async () => `${fixtureText}\n${'executeFile'}('git', ['push'])` }), 'INDIRECT_CALLER_INVALID');
	assert.equal(await auditIndirectCallers(['tests/git-safety-contract.test.mjs'], { readText: async () => `${fixtureText}\n${'run'}(['push'])` }), 'INDIRECT_CALLER_INVALID');
	assert.equal(await auditIndirectCallers(['scripts/validate-environment.mjs'], { readText: async () => `${await readFile(path.join(repositoryRoot, 'scripts', 'validate-environment.mjs'), 'utf8')}\n${'invokeGit'}('git', ['push'])` }), 'INDIRECT_CALLER_INVALID');
	assert.equal(await auditIndirectCallers(['scripts/validate-environment.mjs'], { readText: async () => `${await readFile(path.join(repositoryRoot, 'scripts', 'validate-environment.mjs'), 'utf8')}\n${'gitRun'}('git', ['push'])` }), 'INDIRECT_CALLER_INVALID');
	assert.equal(await auditIndirectCallers(['scripts/validate-environment.mjs'], { readText: async () => `${await readFile(path.join(repositoryRoot, 'scripts', 'validate-environment.mjs'), 'utf8')}\n${'runExactGit'}('git', ['push'], repositoryRoot)` }), 'INDIRECT_CALLER_INVALID');
	assert.equal(await auditIndirectCallers(['scripts/validate-environment.mjs'], { readText: async () => `${await readFile(path.join(repositoryRoot, 'scripts', 'validate-environment.mjs'), 'utf8')}\n${'execute'}('git', ['push'])` }), 'INDIRECT_CALLER_INVALID');
	assert.equal(await auditIndirectCallers(['tests/git-safety-contract.test.mjs'], { readText: async () => `${fixtureText}\n${'run'}(['-C', repositoryRoot, 'reset', '--hard'])` }), 'INDIRECT_CALLER_INVALID');
	const confinementGuard = "if (!con" + "fined) throw new Error('FIXTURE_CWD_OUTSIDE_DISPOSABLE_ROOT');";
	assert.equal(await auditIndirectCallers(['tests/git-safety-contract.test.mjs'], { readText: async () => fixtureText.replace(confinementGuard, '') }), 'INDIRECT_CALLER_INVALID');
	assert.equal(await auditIndirectCallers(['tests/git-safety-contract.test.mjs'], { readText: async () => `${fixtureText}\nconst ${'inDirectory'} = (directory, args) => ${'executeFile'}('git', args, { cwd: directory, shell: false, env: fixtureEnvironment });` }), 'INDIRECT_CALLER_INVALID');
	assert.equal(await auditIndirectCallers(['tests/git-safety-contract.test.mjs'], { readText: async () => `${fixtureText}\n${'executeFile'}('git', ['reset', '--hard'], { cwd: repositoryRoot, shell: false, env: fixtureEnvironment });` }), 'INDIRECT_CALLER_INVALID');
});

test('the disposable fixture rejects every cwd escape before invoking Git', async () => {
	let gitCalls = 0;
	const fixture = await createDisposableGitFixture({ gitExecutor: async () => { gitCalls += 1; throw new Error('GIT_MUST_NOT_RUN'); } });
	const unrelatedRoot = await mkdtemp(path.join(tmpdir(), 'bap-78-unrelated-'));
	try {
		for (const cwd of [repositoryRoot, unrelatedRoot, path.join(fixture.root, '..'), path.resolve(tmpdir())]) {
			await assert.rejects(fixture.runGit(cwd, ['reset', '--hard']), /FIXTURE_CWD_OUTSIDE_DISPOSABLE_ROOT/);
		}
		assert.equal(gitCalls, 0);
	} finally {
		await Promise.all([fixture.cleanup(), rm(unrelatedRoot, { recursive: true, force: true })]);
	}
});

test('the disposable stale checkout obtains only an approved target object before ancestry', async () => {
	const fixture = await createDisposableGitFixture();
	const source = path.join(fixture.root, 'source'); const remote = path.join(fixture.root, 'remote.git'); const checkout = path.join(fixture.root, 'checkout');
	const state = async (target) => ({ head: (await fixture.runGit(checkout, ['rev-parse', 'HEAD'])).stdout.trim(), branch: (await fixture.runGit(checkout, ['branch', '--show-current'])).stdout.trim(), worktree: (await fixture.runGit(checkout, ['status', '--short'])).stdout, index: (await fixture.runGit(checkout, ['diff', '--cached', '--name-status'])).stdout, refs: (await fixture.runGit(checkout, ['for-each-ref', '--format=%(refname) %(objectname)'])).stdout, fetchHead: await readFile(path.join(checkout, '.git', 'FETCH_HEAD'), 'utf8'), targetObject: await fixture.runGit(checkout, ['cat-file', '-e', `${target}^{commit}`]).then(() => true, () => false) });
	try {
		await fixture.runGit(fixture.root, ['init', '--bare', remote]); await fixture.runGit(fixture.root, ['init', '--initial-branch=main', source]);
		await fixture.runGit(source, ['config', 'user.email', 'fixture@example.invalid']); await fixture.runGit(source, ['config', 'user.name', 'BAP-78 fixture']);
		await writeFile(path.join(source, 'owned.txt'), 'A\n'); await fixture.runGit(source, ['add', 'owned.txt']); await fixture.runGit(source, ['commit', '-m', 'test: A']);
		const starting = (await fixture.runGit(source, ['rev-parse', 'HEAD'])).stdout.trim(); await fixture.runGit(source, ['remote', 'add', 'origin', remote]); await fixture.runGit(source, ['push', 'origin', 'main']);
		await fixture.runGit(fixture.root, ['init', '--initial-branch=main', checkout]); await fixture.runGit(checkout, ['remote', 'add', 'origin', remote]); await fixture.runGit(checkout, ['fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main']); await fixture.runGit(checkout, ['reset', '--hard', 'refs/remotes/origin/main']);
		await writeFile(path.join(source, 'owned.txt'), 'B\n'); await fixture.runGit(source, ['add', 'owned.txt']); await fixture.runGit(source, ['commit', '-m', 'test: B']);
		const target = (await fixture.runGit(source, ['rev-parse', 'HEAD'])).stdout.trim(); await fixture.runGit(source, ['push', 'origin', 'main']);
		const before = await state(target);
		await assert.rejects(fixture.runGit(checkout, ['merge-base', '--is-ancestor', starting, target]), { code: 128 });
		await fixture.runGit(checkout, ['fetch', '--no-tags', '--no-write-fetch-head', 'origin', target]);
		const after = await state(target);
		assert.equal(before.targetObject, false); assert.equal(after.targetObject, true); assert.equal(after.head, before.head); assert.equal(after.branch, before.branch); assert.equal(after.worktree, ''); assert.equal(after.index, ''); assert.equal(after.refs, before.refs); assert.equal(after.fetchHead, before.fetchHead);
		await fixture.runGit(checkout, ['merge-base', '--is-ancestor', starting, target]);
		await writeFile(path.join(source, 'owned.txt'), 'C\n'); await fixture.runGit(source, ['add', 'owned.txt']); await fixture.runGit(source, ['commit', '-m', 'test: C']); await fixture.runGit(source, ['push', 'origin', 'main']);
		const moved = (await fixture.runGit(source, ['rev-parse', 'HEAD'])).stdout.trim();
		assert.notEqual(moved, target);
		assert.equal(authorizeReconciliationPreparationPostcondition({ expectedStartingSha: starting, expectedTargetSha: target, targetObjectExists: after.targetObject, actualHeadSha: after.head, currentBranch: after.branch, worktreeStatus: after.worktree, indexStatus: after.index, refsUnchanged: after.refs === before.refs, fetchHeadUnchanged: after.fetchHead === before.fetchHead, liveOriginMainSha: moved, startingShaIsAncestor: true }), 'RECONCILIATION_PREPARATION_POSTCONDITION_REQUIRED');
	} finally { await fixture.cleanup(); }
});
