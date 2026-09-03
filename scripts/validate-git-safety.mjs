import { execFile } from 'node:child_process';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { parseStrictJson, repositoryRoot, validateEnvironment } from './validate-environment.mjs';
import { validateOpenCodeGovernance } from './validate-opencode-governance.mjs';

export { repositoryRoot };

const executeFile = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
export const policyPath = path.join(repositoryRoot, 'config', 'git-safety-contract.json');
export const safeFailureCodes = new Set(['ARGUMENTS_INVALID', 'POLICY_READ_FAILED', 'POLICY_INVALID', 'ENVIRONMENT_CONTRACT_INVALID', 'PACKAGE_INVALID', 'PACKAGE_SCRIPT_INVALID', 'GIT_ALIAS_INVALID', 'GIT_INCLUDE_INVALID', 'GIT_HOOK_INVALID', 'TRACKED_SURFACE_INVALID', 'INDIRECT_CALLER_INVALID', 'AUTHORIZATION_INVALID', 'RECONCILIATION_PREPARATION_AUTHORIZATION_REQUIRED', 'RECONCILIATION_PREPARATION_POSTCONDITION_REQUIRED', 'RECONCILIATION_AUTHORIZATION_REQUIRED', 'DELIVERY_AUTHORIZATION_REQUIRED', 'COMMAND_FAILED']);
const expectedPolicyKeys = ['contractVersion', 'repositoryAuthority', 'transport', 'validatorGitContext', 'commandClasses', 'implementationRequirements', 'reconciliationPreparationRequirements', 'reconciliationRequirements', 'prohibitedGitCommands', 'prohibitedGitArguments', 'approvedIndirectCallers', 'safeFailureCodes'];
const expectedClasses = ['readOnly', 'implementationMutation', 'reconciliationPreparationMutation', 'reconciliationMutation', 'deliveryMutation'];
const expectedRequirements = ['explicitOperationAuthority', 'pressAppImplementer', 'liveBapIssue', 'exactPathAllowlist', 'unrelatedWorkPreserved', 'focusedValidation', 'independentQa', 'cachedDiffEvidence', 'linearCompletionEvidence'];
const expectedReconciliationRequirements = ['explicitReconciliationAuthority', 'canonicalRepositoryRoot', 'canonicalHttpsOrigin', 'mainBranch', 'cleanWorktree', 'cleanIndex', 'expectedStartingSha', 'expectedTargetSha', 'headMatchesStartingSha', 'originMainMatchesTargetSha', 'startingShaIsAncestor', 'fastForwardOnly', 'originMain', 'rtkTransport'];
const expectedPreparationRequirements = ['explicitReconciliationPreparationAuthority', 'canonicalRepositoryRoot', 'canonicalHttpsOrigin', 'mainBranch', 'cleanWorktree', 'cleanIndex', 'expectedStartingSha', 'expectedTargetSha', 'headMatchesStartingSha', 'originMainMatchesTargetSha', 'rtkTransport'];
const expectedProhibitedCommands = ['reset', 'clean', 'restore', 'checkout', 'stash', 'rebase', 'cherry-pick', 'merge', 'force', 'filter-branch', 'filter-repo', 'rm', 'mv', 'update-ref', 'replace', 'reflog', 'gc', 'prune', 'init', 'clone', 'submodule', 'worktree'];
const expectedProhibitedArguments = ['-C', '--git-dir', '--work-tree', '-c', '--intent-to-add', '-N', '--all', '-a', '--amend', '--no-verify', '--allow-empty', '--fixup', '--squash', '-S', '--gpg-sign', '-f', '--force', '--force-with-lease'];
const expectedIndirectCallers = ['scripts/validate-environment.mjs', 'scripts/validate-git-safety.mjs', 'tests/git-safety-contract.test.mjs'];
const canonicalOrigin = 'https://github.com/HoraceCh/Baukasten-Press.git';
const exactSha = /^[0-9a-f]{40}$/;
const ignoredPathPatterns = Object.freeze(['.vscode/', '.idea/', '.npm-cache/', 'node_modules/', 'data.json', 'main.js', '.DS_Store', 'Thumbs.db']);
const prWorkflowDirectory = path.join('.github', 'workflows');
const prWorkflowName = 'pr-validation.yml';
const expectedPrWorkflow = `name: PR validation

on:
  pull_request:
    branches:
      - main

permissions:
  contents: read

concurrency:
  group: pr-validation-${'${{ github.event.pull_request.number }}'}
  cancel-in-progress: true

jobs:
  validation:
    name: Unified validation
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 24.14.1
          check-latest: false
          package-manager-cache: false
      - run: npm install --global npm@11.14.1 --ignore-scripts --no-audit --no-fund
      - run: npm --version
      - run: npm ci --no-audit --no-fund
      - run: npm run validate
`;
const equalStrings = (value, expected) => Array.isArray(value) && value.length === expected.length && value.every((entry, index) => entry === expected[index]);
const exactKeys = (value, expected) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
const fail = (code) => safeFailureCodes.has(code) ? code : 'POLICY_INVALID';

