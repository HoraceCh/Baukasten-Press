import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';

import {
	canonicalChildPlan,
	canonicalTypeScriptTests,
	childArguments,
	environmentTest,
	executeCanonicalTests,
	main,
	repositoryRoot,
} from '../scripts/run-contract-tests.mjs';

async function captureStderr(callback) {
	const write = process.stderr.write;
	let output = '';
	process.stderr.write = (chunk) => {
		output += String(chunk);
		return true;
	};
	try {
		return { result: await callback(), output };
	} finally {
		process.stderr.write = write;
	}
}

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
	const { output, result } = await captureStderr(() => main(['untrusted'], { bundle: async () => { invoked = true; }, execute: async () => { invoked = true; } }));
	assert.equal(result, 1);
	assert.equal(invoked, false);
	assert.equal(output, 'Contract tests failed: ARGUMENTS_INVALID.\n');
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

test('contract child plan is immutable and exactly maps the fixed canonical suites', () => {
	assert.equal(Object.isFrozen(canonicalChildPlan), true);
	for (const child of canonicalChildPlan) assert.equal(Object.isFrozen(child), true);
	assert.deepEqual(canonicalChildPlan, [
		{ testPath: 'tests/environment-contract.test.mjs', failureCode: 'ENVIRONMENT_TESTS_INVALID' },
		{ testPath: path.join('.npm-cache', 'contract-tests', 'publication-domain-contract.test.mjs'), failureCode: 'PUBLICATION_DOMAIN_TESTS_INVALID' },
		{ testPath: path.join('.npm-cache', 'contract-tests', 'publication-state-machine.test.mjs'), failureCode: 'PUBLICATION_STATE_MACHINE_TESTS_INVALID' },
		{ testPath: path.join('.npm-cache', 'contract-tests', 'integration-contracts.test.mjs'), failureCode: 'INTEGRATION_TESTS_INVALID' },
	]);
});

test('contract runner executes the fixed child plan in order with fixed isolation', async () => {
	const calls = [];
	const result = await executeCanonicalTests({
		execute: async (...argumentsList) => { calls.push(argumentsList); },
	});
	assert.equal(result, null);
	assert.deepEqual(calls.map(([command, argumentsList, options]) => ({ command, testPath: argumentsList.at(-1), options })), canonicalChildPlan.map(({ testPath }) => ({
		command: process.execPath,
		testPath,
		options: { cwd: repositoryRoot, env: {}, shell: false },
	})));
	for (const [, argumentsList] of calls) assert.deepEqual(argumentsList, childArguments(argumentsList.at(-1)));
});

test('contract child failures are fail-fast and expose only their fixed parent-owned code', async () => {
	for (const [failureIndex, expected] of canonicalChildPlan.entries()) {
		const calls = [];
		const sentinel = `child-secret-${failureIndex}`;
		const outcome = await executeCanonicalTests({
			execute: async (...argumentsList) => {
				calls.push(argumentsList);
				if (calls.length === failureIndex + 1) throw Object.assign(new Error(sentinel), {
					stdout: sentinel,
					stderr: sentinel,
					code: sentinel,
					signal: sentinel,
					args: [sentinel],
					env: { sentinel },
				});
			},
		});
		assert.equal(outcome.failureCode, expected.failureCode);
		assert.equal(calls.length, failureIndex + 1);
		const captured = await captureStderr(() => main([], { bundle: async () => {}, execute: async () => outcome }));
		assert.equal(captured.result, 1);
		assert.equal(captured.output, `Contract tests failed: ${expected.failureCode}.\n`);
		assert.equal(captured.output.includes(sentinel), false);
	}
});

test('contract runner collapses unknown, forged, and thrown execution failures to TESTS_INVALID', async () => {
	for (const execute of [
		async () => 'ENVIRONMENT_TESTS_INVALID',
		async () => ({ failureCode: 'ENVIRONMENT_TESTS_INVALID' }),
		async () => { throw Object.assign(new Error('child-secret'), { stdout: 'child-secret', stderr: 'child-secret', code: 'child-secret' }); },
	]) {
		const { output, result } = await captureStderr(() => main([], { bundle: async () => {}, execute }));
		assert.equal(result, 1);
		assert.equal(output, 'Contract tests failed: TESTS_INVALID.\n');
		assert.equal(output.includes('child-secret'), false);
	}
});

test('bundle failures skip every child and retain the fixed bundle failure code', async () => {
	let executed = false;
	const { output, result } = await captureStderr(() => main([], {
		bundle: async () => { throw new Error('bundle-secret'); },
		execute: async () => { executed = true; },
	}));
	assert.equal(result, 1);
	assert.equal(executed, false);
	assert.equal(output, 'Contract tests failed: BUNDLE_INVALID.\n');
	assert.equal(output.includes('bundle-secret'), false);
});
