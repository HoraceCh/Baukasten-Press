import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';

import { parseStrictJson, repositoryRoot, validateAuthority, validateEnvironment, validateExample } from '../scripts/validate-environment.mjs';

const authorityText = await readFile(path.join(repositoryRoot, 'config', 'environment-contract.json'), 'utf8');
const exampleText = await readFile(path.join(repositoryRoot, 'config', 'environment.example.json'), 'utf8');
const authority = parseStrictJson(authorityText);
const example = parseStrictJson(exampleText);
const packageText = await readFile(path.join(repositoryRoot, 'package.json'), 'utf8');
const lockTextV2 = await readFile(path.join(repositoryRoot, 'package-lock.json'), 'utf8');
const ignoreTextV2 = await readFile(path.join(repositoryRoot, '.gitignore'), 'utf8');
const opencodeTextV2 = await readFile(path.join(repositoryRoot, 'opencode.jsonc'), 'utf8');
const sentinel = 'BAP41_SENTINEL_NEVER_ECHO';

function cloneV2(value) { return JSON.parse(JSON.stringify(value)); }
function options(overrides = {}) {
	const tracked = ['AGENTS.md', 'README.md', 'config/environment-contract.json'];
	return {
		authorityText, configText: exampleText, root: authority.environment.repository.root, currentDirectory: authority.environment.repository.root, environment: {}, nodeVersion: authority.environment.toolchain.node,
		readText: async (file) => file.endsWith('package.json') ? packageText : file.endsWith('.gitignore') ? ignoreTextV2 : file.endsWith('opencode.jsonc') ? opencodeTextV2 : lockTextV2,
		run: async (command, args) => command === 'npm' ? authority.environment.toolchain.npm : args.includes('--show-toplevel') ? authority.environment.repository.root : args.includes('ls-files') ? tracked.join('\n') : `https://github.com/${authority.environment.repository.slug}.git`,
		...overrides,
	};
}

function ciOptions(overrides = {}) {
	const root = '/home/runner/work/Baukasten-Press/Baukasten-Press';
	const environment = { ...authority.environment.repository.ciRootPolicy.metadata, GITHUB_WORKSPACE: root };
	const tracked = ['AGENTS.md', 'README.md', 'config/environment-contract.json', '.github/workflows/pr-validation.yml'];
	return options({
		root, currentDirectory: root, environment,
		validateOpenCode: async () => null,
		run: async (command, args) => command === 'npm' ? authority.environment.toolchain.npm : args.includes('--show-toplevel') ? root : args.includes('status') ? '' : args.includes('ls-files') ? tracked.join('\n') : `https://github.com/${authority.environment.repository.slug}.git`,
		...overrides,
	});
}

test('authority is sole source, and the example is the exact two-key local selector', async () => {
	assert.equal(validateAuthority(authority), null);
	assert.equal(validateExample(example, authority), null);
	assert.deepEqual(Object.keys(example).sort(), ['contractVersion', 'environment']);
	assert.equal(example.environment, 'local');
	assert.equal(await validateEnvironment(options()), null);
	for (const profile of Object.values(authority.environment.profiles)) assert.equal(Object.values(profile.capabilities).every((value) => value === false), true);
});

test('authority and selector reject schema drift, escaped/duplicate keys, profiles, paths, and capabilities', () => {
	assert.throws(() => parseStrictJson('{"contractVersion":"x","contractVersion":"x"}'));
	assert.throws(() => parseStrictJson('{"contract\\u0056ersion":"x"}'));
	assert.equal(validateAuthority({ ...cloneV2(authority), environment: [] }), 'CONFIG_SCHEMA_INVALID');
	assert.equal(validateAuthority({ ...cloneV2(authority), unexpected: true }), 'CONFIG_SCHEMA_INVALID');
	const changed = cloneV2(authority); delete changed.environment.profiles.test;
	assert.equal(validateAuthority(changed), 'CONFIG_SCHEMA_INVALID');
	const capability = cloneV2(authority); capability.environment.profiles.local.capabilities.networkAccess = true;
	assert.equal(validateAuthority(capability), 'CONFIG_SCHEMA_INVALID');
	const paths = cloneV2(authority); paths.environment.paths.tracked = [];
	assert.equal(validateAuthority(paths), 'CONFIG_SCHEMA_INVALID');
	assert.equal(validateExample({ contractVersion: authority.contractVersion, environment: 'unknown' }, authority), 'CONFIG_SCHEMA_INVALID');
	assert.equal(validateExample({ contractVersion: authority.contractVersion, environment: 'local', extra: true }, authority), 'CONFIG_SCHEMA_INVALID');
	for (const invalidSelector of [null, [], {}, { contractVersion: authority.contractVersion }, { contractVersion: 1, environment: 'local' }, { contractVersion: 'wrong', environment: 'local' }, { contractVersion: authority.contractVersion, environment: [] }, { contractVersion: authority.contractVersion, environment: 'local', secrets: {} }, { contractVersion: authority.contractVersion, environment: 'local', token: 'x' }]) assert.equal(validateExample(invalidSelector, authority), 'CONFIG_SCHEMA_INVALID');
	const schema = cloneV2(authority); schema.configSchema.secrets = ['token'];
	assert.equal(validateAuthority(schema), 'CONFIG_SCHEMA_INVALID');
	for (const profileName of authority.environment.profileNames) {
		for (const capabilityName of authority.requiredConfigKeys.capabilities) {
			const mutation = cloneV2(authority);
			mutation.environment.profiles[profileName].capabilities[capabilityName] = true;
			assert.equal(validateAuthority(mutation), 'CONFIG_SCHEMA_INVALID');
		}
	}
});

