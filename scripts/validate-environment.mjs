import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { validateOpenCodeGovernance } from './validate-opencode-governance.mjs';

const executeFile = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
export const repositoryRoot = path.resolve(path.dirname(scriptPath), '..');
const CONTRACT_PATH = path.join(repositoryRoot, 'config', 'environment-contract.json');
const EXAMPLE_PATH = path.join(repositoryRoot, 'config', 'environment.example.json');
const SAFE_CODES = new Set(['CONFIG_READ_FAILED', 'CONFIG_INVALID', 'CONFIG_SCHEMA_INVALID', 'ENVIRONMENT_VARIABLE_FORBIDDEN', 'CI_METADATA_INVALID', 'REPOSITORY_ROOT_INVALID', 'REPOSITORY_CWD_INVALID', 'REPOSITORY_TOPLEVEL_INVALID', 'REPOSITORY_ORIGIN_INVALID', 'CI_WORKSPACE_INVALID', 'CI_WORKTREE_INVALID', 'NODE_VERSION_INVALID', 'NPM_VERSION_INVALID', 'LOCKFILE_INVALID', 'PACKAGE_LOCK_MISMATCH', 'LOCKED_TOOL_INVALID', 'IGNORE_POLICY_INVALID', 'PATH_POLICY_INVALID', 'OPENCODE_GOVERNANCE_INVALID', 'COMMAND_FAILED']);

const exactKeys = (value, expected) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
const emptyObject = (value) => exactKeys(value, []);
const sameStrings = (actual, expected) => Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
const isStringList = (value) => Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string' && entry.length > 0) && new Set(value).size === value.length;
const normalizePath = (value, platform) => {
	const normalized = platform === 'win32' ? value.replaceAll('/', '\\').replace(/\\+$/, '').toLowerCase() : value.replace(/\/+$/, '');
	return normalized;
};
const fail = (code) => SAFE_CODES.has(code) ? code : 'CONFIG_INVALID';
const exactEntries = (value, expected) => exactKeys(value, Object.keys(expected)) && Object.entries(expected).every(([key, entry]) => value[key] === entry);
const canonicalEnvironmentGitQueries = Object.freeze([
	Object.freeze(['config', '--get', 'remote.origin.url']),
	Object.freeze(['rev-parse', '--show-toplevel']),
	Object.freeze(['status', '--short']),
	Object.freeze(['ls-files']),
]);

