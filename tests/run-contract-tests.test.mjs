import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';

import { canonicalTypeScriptTests, childArguments, environmentTest, main, repositoryRoot } from '../scripts/run-contract-tests.mjs';

test('contract runner accepts no arguments and uses only the canonical contract suites', async () => {
	let bundled = false;
	let executed = false;
	assert.equal(await main([], { bundle: async () => { bundled = true; }, execute: async () => { executed = true; } }), 0);
	assert.equal(bundled, true);
	assert.equal(executed, true);
	assert.deepEqual(canonicalTypeScriptTests, [
		'tests/publication-domain-contract.test.ts',
		'tests/publication-state-machine.test.ts',
		'tests/integration-contracts.test.ts',
	]);
	assert.equal(environmentTest, 'tests/environment-contract.test.mjs');
});

test('contract runner rejects arguments before it can bundle or execute', async () => {
	let invoked = false;
	assert.equal(await main(['untrusted'], { bundle: async () => { invoked = true; }, execute: async () => { invoked = true; } }), 1);
	assert.equal(invoked, false);
});

test('contract child has fixed permissioned arguments and no user-provided paths', () => {
	const testPath = environmentTest;
	const argumentsList = childArguments(testPath);
	assert.deepEqual(argumentsList.slice(0, 4), ['--permission', `--allow-fs-read=${repositoryRoot}`, '--test-isolation=none', '--test']);
	assert.equal(argumentsList.includes('--allow-fs-write'), false);
	assert.equal(argumentsList.includes('--allow-net'), false);
	assert.equal(argumentsList.includes('--allow-child-process'), false);
	assert.equal(argumentsList.includes('--allow-worker'), false);
	assert.equal(argumentsList.includes('--allow-addons'), false);
	assert.deepEqual(argumentsList.slice(4), [testPath]);
	assert.deepEqual(canonicalTypeScriptTests.map((canonicalPath) => path.join('.npm-cache', 'contract-tests', `${path.basename(canonicalPath, '.ts')}.mjs`)), [
		path.join('.npm-cache', 'contract-tests', 'publication-domain-contract.test.mjs'),
		path.join('.npm-cache', 'contract-tests', 'publication-state-machine.test.mjs'),
		path.join('.npm-cache', 'contract-tests', 'integration-contracts.test.mjs'),
	]);
});