test('repository, lock, ignore, package mismatch, canaries, and override arguments fail closed without leaks', async () => {
	assert.equal(await validateEnvironment(options({ root: 'F:\\Other' })), 'REPOSITORY_ROOT_INVALID');
	assert.equal(await validateEnvironment(options({ currentDirectory: 'F:\\Other' })), 'REPOSITORY_CWD_INVALID');
	const drift = cloneV2(authority); drift.environment.repository.root = 'F:\\Other';
	assert.equal(await validateEnvironment(options({ authorityText: JSON.stringify(drift) })), 'REPOSITORY_ROOT_INVALID');
	assert.equal(await validateEnvironment(options({ run: async (command, args) => command === 'npm' ? authority.environment.toolchain.npm : args.includes('--show-toplevel') ? authority.environment.repository.root : args.includes('ls-files') ? 'rogue.tmp' : `https://token:${sentinel}@github.com/x/y` })), 'REPOSITORY_ORIGIN_INVALID');
	assert.equal(await validateEnvironment(options({ run: async (command, args) => command === 'npm' ? authority.environment.toolchain.npm : args.includes('--show-toplevel') ? 'F:\\Other' : args.includes('ls-files') ? 'AGENTS.md' : `https://github.com/${authority.environment.repository.slug}` })), 'REPOSITORY_TOPLEVEL_INVALID');
	assert.equal(await validateEnvironment(options({ environment: { bAuKaStEn_PrEsS_override: sentinel } })), 'ENVIRONMENT_VARIABLE_FORBIDDEN');
	assert.equal(await validateEnvironment(options({ nodeVersion: '0.0.0' })), 'NODE_VERSION_INVALID');
	assert.equal(await validateEnvironment(options({ run: async (command, args) => command === 'npm' ? '0.0.0' : args.includes('--show-toplevel') ? authority.environment.repository.root : args.includes('ls-files') ? 'AGENTS.md' : `https://github.com/${authority.environment.repository.slug}` })), 'NPM_VERSION_INVALID');
	const mismatch = parseStrictJson(lockTextV2); mismatch.packages[''].devDependencies.esbuild = 'bad';
	assert.equal(await validateEnvironment(options({ readText: async (file) => file.endsWith('package.json') ? packageText : file.endsWith('.gitignore') ? ignoreTextV2 : JSON.stringify(mismatch) })), 'PACKAGE_LOCK_MISMATCH');
	const missingTool = parseStrictJson(lockTextV2); delete missingTool.packages['node_modules/esbuild'];
	assert.equal(await validateEnvironment(options({ readText: async (file) => file.endsWith('package.json') ? packageText : file.endsWith('.gitignore') ? ignoreTextV2 : JSON.stringify(missingTool) })), 'LOCKED_TOOL_INVALID');
	const invalidTool = parseStrictJson(lockTextV2); invalidTool.packages['node_modules/esbuild'].version = 'not-a-version';
	assert.equal(await validateEnvironment(options({ readText: async (file) => file.endsWith('package.json') ? packageText : file.endsWith('.gitignore') ? ignoreTextV2 : JSON.stringify(invalidTool) })), 'LOCKED_TOOL_INVALID');
	assert.equal(await validateEnvironment(options({ readText: async (file) => file.endsWith('package.json') ? packageText : file.endsWith('.gitignore') ? ignoreTextV2.replace('data.json', 'not-data.json') : lockTextV2 })), 'IGNORE_POLICY_INVALID');
	assert.equal(await validateEnvironment(options({ run: async (command, args) => command === 'npm' ? authority.environment.toolchain.npm : args.includes('--show-toplevel') ? authority.environment.repository.root : args.includes('ls-files') ? 'rogue.tmp' : `https://github.com/${authority.environment.repository.slug}` })), 'PATH_POLICY_INVALID');
	assert.equal(await validateEnvironment(options({ configText: sentinel })), 'CONFIG_INVALID');
	assert.equal(await validateEnvironment(options({ run: async (command, args) => args.includes('ls-files') ? Promise.reject(new Error(sentinel)) : command === 'npm' ? authority.environment.toolchain.npm : args.includes('--show-toplevel') ? authority.environment.repository.root : `https://github.com/${authority.environment.repository.slug}` })), 'COMMAND_FAILED');
});