function deliveryEnvironment(environment) {
	const names = ['CI', 'GITHUB_ACTIONS', 'GITHUB_REPOSITORY', 'GITHUB_EVENT_NAME', 'GITHUB_BASE_REF', 'RUNNER_ENVIRONMENT', 'RUNNER_OS', 'GITHUB_WORKSPACE'];
	return Object.fromEntries([...names, ...Object.keys(environment).filter((name) => /^baukasten_press_/i.test(name))].filter((name, index, all) => all.indexOf(name) === index && environment[name] !== undefined).map((name) => [name, environment[name]]));
}

export async function auditPrValidationWorkflow({ root = repositoryRoot, readText = (file) => readFile(file, 'utf8'), readDirectory = (directory) => readdir(directory, { withFileTypes: true }) } = {}) {
	let entries; let workflow;
	try { entries = await readDirectory(path.join(root, prWorkflowDirectory)); workflow = await readText(path.join(root, prWorkflowDirectory, prWorkflowName)); } catch { return fail('POLICY_INVALID'); }
	if (!Array.isArray(entries) || entries.length !== 1 || entries[0]?.name !== prWorkflowName || (entries[0]?.isFile && !entries[0].isFile()) || workflow !== expectedPrWorkflow) return fail('POLICY_INVALID');
	return null;
}

export function validatePolicy(policy) {
	if (!exactKeys(policy, expectedPolicyKeys) || policy.contractVersion !== '1.2' || policy.repositoryAuthority !== 'config/environment-contract.json' || policy.transport !== 'rtk') return fail('POLICY_INVALID');
	if (!exactKeys(policy.validatorGitContext, ['safeDirectory', 'environment', 'shell']) || policy.validatorGitContext.safeDirectory !== 'canonical-root' || policy.validatorGitContext.environment !== 'empty' || policy.validatorGitContext.shell !== false) return fail('POLICY_INVALID');
	if (!exactKeys(policy.commandClasses, expectedClasses) || !equalStrings(policy.commandClasses.readOnly, ['status', 'diff', 'log', 'show', 'rev-parse', 'config --get', 'ls-files', 'grep', 'branch --show-current', 'remote get-url origin', 'ls-remote --heads origin refs/heads/main', 'merge-base --is-ancestor <sha> <sha>']) || !equalStrings(policy.commandClasses.implementationMutation, ['add <exact-relative-path>', 'add -p <exact-relative-path>', 'commit -m <conventional-subject>']) || !equalStrings(policy.commandClasses.reconciliationPreparationMutation, ['fetch --no-tags --no-write-fetch-head origin <sha>']) || !equalStrings(policy.commandClasses.reconciliationMutation, ['pull --ff-only origin main']) || !equalStrings(policy.commandClasses.deliveryMutation, ['push', 'switch', 'branch', 'remote branch', 'pull request', 'ruleset', 'branch protection'])) return fail('POLICY_INVALID');
	if (!equalStrings(policy.implementationRequirements, expectedRequirements) || !equalStrings(policy.reconciliationPreparationRequirements, expectedPreparationRequirements) || !equalStrings(policy.reconciliationRequirements, expectedReconciliationRequirements) || !equalStrings(policy.prohibitedGitCommands, expectedProhibitedCommands) || !equalStrings(policy.prohibitedGitArguments, expectedProhibitedArguments) || !equalStrings(policy.approvedIndirectCallers, expectedIndirectCallers) || !equalStrings(policy.safeFailureCodes, [...safeFailureCodes])) return fail('POLICY_INVALID');
	return null;
}

