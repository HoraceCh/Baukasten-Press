import { execFile } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { parseStrictJson, repositoryRoot, validateEnvironment } from './validate-environment.mjs';

export { repositoryRoot };

const executeFile = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
export const policyPath = path.join(repositoryRoot, 'config', 'git-safety-contract.json');
export const safeFailureCodes = new Set(['ARGUMENTS_INVALID', 'POLICY_READ_FAILED', 'POLICY_INVALID', 'ENVIRONMENT_CONTRACT_INVALID', 'PACKAGE_INVALID', 'PACKAGE_SCRIPT_INVALID', 'GIT_ALIAS_INVALID', 'GIT_INCLUDE_INVALID', 'GIT_HOOK_INVALID', 'TRACKED_SURFACE_INVALID', 'INDIRECT_CALLER_INVALID', 'AUTHORIZATION_INVALID', 'DELIVERY_AUTHORIZATION_REQUIRED', 'COMMAND_FAILED']);
const expectedPolicyKeys = ['contractVersion', 'repositoryAuthority', 'transport', 'commandClasses', 'implementationRequirements', 'prohibitedGitCommands', 'prohibitedGitArguments', 'approvedIndirectCallers', 'safeFailureCodes'];
const expectedClasses = ['readOnly', 'implementationMutation', 'deliveryMutation'];
const expectedRequirements = ['explicitOperationAuthority', 'pressAppImplementer', 'liveBapIssue', 'exactPathAllowlist', 'unrelatedWorkPreserved', 'focusedValidation', 'independentQa', 'cachedDiffEvidence', 'linearCompletionEvidence'];
const expectedProhibitedCommands = ['reset', 'clean', 'restore', 'checkout', 'stash', 'rebase', 'cherry-pick', 'merge', 'force', 'filter-branch', 'filter-repo', 'rm', 'mv', 'update-ref', 'replace', 'reflog', 'gc', 'prune', 'init', 'clone', 'submodule', 'worktree'];
const expectedProhibitedArguments = ['-C', '--git-dir', '--work-tree', '-c', '--intent-to-add', '-N', '--all', '-a', '--amend', '--no-verify', '--allow-empty', '--fixup', '--squash', '-S', '--gpg-sign'];
const expectedIndirectCallers = ['scripts/validate-environment.mjs', 'scripts/validate-git-safety.mjs', 'tests/git-safety-contract.test.mjs'];
const ignoredPathPatterns = Object.freeze(['.vscode/', '.idea/', '.npm-cache/', 'node_modules/', 'data.json', 'main.js', '.DS_Store', 'Thumbs.db']);
const equalStrings = (value, expected) => Array.isArray(value) && value.length === expected.length && value.every((entry, index) => entry === expected[index]);
const exactKeys = (value, expected) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
const fail = (code) => safeFailureCodes.has(code) ? code : 'POLICY_INVALID';

