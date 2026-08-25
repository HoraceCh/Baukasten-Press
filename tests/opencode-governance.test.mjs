import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { opencodeConfigPath, parseOpenCodeJson, validateOpenCodeConfigText, validateOpenCodeFilesystem, validateOpenCodeGovernance } from '../scripts/validate-opencode-governance.mjs';

const canonical = await readFile(opencodeConfigPath, 'utf8');
const canary = 'BAP61_SECRET_NEVER_ECHO';

test('the project OpenCode configuration is strict, execution-only, and valid', async () => {
	assert.equal(validateOpenCodeConfigText(canonical), null);
	assert.equal(await validateOpenCodeGovernance(), null);
	assert.throws(() => parseOpenCodeJson('{"permission":{},"permission":{}}'));
	assert.throws(() => parseOpenCodeJson('{"permi\\u0073sion":{}}'));
});

test('noncanonical ownership, provider authority, and hidden top-level authority fail closed', () => {
	for (const addition of [',"agents":{"rogue":{}}', ',"models":{"x":"provider/model"}', ',"provider":{"network":true}', ',"mcp":{"external":{}}', ',"plugin":["remote"]', ',"$schema":"https://mutable.invalid/schema"']) {
		assert.equal(validateOpenCodeConfigText(canonical.replace(/\}\s*$/, `${addition}\n}`)), 'OPENCODE_GOVERNANCE_INVALID');
	}
});

test('wildcard Git, environment capability, and external-write permissions fail closed', () => {
	for (const replacement of ['"git *": "allow"', '"rtk git status*": "allow"']) assert.equal(validateOpenCodeConfigText(canonical.replace('"rtk git status": "allow"', replacement)), 'OPENCODE_GOVERNANCE_INVALID');
	assert.equal(validateOpenCodeConfigText(canonical.replace('"webfetch": {"*": "deny"}', '"webfetch": {"*": "allow"}')), 'OPENCODE_GOVERNANCE_INVALID');
	assert.equal(validateOpenCodeConfigText(canonical.replace('"websearch": {"*": "deny"}', '"websearch": {"*": "allow"}')), 'OPENCODE_GOVERNANCE_INVALID');
	for (const key of ['edit', 'task', 'skill']) for (const value of ['ask', 'allow']) assert.equal(validateOpenCodeConfigText(canonical.replace(`"${key}": {"*": "deny"}`, `"${key}": {"*": "${value}"}`)), 'OPENCODE_GOVERNANCE_INVALID');
	assert.equal(validateOpenCodeConfigText(canonical.replace('".env.*": "deny"', '".env.*": "allow"')), 'OPENCODE_GOVERNANCE_INVALID');
	assert.equal(validateOpenCodeConfigText(canonical.replace('"npm run lint": "allow"', '"node arbitrary-command": "allow"')), 'OPENCODE_GOVERNANCE_INVALID');
	assert.equal(validateOpenCodeConfigText(canonical.replace('"websearch": {"*": "deny"}', '"websearch": {"*": "deny"}, "unknown": {"*": "deny"}')), 'OPENCODE_GOVERNANCE_INVALID');
});

test('malformed config, tracked OMO override, and canary input fail without disclosure', async () => {
	assert.equal(validateOpenCodeConfigText(`{"permission": ${canary}`), 'OPENCODE_GOVERNANCE_INVALID');
	const regular = { isFile: () => true, isSymbolicLink: () => false };
	const absent = Object.assign(new Error('absent'), { code: 'ENOENT' });
	assert.equal(await validateOpenCodeFilesystem({ stat: async () => regular }), null);
	assert.equal(await validateOpenCodeFilesystem({ stat: async (file) => file.endsWith('opencode.jsonc') ? regular : Promise.reject(absent), requiredAbsentOpenCodePaths: ['.opencode/oh-my-openagent.jsonc'] }), null);
	assert.equal(await validateOpenCodeFilesystem({ stat: async () => ({ isFile: () => false, isSymbolicLink: () => false }) }), 'OPENCODE_GOVERNANCE_INVALID');
	assert.equal(await validateOpenCodeFilesystem({ stat: async () => ({ isFile: () => true, isSymbolicLink: () => true }) }), 'OPENCODE_GOVERNANCE_INVALID');
	for (const entry of ['.opencode/agent.toml', '.opencode/plugin.json', '.opencode/tool.json', '.opencode/skill.json', '.opencode/config.jsonc']) assert.equal(await validateOpenCodeFilesystem({ stat: async () => regular, presentTrackedOpenCodePaths: [entry] }), 'OPENCODE_GOVERNANCE_INVALID');
	const result = validateOpenCodeConfigText(`{"permission": {"${canary}": true}}`);
	assert.equal(result, 'OPENCODE_GOVERNANCE_INVALID');
	assert.equal(result.includes(canary), false);
});