export function canonicalValidatorGitArguments(root, argumentsList) {
	if (!Array.isArray(argumentsList) || argumentsList.some((entry) => typeof entry !== 'string' || entry.length === 0) || path.resolve(root) !== path.resolve(repositoryRoot)) throw new Error('Canonical Git validator context is unavailable.');
	return ['-c', `safe.directory=${path.resolve(repositoryRoot)}`, ...argumentsList];
}

export function validateExactRelativePath(value) {
	if (typeof value !== 'string' || value.length === 0 || value.startsWith('-') || value.startsWith(':') || path.isAbsolute(value) || value.startsWith('/') || value.includes('..') || /[?*[\]{}]/.test(value) || value.includes('\\') || value.endsWith('/') || value.includes('//') || value.split('/').some((part) => part === '.' || part.length === 0)) return false;
	const approvedDotFile = value === '.gitignore' || value === '.npmrc' || ['.agents/', '.codex/', '.github/'].some((prefix) => value.startsWith(prefix));
	if ((value.startsWith('.') && !approvedDotFile) || ignoredPathPatterns.some((entry) => entry.endsWith('/') ? value.startsWith(entry) : value === entry) || value.endsWith('.iml') || value.endsWith('.map')) return false;
	return /\.[A-Za-z0-9]+$/.test(value);
}

const exact = (actual, expected) => actual.length === expected.length && actual.every((entry, index) => entry === expected[index]);
const conventionalSubject = /^(?:[a-z][a-z0-9-]*)(?:\([a-z0-9][a-z0-9/-]*\))?!?: [^\r\n]+$/;

