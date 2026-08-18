import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { promisify } from 'node:util';

import { auditIndirectCallers, auditPackageScripts, auditRepository, authorizeDeliveryMutation, authorizeImplementationMutation, classifyGitArguments, policyPath, repositoryRoot, validateExactRelativePath, validatePolicy } from '../scripts/validate-git-safety.mjs';
import { parseStrictJson } from '../scripts/validate-environment.mjs';

const executeFile = promisify(execFile);
const policy = parseStrictJson(await readFile(policyPath, 'utf8'));
const packageText = await readFile(path.join(repositoryRoot, 'package.json'), 'utf8');
const manifest = parseStrictJson(packageText);

test('policy is exact, strict, and recognizes only the safe command forms', () => {
	assert.equal(validatePolicy(policy), null);
	assert.throws(() => parseStrictJson('{"contractVersion":"1.0","contractVersion":"1.0"}'));
	assert.throws(() => parseStrictJson('{"contract\\u0056ersion":"1.0"}'));
	assert.equal(validatePolicy({ ...policy, transport: 'git' }), 'POLICY_INVALID');
	assert.equal(validatePolicy({ ...policy, extra: true }), 'POLICY_INVALID');
	for (const command of [['status'], ['status', '--short'], ['diff'], ['diff', '--check'], ['diff', '--cached'], ['diff', '--cached', '--check'], ['diff', '--cached', '--name-status'], ['diff', '--cached', '--stat'], ['log', '-1'], ['show', 'HEAD'], ['rev-parse', '--show-toplevel'], ['rev-parse', 'HEAD'], ['config', '--get', 'remote.origin.url'], ['ls-files'], ['grep', 'BAP-38'], ['branch', '--show-current'], ['remote', 'get-url', 'origin']]) assert.equal(classifyGitArguments(command), 'read-only');
	assert.equal(classifyGitArguments(['add', 'docs/GIT_SAFETY.md']), 'implementation-mutation');
	assert.equal(classifyGitArguments(['add', '-p', 'docs/GIT_SAFETY.md']), 'implementation-mutation');
	assert.equal(classifyGitArguments(['commit', '-m', 'docs(git): define safety contract']), 'implementation-mutation');
	assert.equal(classifyGitArguments(['push']), 'delivery-mutation');
	assert.equal(classifyGitArguments(['branch', 'topic']), 'delivery-mutation');
});

test('paths and mutation/evaluator/history forms fail closed', () => {
	for (const pathname of ['', '.', 'docs', '.agents', '.codex', '.serena', '.github', '../README.md', 'C:/outside', '-u', '--update', '--renormalize', ':(top)README.md', ':!README.md', ':^README.md', '.vscode/a.json', '.idea/a.xml', 'a.iml', '.npm-cache/x', 'node_modules/x.js', 'data.json', 'main.js', 'main.js.map', '.DS_Store', 'Thumbs.db', 'docs/*.md', 'docs//a.md', 'docs\\a.md']) assert.equal(validateExactRelativePath(pathname), false);
	assert.equal(validateExactRelativePath('.github/workflows/validate.yml'), true);
	assert.equal(validateExactRelativePath('.agents/skills/baukasten-press-ui/SKILL.md'), true);
	assert.equal(validateExactRelativePath('.codex/config.toml'), true);
	for (const command of [['add', '.'], ['add', 'docs'], ['add', '-u'], ['add', '--update'], ['add', '--renormalize'], ['add', ':(top)README.md'], ['add', '--all'], ['add', '-N', 'docs/x.md'], ['commit', '-a', '-m', 'x'], ['commit', '--amend'], ['commit', '--no-verify', '-m', 'x'], ['commit', '-m', 'not conventional'], ['commit', '-m', 'x', 'docs/a.md'], ['diff', '--output=x'], ['diff', '--ext-diff'], ['diff', '--no-index', 'a', 'b'], ['show', '--textconv', 'HEAD'], ['status', '--porcelain=v2'], ['grep', '--cached', 'BAP'], ['reset', '--hard'], ['clean', '-fd'], ['restore', '.'], ['rebase', 'main'], ['git'], ['-C', '.', 'status'], ['status', 'GIT_DIR=x'], ['config', '--global', 'alias.x', 'status']]) assert.equal(classifyGitArguments(command), 'denied');
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

test('repository audit is read-only, redacts command failures, and tolerates an unrelated dirty worktree', async () => {
	assert.equal(await auditRepository(), null);
	const result = await auditRepository({ readText: async () => { throw new Error('BAP38_SECRET_NEVER_ECHO'); } });
	assert.equal(result, 'POLICY_READ_FAILED');
	const emptyConfig = { stdout: '' };
	const failedInclude = await auditRepository({ run: async (_command, args) => {
		if (args[0] === 'config' && args[2] === '^alias\\.') { const error = new Error('BAP38_SECRET_NEVER_ECHO'); error.code = 1; throw error; }
		if (args[0] === 'config' && args[2] === '^include\\.') { const error = new Error('BAP38_SECRET_NEVER_ECHO'); error.code = 2; throw error; }
		return args[0] === 'ls-files' ? { stdout: 'version-bump.mjs' } : emptyConfig;
	} });
	assert.equal(failedInclude, 'COMMAND_FAILED');
	const unsafeAlias = await auditRepository({ run: async (_command, args) => {
		if (args[0] === 'config' && args[2] === '^alias\\.') return { stdout: 'alias.unsafe status' };
		if (args[0] === 'config') { const error = new Error('BAP38_SECRET_NEVER_ECHO'); error.code = 1; throw error; }
		return { stdout: 'version-bump.mjs' };
	} });
	assert.equal(unsafeAlias, 'GIT_ALIAS_INVALID');
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
	assert.equal(await auditIndirectCallers(['tests/git-safety-contract.test.mjs'], { readText: async () => `${fixtureText}\n${'run'}(['-C', repositoryRoot, 'reset', '--hard'])` }), 'INDIRECT_CALLER_INVALID');
});

test('the disposable fixture commits only its exact staged path and preserves unrelated changes', async () => {
	const fixture = path.join(repositoryRoot, '.npm-cache', 'git-safety-fixtures', 'exact-stage');
	await rm(fixture, { recursive: true, force: true });
	await mkdir(fixture, { recursive: true });
	const run = (args) => executeFile('git', args, { cwd: fixture, shell: false, env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '' } });
	try {
		await run(['init']); await run(['config', 'user.email', 'fixture@example.invalid']); await run(['config', 'user.name', 'BAP-38 fixture']);
		await writeFile(path.join(fixture, 'owned.txt'), 'base\n'); await writeFile(path.join(fixture, 'unrelated.txt'), 'base\n');
		await run(['add', 'owned.txt']); await run(['add', 'unrelated.txt']); await run(['commit', '-m', 'test: create fixture']);
		await writeFile(path.join(fixture, 'owned.txt'), 'owned changed\n'); await writeFile(path.join(fixture, 'unrelated.txt'), 'unrelated changed\n'); await writeFile(path.join(fixture, 'new.txt'), 'untracked\n');
		await run(['add', 'owned.txt']); await run(['commit', '-m', 'test: stage exact path']);
		assert.match((await run(['show', '--format=', '--name-only', 'HEAD'])).stdout, /^owned\.txt\s*$/m);
		assert.match((await run(['status', '--short'])).stdout, / M unrelated\.txt/);
		assert.match((await run(['status', '--short'])).stdout, /\?\? new\.txt/);
	} finally {
		await rm(fixture, { recursive: true, force: true });
	}
});
