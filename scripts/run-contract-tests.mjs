import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { build } from 'esbuild';

const executeFile = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
export const repositoryRoot = path.resolve(path.dirname(scriptPath), '..');
export const outputDirectory = path.join(repositoryRoot, '.npm-cache', 'contract-tests');
export const canonicalTypeScriptTests = Object.freeze([
	'tests/publication-domain-contract.test.ts',
	'tests/publication-state-machine.test.ts',
	'tests/integration-contracts.test.ts',
]);
export const environmentTest = 'tests/environment-contract.test.mjs';

const safeFailure = (stage) => `Contract tests failed: ${stage}.\n`;
const outputRelativePath = (testPath) => path.join('.npm-cache', 'contract-tests', `${path.basename(testPath, '.ts')}.mjs`);

export function childArguments(testPath) {
	return [
		'--permission',
		`--allow-fs-read=${repositoryRoot}`,
		'--test-isolation=none',
		'--test',
		testPath,
	];
}

async function bundleCanonicalTests() {
	await mkdir(outputDirectory, { recursive: true });
	await build({
		entryPoints: canonicalTypeScriptTests.map((testPath) => path.join(repositoryRoot, testPath)),
		outdir: outputDirectory,
		bundle: true,
		format: 'esm',
		platform: 'node',
		target: 'node24',
		outExtension: { '.js': '.mjs' },
		logLevel: 'silent',
	});
}

async function executeCanonicalTests() {
	const testPaths = [environmentTest, ...canonicalTypeScriptTests.map(outputRelativePath)];
	for (const testPath of testPaths) {
		await executeFile(process.execPath, childArguments(testPath), {
			cwd: repositoryRoot,
			env: {},
			shell: false,
		});
	}
}

export async function main(argumentsList = process.argv.slice(2), dependencies = { bundle: bundleCanonicalTests, execute: executeCanonicalTests }) {
	if (argumentsList.length !== 0) {
		process.stderr.write(safeFailure('ARGUMENTS_INVALID'));
		return 1;
	}
	try {
		await dependencies.bundle();
	} catch {
		process.stderr.write(safeFailure('BUNDLE_INVALID'));
		return 1;
	}
	try {
		await dependencies.execute();
	} catch {
		process.stderr.write(safeFailure('TESTS_INVALID'));
		return 1;
	}
	process.stdout.write('Contract tests passed.\n');
	return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) process.exitCode = await main();