export function classifyGitArguments(argumentsList) {
	if (!Array.isArray(argumentsList) || argumentsList.length === 0 || argumentsList.some((entry) => typeof entry !== 'string' || entry.length === 0)) return 'denied';
	if (argumentsList.some((entry) => entry === '-C' || entry === '--git-dir' || entry === '--work-tree' || entry === '-c' || entry.startsWith('--git-dir=') || entry.startsWith('--work-tree=') || entry.startsWith('-c') || entry.startsWith('GIT_'))) return 'denied';
	const [command, ...rest] = argumentsList;
	if (expectedProhibitedCommands.includes(command) || rest.some((entry) => expectedProhibitedArguments.includes(entry) || entry.startsWith('--fixup=') || entry.startsWith('--squash=') || entry.startsWith('-S'))) return 'denied';
	if (command === 'status' && (exact(rest, []) || exact(rest, ['--short']))) return 'read-only';
	if (command === 'diff' && ([[], ['--check'], ['--cached'], ['--cached', '--check'], ['--cached', '--name-status'], ['--cached', '--stat']].some((allowed) => exact(rest, allowed)))) return 'read-only';
	if (command === 'log' && (exact(rest, []) || exact(rest, ['-1']))) return 'read-only';
	if (command === 'show' && (exact(rest, ['HEAD']) || exact(rest, ['--format=', '--name-only', 'HEAD']))) return 'read-only';
	if (command === 'rev-parse' && (exact(rest, ['--show-toplevel']) || exact(rest, ['HEAD']))) return 'read-only';
	if (command === 'ls-files' && exact(rest, [])) return 'read-only';
	if (command === 'grep' && rest.length === 1 && rest[0].length > 0 && !rest[0].startsWith('-')) return 'read-only';
	if (command === 'branch' && exact(rest, ['--show-current'])) return 'read-only';
	if (command === 'remote' && exact(rest, ['get-url', 'origin'])) return 'read-only';
	if (command === 'config' && exact(rest, ['--get', 'remote.origin.url'])) return 'read-only';
	if (command === 'ls-remote' && exact(rest, ['--heads', 'origin', 'refs/heads/main'])) return 'read-only';
	if (command === 'merge-base' && rest.length === 3 && rest[0] === '--is-ancestor' && exactSha.test(rest[1]) && exactSha.test(rest[2])) return 'read-only';
	if (command === 'fetch' && rest.length === 4 && exact(rest.slice(0, 3), ['--no-tags', '--no-write-fetch-head', 'origin']) && exactSha.test(rest[3])) return 'reconciliation-preparation-mutation';
	if (command === 'add' && ((rest.length === 1 && validateExactRelativePath(rest[0])) || (rest.length === 2 && rest[0] === '-p' && validateExactRelativePath(rest[1])))) return 'implementation-mutation';
	if (command === 'commit' && rest.length === 2 && rest[0] === '-m' && conventionalSubject.test(rest[1])) return 'implementation-mutation';
	if (command === 'pull' && exact(rest, ['--ff-only', 'origin', 'main'])) return 'reconciliation-mutation';
	if (['push', 'switch', 'branch'].includes(command)) return 'delivery-mutation';
	return 'denied';
}

export async function authorizeImplementationMutation({ argumentsList, explicitOperationAuthority, actor, issueIdentifier, ownedPaths, requestedPaths, unrelatedWorkPreserved, validationPassed, qaStatus, cachedDiffEvidence, root = repositoryRoot } = {}) {
	if (classifyGitArguments(argumentsList) !== 'implementation-mutation' || explicitOperationAuthority !== true || actor !== 'press_app_implementer' || !/^BAP-[1-9][0-9]*$/.test(issueIdentifier ?? '') || !Array.isArray(ownedPaths) || ownedPaths.length === 0 || new Set(ownedPaths).size !== ownedPaths.length || !ownedPaths.every(validateExactRelativePath) || !Array.isArray(requestedPaths) || !requestedPaths.every((entry) => ownedPaths.includes(entry)) || unrelatedWorkPreserved !== true || validationPassed !== true || !['PASS', 'PASS WITH WARNINGS'].includes(qaStatus) || cachedDiffEvidence !== true) return fail('AUTHORIZATION_INVALID');
	let resolvedRoot;
	try { resolvedRoot = await realpath(root); for (const entry of ownedPaths) { const candidate = path.resolve(root, entry); if (!candidate.startsWith(`${path.resolve(root)}${path.sep}`)) return fail('AUTHORIZATION_INVALID'); const details = await lstat(candidate); if (!details.isFile() || details.isSymbolicLink() || !((await realpath(candidate)).startsWith(`${resolvedRoot}${path.sep}`))) return fail('AUTHORIZATION_INVALID'); } } catch { return fail('AUTHORIZATION_INVALID'); }
	const pathArgument = argumentsList[0] === 'add' ? argumentsList.at(-1) : null;
	return pathArgument !== null && (!ownedPaths.includes(pathArgument) || !requestedPaths.includes(pathArgument)) ? fail('AUTHORIZATION_INVALID') : null;
}