test('the alternate GitHub pull-request root requires exact execution identity and a clean canonical checkout', async () => {
	assert.equal(await validateEnvironment(ciOptions()), null);
	for (const name of Object.keys(authority.environment.repository.ciRootPolicy.metadata)) {
		const missing = ciOptions(); delete missing.environment[name];
		assert.equal(await validateEnvironment(missing), 'CI_METADATA_INVALID');
		const wrong = ciOptions(); wrong.environment[name] = 'unexpected';
		assert.equal(await validateEnvironment(wrong), 'CI_METADATA_INVALID');
	}
	assert.equal(await validateEnvironment(ciOptions({ environment: { ...authority.environment.repository.ciRootPolicy.metadata, GITHUB_WORKSPACE: '/other' } })), 'CI_WORKSPACE_INVALID');
	assert.equal(await validateEnvironment(ciOptions({ currentDirectory: '/other' })), 'CI_WORKSPACE_INVALID');
	assert.equal(await validateEnvironment(ciOptions({ run: async (command, args) => command === 'npm' ? authority.environment.toolchain.npm : args.includes('--show-toplevel') ? '/other' : args.includes('status') ? '' : args.includes('ls-files') ? '.github/workflows/pr-validation.yml' : `https://github.com/${authority.environment.repository.slug}.git` })), 'REPOSITORY_TOPLEVEL_INVALID');
	assert.equal(await validateEnvironment(ciOptions({ run: async (command, args) => command === 'npm' ? authority.environment.toolchain.npm : args.includes('--show-toplevel') ? '/home/runner/work/Baukasten-Press/Baukasten-Press' : args.includes('status') ? '' : args.includes('ls-files') ? '.github/workflows/pr-validation.yml' : `https://token:${sentinel}@github.com/x/y` })), 'REPOSITORY_ORIGIN_INVALID');
	assert.equal(await validateEnvironment(ciOptions({ run: async (command, args) => command === 'npm' ? authority.environment.toolchain.npm : args.includes('--show-toplevel') ? '/home/runner/work/Baukasten-Press/Baukasten-Press' : args.includes('status') ? ' M README.md' : args.includes('ls-files') ? '.github/workflows/pr-validation.yml' : `https://github.com/${authority.environment.repository.slug}.git` })), 'CI_WORKTREE_INVALID');
	assert.equal(await validateEnvironment(ciOptions({ run: async (command, args) => command === 'npm' ? authority.environment.toolchain.npm : args.includes('--show-toplevel') ? '/home/runner/work/Baukasten-Press/Baukasten-Press' : args.includes('status') ? '' : args.includes('ls-files') ? '.github/workflows/unknown.yml' : `https://github.com/${authority.environment.repository.slug}.git` })), 'PATH_POLICY_INVALID');
});

test('OpenCode provider and external capability drift fails under the environment contract', async () => {
	assert.equal(await validateEnvironment(options({ readText: async (file) => file.endsWith('package.json') ? packageText : file.endsWith('.gitignore') ? ignoreTextV2 : file.endsWith('opencode.jsonc') ? opencodeTextV2.replace('"webfetch": {"*": "deny"}', '"webfetch": {"*": "allow"}') : lockTextV2 })), 'OPENCODE_GOVERNANCE_INVALID');
});

test('documentation and script retain canonical authority and no command override surface', async () => {
	const documentation = await readFile(path.join(repositoryRoot, 'docs', 'DEVELOPMENT_ENVIRONMENT.md'), 'utf8');
	assert.match(documentation, /sole authority/i);
	assert.match(documentation, /local.*test.*production-like/is);
	assert.doesNotMatch(documentation, /24\.14\.1|11\.14\.1|HoraceCh\/Baukasten-Press/);
});
