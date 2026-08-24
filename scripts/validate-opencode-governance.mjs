import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
export const repositoryRoot = path.resolve(path.dirname(scriptPath), '..');
export const opencodeConfigPath = path.join(repositoryRoot, 'opencode.jsonc');
export const OMO_CONFIG_PATH = '.opencode/oh-my-openagent.jsonc';
export const OPENCODE_FAILURE = 'OPENCODE_GOVERNANCE_INVALID';

const readOnlyGitCommands = [
	'rtk git status', 'rtk git status --short', 'rtk git diff', 'rtk git diff --check',
	'rtk git diff --cached', 'rtk git diff --cached --check',
	'rtk git diff --cached --name-status', 'rtk git diff --cached --stat', 'rtk git log',
	'rtk git log -1', 'rtk git show HEAD', 'rtk git show --format= --name-only HEAD',
	'rtk git rev-parse --show-toplevel', 'rtk git rev-parse HEAD',
	'rtk git config --get remote.origin.url', 'rtk git ls-files',
	'rtk git branch --show-current', 'rtk git remote get-url origin',
];
const npmValidationCommands = [
	'npm run validate', 'npm run validate:agents', 'npm run validate:git-safety',
	'npm run validate:environment', 'npm run test:contracts', 'npm run typecheck',
	'npm run lint', 'npm run build',
];
const exactKeys = (value, expected) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
const equalEntries = (value, entries) => exactKeys(value, entries) && entries.every((entry) => value[entry] === 'allow');

/** Strict JSON parser: comments, duplicate keys, and escaped member names fail closed. */
export function parseOpenCodeJson(text) {
	let cursor = 0;
	const skip = () => { while (/[\t\n\r ]/.test(text[cursor] ?? '')) cursor += 1; };
	const invalid = () => { throw new Error(OPENCODE_FAILURE); };
	const string = (key = false) => {
		if (text[cursor] !== '"') invalid(); const start = cursor++; let escaped = false;
		while (cursor < text.length) { const character = text[cursor++]; if (character === '"' && !escaped) { const raw = text.slice(start, cursor); if (key && raw.includes('\\')) invalid(); try { return JSON.parse(raw); } catch { invalid(); } } escaped = character === '\\' && !escaped; }
		invalid();
	};
	const value = () => { skip(); if (text[cursor] === '{') { cursor += 1; skip(); const result = Object.create(null); const seen = new Set(); if (text[cursor] === '}') { cursor += 1; return result; } while (true) { skip(); const name = string(true); if (seen.has(name)) invalid(); seen.add(name); skip(); if (text[cursor++] !== ':') invalid(); result[name] = value(); skip(); if (text[cursor] === '}') { cursor += 1; return result; } if (text[cursor++] !== ',') invalid(); } } if (text[cursor] === '[') { cursor += 1; skip(); const result = []; if (text[cursor] === ']') { cursor += 1; return result; } while (true) { result.push(value()); skip(); if (text[cursor] === ']') { cursor += 1; return result; } if (text[cursor++] !== ',') invalid(); } } if (text[cursor] === '"') return string(); const literal = text.slice(cursor).match(/^(true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/)?.[0]; if (!literal) invalid(); cursor += literal.length; return JSON.parse(literal); };
	const result = value(); skip(); if (cursor !== text.length) invalid(); return result;
}

export function validateOpenCodeConfig(config) {
	if (!exactKeys(config, ['permission']) || !exactKeys(config.permission, ['*', 'read', 'glob', 'grep', 'list', 'edit', 'task', 'skill', 'external_directory', 'webfetch', 'websearch', 'codesearch', 'bash'])) return OPENCODE_FAILURE;
	const { permission } = config;
	if (permission['*'] !== 'deny' || !exactKeys(permission.read, ['*', '.env', '.env.*', '*.env', '*.env.*', '**/.env', '**/.env.*', '**/*.env', '**/*.env.*']) || permission.read['*'] !== 'allow' || Object.entries(permission.read).some(([key, value]) => key !== '*' && value !== 'deny')) return OPENCODE_FAILURE;
	for (const key of ['glob', 'grep', 'list']) if (!exactKeys(permission[key], ['*']) || permission[key]['*'] !== 'allow') return OPENCODE_FAILURE;
	for (const key of ['edit', 'task', 'skill', 'external_directory', 'webfetch', 'websearch', 'codesearch']) if (!exactKeys(permission[key], ['*']) || permission[key]['*'] !== 'deny') return OPENCODE_FAILURE;
	return exactKeys(permission.bash, ['*', ...npmValidationCommands, ...readOnlyGitCommands]) && permission.bash['*'] === 'deny' && equalEntries(Object.fromEntries(Object.entries(permission.bash).filter(([key]) => key !== '*')), [...npmValidationCommands, ...readOnlyGitCommands]) ? null : OPENCODE_FAILURE;
}

export function validateOpenCodeConfigText(text) {
	try { return validateOpenCodeConfig(parseOpenCodeJson(text)); } catch { return OPENCODE_FAILURE; }
}

const isOpenCodePath = (entry) => typeof entry === 'string' && entry.startsWith('.opencode/') && !entry.includes('..') && !entry.includes('\\');

export async function validateOpenCodeFilesystem({ root = repositoryRoot, stat = lstat, presentTrackedOpenCodePaths = [], requiredAbsentOpenCodePaths = [] } = {}) {
	try {
		const details = await stat(path.join(root, 'opencode.jsonc'));
		if (!details.isFile() || details.isSymbolicLink() || !Array.isArray(presentTrackedOpenCodePaths) || !Array.isArray(requiredAbsentOpenCodePaths) || ![...presentTrackedOpenCodePaths, ...requiredAbsentOpenCodePaths].every(isOpenCodePath)) return OPENCODE_FAILURE;
	} catch {
		return OPENCODE_FAILURE;
	}
	for (const entry of [...presentTrackedOpenCodePaths, ...requiredAbsentOpenCodePaths]) {
		try { await stat(path.join(root, entry)); return OPENCODE_FAILURE; } catch (error) { if (error?.code !== 'ENOENT') return OPENCODE_FAILURE; }
	}
	return null;
}

export async function validateOpenCodeGovernance({ root = repositoryRoot, readText = (file) => readFile(file, 'utf8'), stat, presentTrackedOpenCodePaths, requiredAbsentOpenCodePaths = [] } = {}) {
	let text;
	try { text = await readText(path.join(root, 'opencode.jsonc')); } catch { return OPENCODE_FAILURE; }
	if (validateOpenCodeConfigText(text)) return OPENCODE_FAILURE;
	return validateOpenCodeFilesystem({ root, stat, presentTrackedOpenCodePaths, requiredAbsentOpenCodePaths });
}

export async function main(argumentsList = process.argv.slice(2)) {
	if (argumentsList.length !== 0 || await validateOpenCodeGovernance()) { process.stderr.write(`OpenCode governance validation failed: ${OPENCODE_FAILURE}\n`); return 1; }
	process.stdout.write('OpenCode governance valid.\n'); return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) process.exitCode = await main();