export async function authorizeReconciliationMutation({ argumentsList, explicitReconciliationAuthority, repositoryRootEvidence, originUrl, currentBranch, worktreeStatus, indexStatus, expectedStartingSha, expectedTargetSha, actualHeadSha, liveOriginMainSha, startingShaIsAncestor, transport, root = repositoryRoot } = {}) {
	let resolvedRoot; let resolvedCanonicalRoot;
	try { [resolvedRoot, resolvedCanonicalRoot] = await Promise.all([realpath(root), realpath(repositoryRoot)]); } catch { return fail('RECONCILIATION_AUTHORIZATION_REQUIRED'); }
	const authorized = classifyGitArguments(argumentsList) === 'reconciliation-mutation'
		&& explicitReconciliationAuthority === true
		&& resolvedRoot === resolvedCanonicalRoot
		&& repositoryRootEvidence === resolvedCanonicalRoot
		&& originUrl === canonicalOrigin
		&& currentBranch === 'main'
		&& worktreeStatus === ''
		&& indexStatus === ''
		&& exactSha.test(expectedStartingSha ?? '')
		&& exactSha.test(expectedTargetSha ?? '')
		&& actualHeadSha === expectedStartingSha
		&& liveOriginMainSha === expectedTargetSha
		&& startingShaIsAncestor === true
		&& transport === 'rtk';
	return authorized ? null : fail('RECONCILIATION_AUTHORIZATION_REQUIRED');
}

export async function authorizeReconciliationPreparationMutation({ argumentsList, explicitReconciliationPreparationAuthority, repositoryRootEvidence, originUrl, currentBranch, worktreeStatus, indexStatus, expectedStartingSha, expectedTargetSha, actualHeadSha, liveOriginMainSha, transport, root = repositoryRoot } = {}) {
	let resolvedRoot; let resolvedCanonicalRoot;
	try { [resolvedRoot, resolvedCanonicalRoot] = await Promise.all([realpath(root), realpath(repositoryRoot)]); } catch { return fail('RECONCILIATION_PREPARATION_AUTHORIZATION_REQUIRED'); }
	const authorized = classifyGitArguments(argumentsList) === 'reconciliation-preparation-mutation'
		&& explicitReconciliationPreparationAuthority === true
		&& resolvedRoot === resolvedCanonicalRoot
		&& repositoryRootEvidence === resolvedCanonicalRoot
		&& originUrl === canonicalOrigin
		&& currentBranch === 'main'
		&& worktreeStatus === ''
		&& indexStatus === ''
		&& exactSha.test(expectedStartingSha ?? '')
		&& exactSha.test(expectedTargetSha ?? '')
		&& argumentsList[4] === expectedTargetSha
		&& actualHeadSha === expectedStartingSha
		&& liveOriginMainSha === expectedTargetSha
		&& transport === 'rtk';
	return authorized ? null : fail('RECONCILIATION_PREPARATION_AUTHORIZATION_REQUIRED');
}

export function authorizeReconciliationPreparationPostcondition({ expectedStartingSha, expectedTargetSha, targetObjectExists, actualHeadSha, currentBranch, worktreeStatus, indexStatus, refsUnchanged, fetchHeadUnchanged, liveOriginMainSha, startingShaIsAncestor } = {}) {
	const proven = exactSha.test(expectedStartingSha ?? '')
		&& exactSha.test(expectedTargetSha ?? '')
		&& targetObjectExists === true
		&& actualHeadSha === expectedStartingSha
		&& currentBranch === 'main'
		&& worktreeStatus === ''
		&& indexStatus === ''
		&& refsUnchanged === true
		&& fetchHeadUnchanged === true
		&& liveOriginMainSha === expectedTargetSha
		&& startingShaIsAncestor === true;
	return proven ? null : fail('RECONCILIATION_PREPARATION_POSTCONDITION_REQUIRED');
}

export function authorizeDeliveryMutation({ argumentsList, explicitDeliveryAuthority } = {}) {
	return classifyGitArguments(argumentsList) === 'delivery-mutation' && explicitDeliveryAuthority === true ? null : fail('DELIVERY_AUTHORIZATION_REQUIRED');
}