export function validatePolicy(policy) {
	if (!exactKeys(policy, expectedPolicyKeys) || policy.contractVersion !== '1.0' || policy.repositoryAuthority !== 'config/environment-contract.json' || policy.transport !== 'rtk') return fail('POLICY_INVALID');
	if (!exactKeys(policy.commandClasses, expectedClasses) || !equalStrings(policy.commandClasses.readOnly, ['status', 'diff', 'log', 'show', 'rev-parse', 'config --get', 'ls-files', 'grep', 'branch --show-current', 'remote get-url origin']) || !equalStrings(policy.commandClasses.implementationMutation, ['add <exact-relative-path>', 'add -p <exact-relative-path>', 'commit -m <conventional-subject>']) || !equalStrings(policy.commandClasses.deliveryMutation, ['push', 'switch', 'branch', 'remote branch', 'pull request', 'ruleset', 'branch protection'])) return fail('POLICY_INVALID');
	if (!equalStrings(policy.implementationRequirements, expectedRequirements) || !equalStrings(policy.prohibitedGitCommands, expectedProhibitedCommands) || !equalStrings(policy.prohibitedGitArguments, expectedProhibitedArguments) || !equalStrings(policy.approvedIndirectCallers, expectedIndirectCallers) || !equalStrings(policy.safeFailureCodes, [...safeFailureCodes])) return fail('POLICY_INVALID');
	return null;
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
	if (command === 'add' && ((rest.length === 1 && validateExactRelativePath(rest[0])) || (rest.length === 2 && rest[0] === '-p' && validateExactRelativePath(rest[1])))) return 'implementation-mutation';
	if (command === 'commit' && rest.length === 2 && rest[0] === '-m' && conventionalSubject.test(rest[1])) return 'implementation-mutation';
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
const literalArray = (source) => [...source.matchAll(/run\(\s*['"]git['"]\s*,\s*(\[(?:\s*['"][^'"]*['"]\s*,?\s*)*\])/g)].map((match) => JSON.parse(match[1].replaceAll("'", '"')));
const executableSurface = (entry) => entry.endsWith('.mjs') && (!entry.includes('/') || entry.startsWith('scripts/') || entry.startsWith('tests/'));
const fixtureInvocationCounts = new Map([['init', 1], ['config\u0000user.email\u0000fixture@example.invalid', 1], ['config\u0000user.name\u0000BAP-38 fixture', 1], ['add\u0000owned.txt', 2], ['add\u0000unrelated.txt', 1], ['commit\u0000-m\u0000test: create fixture', 1], ['commit\u0000-m\u0000test: stage exact path', 1], ['show\u0000--format=\u0000--name-only\u0000HEAD', 1], ['status\u0000--short', 2]]);

function validFixtureInvocations(source) {
	const invocations = [...source.matchAll(/\brun\(\s*([^)]*)\)/g)];
	if (invocations.length !== 11 || invocations.some((match) => !/^\[(?:\s*['"][^'"]*['"]\s*,?\s*)*\]$/.test(match[1]))) return false;
	const actual = new Map();
	try { for (const match of invocations) { const key = JSON.parse(match[1].replaceAll("'", '"')).join('\u0000'); actual.set(key, (actual.get(key) ?? 0) + 1); } } catch { return false; }
	return actual.size === fixtureInvocationCounts.size && [...fixtureInvocationCounts].every(([key, count]) => actual.get(key) === count);
}

export async function auditIndirectCallers(paths, { root = repositoryRoot, readText = (file) => readFile(file, 'utf8') } = {}) {
	for (const entry of paths.filter(executableSurface)) {
		let text;
		try { text = await readText(path.join(root, entry)); } catch { return fail('INDIRECT_CALLER_INVALID'); }
		const executionText = text.replace(/readText:\s*async\s*\(\)\s*=>\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '');
		const calls = literalArray(executionText);
		const hasDirectGit = /(?:run|execFile|executeFile)\(\s*['"]git['"]/.test(executionText);
		const fixtureWrapper = entry === 'tests/git-safety-contract.test.mjs' && executionText.includes("executeFile('git', args, { cwd: fixture, shell: false") && executionText.includes("path.join(repositoryRoot, '.npm-cache', 'git-safety-fixtures'");
		if (!hasDirectGit && !fixtureWrapper) continue;
		if (!expectedIndirectCallers.includes(entry)) return fail('INDIRECT_CALLER_INVALID');
		if (fixtureWrapper) {
			if ((executionText.match(/executeFile\('git', args, \{ cwd: fixture, shell: false/g) ?? []).length !== 1 || (executionText.match(/executeFile\(\s*['"]git['"]/g) ?? []).length !== 1 || /(?:execFile|execFileSync|spawn|spawnSync)\(\s*[^)]*\)/.test(executionText)) return fail('INDIRECT_CALLER_INVALID');
			if (!validFixtureInvocations(executionText)) return fail('INDIRECT_CALLER_INVALID');
		}
		if (/(?:\beval\b|shell\s*:\s*true|exec\s*\()/i.test(executionText)) return fail('INDIRECT_CALLER_INVALID');
		if (hasDirectGit && calls.length === 0 && !fixtureWrapper) return fail('INDIRECT_CALLER_INVALID');
		for (const invocation of calls) {
			const key = invocation.join('\u0000');
			if (classifyGitArguments(invocation) !== 'read-only' && !internalGitQueries.has(key)) return fail('INDIRECT_CALLER_INVALID');
		}
		if (entry === 'tests/git-safety-contract.test.mjs' && /executeFile\(\s*['"]git['"]/.test(executionText) && !fixtureWrapper) return fail('INDIRECT_CALLER_INVALID');
	}
	return null;
}

export async function auditRepository({ root = repositoryRoot, readText = (file) => readFile(file, 'utf8'), run = (command, args) => executeFile(command, args, { cwd: root, shell: false, env: {} }) } = {}) {
	let policyText; let environmentText; let exampleText; let packageText;
	try { [policyText, environmentText, exampleText, packageText] = await Promise.all([readText(path.join(root, 'config', 'git-safety-contract.json')), readText(path.join(root, 'config', 'environment-contract.json')), readText(path.join(root, 'config', 'environment.example.json')), readText(path.join(root, 'package.json'))]); } catch { return fail('POLICY_READ_FAILED'); }
	let policy; let manifest;
	try { policy = parseStrictJson(policyText); parseStrictJson(environmentText); parseStrictJson(exampleText); manifest = parseStrictJson(packageText); } catch { return fail('POLICY_INVALID'); }
	if (validatePolicy(policy)) return fail('POLICY_INVALID');
	if (await validateEnvironment({ authorityText: environmentText, configText: exampleText, root, currentDirectory: root, environment: {}, readText })) return fail('ENVIRONMENT_CONTRACT_INVALID');
	const scripts = auditPackageScripts(manifest); if (scripts) return scripts;
	const output = (result) => typeof result === 'string' ? result : result.stdout ?? '';
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