/** JSON parser that rejects duplicate and escaped object member names. */
export function parseStrictJson(text) {
	let cursor = 0;
	const skip = () => { while (/[\t\n\r ]/.test(text[cursor] ?? '')) cursor += 1; };
	const invalid = () => { throw new Error('CONFIG_INVALID'); };
	const string = (key = false) => {
		if (text[cursor] !== '"') invalid(); const start = cursor++; let escaped = false;
		while (cursor < text.length) { const character = text[cursor++]; if (character === '"' && !escaped) { const raw = text.slice(start, cursor); if (key && raw.includes('\\')) invalid(); try { return JSON.parse(raw); } catch { invalid(); } } escaped = character === '\\' && !escaped; }
		invalid();
	};
	const value = () => { skip(); if (text[cursor] === '{') { cursor += 1; skip(); const result = Object.create(null); const seen = new Set(); if (text[cursor] === '}') { cursor += 1; return result; } while (true) { skip(); const name = string(true); if (seen.has(name)) invalid(); seen.add(name); skip(); if (text[cursor++] !== ':') invalid(); result[name] = value(); skip(); if (text[cursor] === '}') { cursor += 1; return result; } if (text[cursor++] !== ',') invalid(); } } if (text[cursor] === '[') { cursor += 1; skip(); const result = []; if (text[cursor] === ']') { cursor += 1; return result; } while (true) { result.push(value()); skip(); if (text[cursor] === ']') { cursor += 1; return result; } if (text[cursor++] !== ',') invalid(); } } if (text[cursor] === '"') return string(); const literal = text.slice(cursor).match(/^(true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/)?.[0]; if (!literal) invalid(); cursor += literal.length; return JSON.parse(literal); };
	const result = value(); skip(); if (cursor !== text.length) invalid(); return result;
}

export function validateAuthority(authority) {
	if (!exactKeys(authority, ['contractVersion', 'configSchema', 'requiredConfigKeys', 'environment']) || typeof authority.contractVersion !== 'string') return fail('CONFIG_SCHEMA_INVALID');
	if (!exactKeys(authority.configSchema, ['required', 'optional', 'defaults', 'environmentVariables', 'secrets']) || !sameStrings(authority.configSchema.required, ['contractVersion', 'environment']) || !sameStrings(authority.configSchema.optional, []) || !emptyObject(authority.configSchema.defaults) || !sameStrings(authority.configSchema.environmentVariables, []) || !sameStrings(authority.configSchema.secrets, [])) return fail('CONFIG_SCHEMA_INVALID');
	const required = authority.requiredConfigKeys;
	if (!exactKeys(required, ['environment', 'repository', 'toolchain', 'paths', 'profile', 'capabilities']) || Object.values(required).some((keys) => !isStringList(keys))) return fail('CONFIG_SCHEMA_INVALID');
	const environment = authority.environment;
	if (!exactKeys(environment, required.environment) || !emptyObject(environment.optional) || !emptyObject(environment.default) || !emptyObject(environment.envVariables) || !emptyObject(environment.secrets)) return fail('CONFIG_SCHEMA_INVALID');
	if (!exactKeys(environment.repository, required.repository) || !exactKeys(environment.repository.root, ['windows', 'linux']) || Object.values(environment.repository.root).some((root) => typeof root !== 'string' || root.length === 0) || typeof environment.repository.slug !== 'string' || environment.repository.slug.length === 0) return fail('CONFIG_SCHEMA_INVALID');
	const ciRootPolicy = environment.repository.ciRootPolicy;
	if (!exactKeys(ciRootPolicy, ['metadata', 'trackedAllowlist']) || !exactEntries(ciRootPolicy.metadata, { CI: 'true', GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: environment.repository.slug, GITHUB_EVENT_NAME: 'pull_request', GITHUB_BASE_REF: 'main', RUNNER_ENVIRONMENT: 'github-hosted', RUNNER_OS: 'Linux' }) || !sameStrings(ciRootPolicy.trackedAllowlist, ['.github/workflows/pr-validation.yml'])) return fail('CONFIG_SCHEMA_INVALID');
	const toolchain = environment.toolchain;
	if (!exactKeys(toolchain, required.toolchain) || typeof toolchain.node !== 'string' || typeof toolchain.npm !== 'string' || typeof toolchain.packageManager !== 'string' || typeof toolchain.lockfile !== 'string' || !Number.isInteger(toolchain.lockfileVersion) || !isStringList(toolchain.requiredLockedPackages)) return fail('CONFIG_SCHEMA_INVALID');
	if (!exactKeys(environment.paths, required.paths) || !isStringList(environment.paths.tracked) || !isStringList(environment.paths.ignoredRuntime)) return fail('CONFIG_SCHEMA_INVALID');
	const profiles = environment.profiles;
	if (!isStringList(environment.profileNames) || !profiles || typeof profiles !== 'object' || Array.isArray(profiles) || !sameStrings(Object.keys(profiles).sort(), [...environment.profileNames].sort())) return fail('CONFIG_SCHEMA_INVALID');
	for (const profile of Object.values(profiles)) {
		if (!exactKeys(profile, required.profile) || typeof profile.responsibility !== 'string' || profile.responsibility.length === 0 || !exactKeys(profile.capabilities, required.capabilities) || Object.values(profile.capabilities).some((capability) => capability !== false)) return fail('CONFIG_SCHEMA_INVALID');
	}
	return null;
}

export function validateExample(example, authority) {
	return exactKeys(example, authority.configSchema.required) && example.contractVersion === authority.contractVersion && typeof example.environment === 'string' && Object.hasOwn(authority.environment.profiles, example.environment) ? null : fail('CONFIG_SCHEMA_INVALID');
}

function ciMetadataMatches(environment, policy) {
	return Object.entries(policy.metadata).every(([name, value]) => environment[name] === value) && typeof environment.GITHUB_WORKSPACE === 'string' && environment.GITHUB_WORKSPACE.length > 0;
}

export function canonicalEnvironmentGitArguments(root, argumentsList) {
	if (path.resolve(root) !== path.resolve(repositoryRoot) || !canonicalEnvironmentGitQueries.some((query) => sameStrings(argumentsList, query))) throw new Error('COMMAND_FAILED');
	return ['-c', `safe.directory=${path.resolve(root)}`, ...argumentsList];
}

export async function runExactGit(command, argumentsList, root, execute = executeFile) {
	if (command !== 'git') throw new Error('COMMAND_FAILED');
	return (await execute('git', canonicalEnvironmentGitArguments(root, argumentsList), { cwd: root, env: {}, shell: false })).stdout.trim();
}

async function runExactNpm(command, argumentsList, root) {
	if (command !== 'npm') throw new Error('COMMAND_FAILED');
	if (command === 'npm' && process.platform === 'win32') {
		const nodeDirectory = path.dirname(process.execPath);
		const prefixScript = path.join(nodeDirectory, 'node_modules', 'npm', 'bin', 'npm-prefix.js');
		const prefix = (await executeFile(process.execPath, [prefixScript], { cwd: root })).stdout.trim();
		return (await executeFile(process.execPath, [path.join(prefix, 'node_modules', 'npm', 'bin', 'npm-cli.js'), ...argumentsList], { cwd: root })).stdout.trim();
	}
	return (await executeFile(command, argumentsList, { cwd: root })).stdout.trim();
}

function validOrigin(origin, slug) {
	const normalized = origin.trim().replace(/\.git$/, '');
	return normalized === `https://github.com/${slug}` || normalized === `git@github.com:${slug}`;
}

function sameDependencySection(left, right, name) {
	const a = left[name] ?? {}; const b = right[name] ?? {};
	return exactKeys(a, Object.keys(b)) && Object.keys(a).every((key) => a[key] === b[key]);
}

export async function validateEnvironment({ authorityText, configText, root = repositoryRoot, currentDirectory = process.cwd(), environment = process.env, nodeVersion = process.versions.node, platform = process.platform, readText = (file) => readFile(file, 'utf8'), validateOpenCode = validateOpenCodeGovernance, run = (command, argumentsList) => runExactNpm(command, argumentsList, root), gitRun = (command, argumentsList) => runExactGit(command, argumentsList, root) } = {}) {
	if (Object.keys(environment).some((name) => /^baukasten_press_/i.test(name))) return fail('ENVIRONMENT_VARIABLE_FORBIDDEN');
	let authority; let example;
	try { authority = parseStrictJson(authorityText); example = parseStrictJson(configText); } catch { return fail('CONFIG_INVALID'); }
	const authorityResult = validateAuthority(authority); if (authorityResult) return authorityResult;
	const exampleResult = validateExample(example, authority); if (exampleResult) return exampleResult;
	const { repository, toolchain, paths } = authority.environment;
	const localRoot = platform === 'win32' ? repository.root.windows : platform === 'linux' ? repository.root.linux : null;
	if (localRoot === null) return fail('REPOSITORY_ROOT_INVALID');
	const ci = ciMetadataMatches(environment, repository.ciRootPolicy);
	if (ci && platform !== 'linux') return fail('CI_METADATA_INVALID');
	if (!ci && Object.keys(environment).some((name) => ['CI', 'GITHUB_ACTIONS', 'GITHUB_REPOSITORY', 'GITHUB_EVENT_NAME', 'GITHUB_BASE_REF', 'RUNNER_ENVIRONMENT', 'RUNNER_OS', 'GITHUB_WORKSPACE'].includes(name))) return fail('CI_METADATA_INVALID');
	if (!ci && normalizePath(root, platform) !== normalizePath(localRoot, platform)) return fail('REPOSITORY_ROOT_INVALID');
	if (!ci && normalizePath(currentDirectory, platform) !== normalizePath(localRoot, platform)) return fail('REPOSITORY_CWD_INVALID');
	if (ci && (normalizePath(environment.GITHUB_WORKSPACE, platform) !== normalizePath(root, platform) || normalizePath(currentDirectory, platform) !== normalizePath(root, platform))) return fail('CI_WORKSPACE_INVALID');
	if (nodeVersion !== toolchain.node) return fail('NODE_VERSION_INVALID');
	const invokeGit = gitRun;
	let origin; let topLevel; let npmVersion; let status;
	try { [origin, topLevel, npmVersion, status] = await Promise.all([invokeGit('git', ['config', '--get', 'remote.origin.url']), invokeGit('git', ['rev-parse', '--show-toplevel']), run('npm', ['--version']), invokeGit('git', ['status', '--short'])]); } catch { return fail('COMMAND_FAILED'); }
	if (normalizePath(topLevel, platform) !== normalizePath(ci ? root : localRoot, platform)) return fail('REPOSITORY_TOPLEVEL_INVALID');
	if (ci && status.trim() !== '') return fail('CI_WORKTREE_INVALID');
	if (!validOrigin(origin, repository.slug)) return fail('REPOSITORY_ORIGIN_INVALID');
	if (npmVersion !== toolchain.npm) return fail('NPM_VERSION_INVALID');
	let packageText; let lockText; let ignoreText;
	try { [packageText, lockText, ignoreText] = await Promise.all([readText(path.join(root, 'package.json')), readText(path.join(root, toolchain.lockfile)), readText(path.join(root, '.gitignore'))]); } catch { return fail('LOCKFILE_INVALID'); }
	let manifest; let lock;
	try { manifest = parseStrictJson(packageText); lock = parseStrictJson(lockText); } catch { return fail('LOCKFILE_INVALID'); }
	if (lock.lockfileVersion !== toolchain.lockfileVersion || !lock.packages || typeof lock.packages !== 'object') return fail('LOCKFILE_INVALID');
	if (!lock.packages[''] || !sameDependencySection(manifest, lock.packages[''], 'dependencies') || !sameDependencySection(manifest, lock.packages[''], 'devDependencies')) return fail('PACKAGE_LOCK_MISMATCH');
	for (const name of toolchain.requiredLockedPackages) if (!lock.packages[`node_modules/${name}`] || typeof lock.packages[`node_modules/${name}`].version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(lock.packages[`node_modules/${name}`].version)) return fail('LOCKED_TOOL_INVALID');
	const ignored = new Set(ignoreText.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')));
	if (paths.ignoredRuntime.some((entry) => !ignored.has(entry))) return fail('IGNORE_POLICY_INVALID');
	let tracked;
	try { tracked = await invokeGit('git', ['ls-files']); } catch { return fail('COMMAND_FAILED'); }
	if (await validateOpenCode({ root, readText, presentTrackedOpenCodePaths: tracked.split(/\r?\n/).filter((entry) => entry.startsWith('.opencode/')) })) return fail('OPENCODE_GOVERNANCE_INVALID');
	if (tracked.split(/\r?\n/).filter((entry) => entry.startsWith('.github/')).some((entry) => !repository.ciRootPolicy.trackedAllowlist.includes(entry))) return fail('PATH_POLICY_INVALID');
	const approved = paths.tracked;
	if (tracked.split(/\r?\n/).filter(Boolean).some((entry) => !approved.some((allowed) => allowed.endsWith('/') ? entry.startsWith(allowed) : entry === allowed))) return fail('PATH_POLICY_INVALID');
	return null;
}

export async function main(argumentsList = process.argv.slice(2)) {
	if (argumentsList.length !== 2 || argumentsList[0] !== '--config' || argumentsList[1] !== 'config/environment.example.json') { process.stderr.write('Environment validation failed: CONFIG_INVALID\n'); return 1; }
	let authorityText; let configText;
	try { [authorityText, configText] = await Promise.all([readFile(CONTRACT_PATH, 'utf8'), readFile(EXAMPLE_PATH, 'utf8')]); } catch { process.stderr.write('Environment validation failed: CONFIG_READ_FAILED\n'); return 1; }
	const result = await validateEnvironment({ authorityText, configText });
	if (result) { process.stderr.write(`Environment validation failed: ${result}\n`); return 1; }
	process.stdout.write('Environment contract valid.\n'); return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) process.exitCode = await main();