const forbiddenScriptGit = /(^|[^A-Za-z0-9_-])git(?:\s|$)/;
export function auditPackageScripts(manifest) {
	if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || !manifest.scripts || typeof manifest.scripts !== 'object' || Array.isArray(manifest.scripts)) return fail('PACKAGE_INVALID');
	if (manifest.scripts.version !== undefined || manifest.scripts['version:files'] !== 'node version-bump.mjs' || manifest.scripts['validate:git-safety'] !== 'node scripts/validate-git-safety.mjs && node --test tests/git-safety-contract.test.mjs') return fail('PACKAGE_SCRIPT_INVALID');
	const requiredValidate = 'npm run validate:environment && npm run validate:agents && npm run validate:git-safety && npm run test:contracts && npm run typecheck && npm run lint && npm run build';
	if (manifest.scripts.validate !== requiredValidate) return fail('PACKAGE_SCRIPT_INVALID');
	for (const [name, script] of Object.entries(manifest.scripts)) {
		if (typeof script !== 'string') return fail('PACKAGE_SCRIPT_INVALID');
		if (forbiddenScriptGit.test(script) || /(?:\bsh\b|\bbash\b|\bpowershell\b|\bcmd(?:\.exe)?\b|\beval\b)/i.test(script)) return fail('PACKAGE_SCRIPT_INVALID');
		if (name === 'prepare' || name === 'preversion' || name === 'version' || name === 'postversion' || name === 'prepublish' || name === 'prepublishOnly' || name === 'prepack' || name === 'postpack') return fail('PACKAGE_SCRIPT_INVALID');
	}
	return null;
}

const internalGitQueries = new Set([
	'config\u0000--get-regexp\u0000^alias\\.',
	'config\u0000--get-regexp\u0000^include\\.',
	'config\u0000--get-regexp\u0000^includeIf\\.',
	'config\u0000--get\u0000core.hooksPath',
]);
const literalArray = (source) => [...source.matchAll(/(?:run|invokeGit|gitRun|runExactGit)\(\s*['"]git['"]\s*,\s*(\[(?:\s*['"][^'"]*['"]\s*,?\s*)*\])/g)].map((match) => JSON.parse(match[1].replaceAll("'", '"')));
const exactEnvironmentGitTransport = (source) => /export async function runExactGit\(command, argumentsList, root, execute = executeFile\) \{\s*if \(command !== 'git'\) throw new Error\('COMMAND_FAILED'\);\s*return \(await execute\('git', canonicalEnvironmentGitArguments\(root, argumentsList\), \{ cwd: root, env: \{\}, shell: false \}\)\)\.stdout\.trim\(\);\s*\}/s.test(source);
const executableSurface = (entry) => entry.endsWith('.mjs') && (!entry.includes('/') || entry.startsWith('scripts/') || entry.startsWith('tests/'));
function validFixtureInvocations(source) {
	const signature = "async function createDisposableGitFixture({ gitExecutor = executeFile } = {}) {";
	const requiredConfinement = [
		signature,
		"const disposableRoot = await mkdtemp(path.join(tmpdir(), 'bap-78-git-safety-'));",
		'const canonicalDisposableRoot = await realpath(disposableRoot);',
		'const canonicalCwd = await realpath(cwd);',
		'const confined = canonicalCwd === canonicalDisposableRoot || canonicalCwd.startsWith(`${canonicalDisposableRoot}${path.sep}`);',
		"if (!confined) throw new Error('FIXTURE_CWD_OUTSIDE_DISPOSABLE_ROOT');",
		"return gitExecutor('git', argumentsList, { cwd: canonicalCwd, shell: false, env: fixtureEnvironment });",
		'cleanup: () => rm(canonicalDisposableRoot, { recursive: true, force: true })',
	];
	const helperStart = source.indexOf(signature);
	const helperTail = helperStart === -1 ? '' : source.slice(helperStart);
	const helperClose = helperTail.match(/\r?\n}\r?\n/);
	if (!helperClose || helperClose.index === undefined) return false;
	const helper = helperTail.slice(0, helperClose.index + helperClose[0].length);
	let previous = -1;
	for (const fragment of requiredConfinement) {
		const current = helper.indexOf(fragment);
		if (current <= previous) return false;
		previous = current;
	}
	const processExecutions = source.match(/\b(?:execFile|executeFile|gitExecutor|execute|spawn|spawnSync|execFileSync|execSync)\s*\(/g) ?? [];
	return /^\t\tif \(!confined\) throw new Error\('FIXTURE_CWD_OUTSIDE_DISPOSABLE_ROOT'\);\r?$/m.test(helper)
		&& processExecutions.length === 1
		&& processExecutions[0].startsWith('gitExecutor')
		&& source.includes("fixture.runGit(checkout, ['fetch', '--no-tags', '--no-write-fetch-head', 'origin', target])")
		&& !/const\s+inDirectory\s*=\s*\(directory,\s*args\)\s*=>/.test(source)
		&& !/\b(?:run|inDirectory)\s*\(/.test(source)
		&& !source.includes("run(['push'])")
		&& !source.includes("run(['-C'");
}

export async function auditIndirectCallers(paths, { root = repositoryRoot, readText = (file) => readFile(file, 'utf8') } = {}) {
	for (const entry of paths.filter(executableSurface)) {
		let text;
		try { text = await readText(path.join(root, entry)); } catch { return fail('INDIRECT_CALLER_INVALID'); }
		const executionText = text.replace(/readText:\s*async\s*\(\)\s*=>\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '');
		const calls = literalArray(executionText);
		const hasDirectGit = /(?:run|invokeGit|gitRun|runExactGit|execFile|executeFile|execute|gitExecutor)\(\s*['"]git['"]/.test(executionText);
		const directGitCalls = executionText.match(/(?:execFile|executeFile|execute)\(\s*['"]git['"]/g) ?? [];
		const environmentGitTransport = entry === 'scripts/validate-environment.mjs' && exactEnvironmentGitTransport(executionText);
		const fixtureWrapper = entry === 'tests/git-safety-contract.test.mjs' && executionText.includes('async function createDisposableGitFixture({ gitExecutor = executeFile } = {}) {');
		if (!hasDirectGit && !fixtureWrapper) continue;
		if (!expectedIndirectCallers.includes(entry)) return fail('INDIRECT_CALLER_INVALID');
		if (fixtureWrapper) {
			if (!validFixtureInvocations(executionText)) return fail('INDIRECT_CALLER_INVALID');
		}
		if (/(?:\beval\b|shell\s*:\s*true|exec\s*\()/i.test(executionText)) return fail('INDIRECT_CALLER_INVALID');
		if (hasDirectGit && calls.length === 0 && !fixtureWrapper && !environmentGitTransport) return fail('INDIRECT_CALLER_INVALID');
		if (environmentGitTransport && directGitCalls.length !== 1) return fail('INDIRECT_CALLER_INVALID');
		for (const invocation of calls) {
			const key = invocation.join('\u0000');
			if (classifyGitArguments(invocation) !== 'read-only' && !internalGitQueries.has(key)) return fail('INDIRECT_CALLER_INVALID');
		}
		if (entry === 'tests/git-safety-contract.test.mjs' && /executeFile\(\s*['"]git['"]/.test(executionText) && !fixtureWrapper) return fail('INDIRECT_CALLER_INVALID');
	}
	return null;
}

export async function auditRepository({ root = repositoryRoot, readText = (file) => readFile(file, 'utf8'), readDirectory, environment = deliveryEnvironment(process.env), environmentRun, npmRun, run, environmentPlatform = process.platform } = {}) {
	let policyText; let environmentText; let exampleText; let packageText;
	try { [policyText, environmentText, exampleText, packageText] = await Promise.all([readText(path.join(root, 'config', 'git-safety-contract.json')), readText(path.join(root, 'config', 'environment-contract.json')), readText(path.join(root, 'config', 'environment.example.json')), readText(path.join(root, 'package.json'))]); } catch { return fail('POLICY_READ_FAILED'); }
	let policy; let manifest;
	try { policy = parseStrictJson(policyText); parseStrictJson(environmentText); parseStrictJson(exampleText); manifest = parseStrictJson(packageText); } catch { return fail('POLICY_INVALID'); }
	if (validatePolicy(policy)) return fail('POLICY_INVALID');
	const canonicalRun = (command, args) => executeFile(command, canonicalValidatorGitArguments(root, args), { cwd: root, shell: false, env: {} });
	run ??= canonicalRun;
	const output = (result) => typeof result === 'string' ? result : result.stdout ?? '';
	const ciGitRun = environment.CI === 'true' ? async (command, args) => output(await (environmentRun ?? canonicalRun)(command, args)).trim() : undefined;
	if (await validateEnvironment({ authorityText: environmentText, configText: exampleText, root, currentDirectory: root, environment, platform: environmentPlatform, readText, run: npmRun, gitRun: ciGitRun })) return fail('ENVIRONMENT_CONTRACT_INVALID');
	if (await auditPrValidationWorkflow({ root, readText, readDirectory })) return fail('POLICY_INVALID');
	const scripts = auditPackageScripts(manifest); if (scripts) return scripts;
	const optionalGitConfig = async (args, failureCode) => {
		try { return await run('git', args); } catch (error) { return error?.code === 1 ? { stdout: '' } : failureCode; }
	};
	const aliases = await optionalGitConfig(['config', '--get-regexp', '^alias\\.'], 'COMMAND_FAILED'); if (aliases === 'COMMAND_FAILED') return fail('COMMAND_FAILED');
	const includes = await optionalGitConfig(['config', '--get-regexp', '^include\\.'], 'COMMAND_FAILED'); if (includes === 'COMMAND_FAILED') return fail('COMMAND_FAILED');
	const conditionalIncludes = await optionalGitConfig(['config', '--get-regexp', '^includeIf\\.'], 'COMMAND_FAILED'); if (conditionalIncludes === 'COMMAND_FAILED') return fail('COMMAND_FAILED');
	const hooks = await optionalGitConfig(['config', '--get', 'core.hooksPath'], 'COMMAND_FAILED'); if (hooks === 'COMMAND_FAILED') return fail('COMMAND_FAILED');
	let tracked;
	try { tracked = await run('git', ['ls-files']); } catch { return fail('COMMAND_FAILED'); }
	if (output(aliases).trim()) return fail('GIT_ALIAS_INVALID');
	if (output(includes).trim()) return fail('GIT_INCLUDE_INVALID');
	if (output(conditionalIncludes).trim()) return fail('GIT_INCLUDE_INVALID');
	if (output(hooks).trim()) return fail('GIT_HOOK_INVALID');
	const paths = output(tracked).split(/\r?\n/).filter(Boolean);
	if (await validateOpenCodeGovernance({ root, readText, presentTrackedOpenCodePaths: paths.filter((entry) => entry.startsWith('.opencode/')) })) return fail('POLICY_INVALID');
	if (paths.some((entry) => entry.startsWith('.npm-cache/') || entry === 'main.js') || !paths.includes('version-bump.mjs')) return fail('TRACKED_SURFACE_INVALID');
	const auditPaths = [...new Set([...paths, 'scripts/validate-git-safety.mjs', 'tests/git-safety-contract.test.mjs'])];
	const indirect = await auditIndirectCallers(auditPaths, { root, readText }); if (indirect) return indirect;
	return null;
}

export async function main(argumentsList = process.argv.slice(2)) {
	if (argumentsList.length !== 0) { process.stderr.write('Git safety validation failed: ARGUMENTS_INVALID\n'); return 1; }
	const result = await auditRepository();
	if (result) { process.stderr.write(`Git safety validation failed: ${result}\n`); return 1; }
	process.stdout.write('Git safety contract valid.\n');
	return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) process.exitCode = await main();
