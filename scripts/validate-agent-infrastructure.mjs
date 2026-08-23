import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_AGENTS = new Map([
	['press_system_architect', { model: 'gpt-5.6-sol', reasoning: 'high', sandbox: 'read-only' }],
	['publication_contract_guardian', { model: 'gpt-5.6-sol', reasoning: 'high', sandbox: 'read-only' }],
	['agent_runtime_security_engineer', { model: 'gpt-5.6-sol', reasoning: 'high', sandbox: 'read-only' }],
	['press_app_implementer', { model: 'gpt-5.6-terra', reasoning: 'medium', sandbox: 'workspace-write' }],
	['qa_release_reviewer', { model: 'gpt-5.6-sol', reasoning: 'high', sandbox: 'read-only' }],
]);

const UPSTREAM_GENERIC_NAMES = new Set([
	'multi_agent_systems_architect', 'workflow_architect', 'prompt_engineer',
	'codebase_onboarding_engineer', 'code_reviewer', 'git_workflow_master',
	'minimal_change_engineer', 'developer_tooling_engineer', 'privacy_engineer',
	'ux_architect', 'persona_walkthrough_specialist', 'ui_finish_gate_reviewer',
	'experiment_tracker', 'test_results_analyzer', 'tool_evaluator', 'workflow_optimizer',
	'accessibility_auditor', 'test_automation_engineer', 'security_architect',
	'application_security_engineer', 'ai_generated_code_security_auditor',
	'secrets_credential_hygiene_engineer', 'agentic_identity_trust_architect',
	'model_qa_specialist', 'automation_governance_architect', 'evidence_collector',
	'reality_checker',
]);

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), '..');
const errors = [];

function repositoryPath(...segments) {
	const candidate = path.resolve(repositoryRoot, ...segments);
	const relative = path.relative(repositoryRoot, candidate);
	if (relative.startsWith('..') || path.isAbsolute(relative)) {
		throw new Error(`Validator path escapes repository: ${candidate}`);
	}
	return candidate;
}

async function readRepositoryText(...segments) {
	return readFile(repositoryPath(...segments), 'utf8');
}

function stringValue(text, key) {
	const match = text.match(new RegExp(`^${key}\\s*=\\s*"([^"\\r\\n]+)"\\s*$`, 'm'));
	return match?.[1] ?? null;
}

function sameMembers(actual, expected) {
	return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

let config;
let routing;
let agentsInstructions;
let modelUsage;
let adoption;

try {
	[config, routing, agentsInstructions, modelUsage, adoption] = await Promise.all([
		readRepositoryText('.codex', 'config.toml'),
		readRepositoryText('docs', 'AGENT_ROUTING.md'),
		readRepositoryText('AGENTS.md'),
		readRepositoryText('docs', 'CODEX_MODEL_USAGE.md'),
		readRepositoryText('docs', 'AGENCY_AGENTS_ADOPTION.md'),
	]);
} catch (error) {
	console.error(`Agent infrastructure validation could not read required files: ${error.message}`);
	process.exit(1);
}

const expectedNames = [...EXPECTED_AGENTS.keys()].sort();
const expectedFiles = expectedNames.map((name) => `${name}.toml`);
const actualFiles = (await readdir(repositoryPath('.codex', 'agents')))
	.filter((entry) => entry.endsWith('.toml'))
	.sort();

if (!sameMembers(actualFiles, expectedFiles)) {
	errors.push(`Expected agent TOMLs ${expectedFiles.join(', ')}; found ${actualFiles.join(', ') || 'none'}.`);
}
if (!/^\[agents\]\s*$/m.test(config)) {
	errors.push('.codex/config.toml is missing the [agents] table.');
}

const roleMatches = [...config.matchAll(/^\[agents\.([a-z][a-z0-9_]*)\]\s*$/gm)];
const registeredNames = roleMatches.map((match) => match[1]).sort();
if (!sameMembers(registeredNames, expectedNames)) {
	errors.push(`Config must register exactly ${expectedNames.join(', ')}; found ${registeredNames.join(', ') || 'none'}.`);
}

for (const [index, match] of roleMatches.entries()) {
	const name = match[1];
	const sectionStart = match.index + match[0].length;
	const nextSection = roleMatches[index + 1]?.index ?? config.length;
	const section = config.slice(sectionStart, nextSection);
	const referencedFile = stringValue(section, 'config_file')?.replaceAll('\\', '/');
	const expectedReference = `agents/${name}.toml`;
	if (referencedFile !== expectedReference) {
		errors.push(`Config role ${name} must reference ${expectedReference}; found ${referencedFile ?? 'no config_file'}.`);
	}
}

const seenAgentNames = new Set();
const governedTexts = [config, routing, agentsInstructions, modelUsage, adoption];

for (const [expectedName, expected] of EXPECTED_AGENTS) {
	let text;
	try {
		text = await readRepositoryText('.codex', 'agents', `${expectedName}.toml`);
	} catch (error) {
		errors.push(`Missing ${expectedName}.toml: ${error.message}`);
		continue;
	}

	governedTexts.push(text);
	const actualName = stringValue(text, 'name');
	const model = stringValue(text, 'model');
	const reasoning = stringValue(text, 'model_reasoning_effort');
	const sandbox = stringValue(text, 'sandbox_mode');

	if (!actualName) {
		errors.push(`${expectedName}.toml has no name.`);
	} else if (seenAgentNames.has(actualName)) {
		errors.push(`Duplicate agent name: ${actualName}.`);
	} else {
		seenAgentNames.add(actualName);
	}
	if (actualName !== expectedName) {
		errors.push(`${expectedName}.toml declares name ${actualName ?? 'missing'}.`);
	}
	if (UPSTREAM_GENERIC_NAMES.has(actualName)) {
		errors.push(`${expectedName}.toml registers upstream generic name ${actualName}.`);
	}
	if (model !== expected.model) {
		errors.push(`${expectedName}.toml must use model ${expected.model}; found ${model ?? 'missing'}.`);
	}
	if (reasoning !== expected.reasoning) {
		errors.push(`${expectedName}.toml must use reasoning ${expected.reasoning}; found ${reasoning ?? 'missing'}.`);
	}
	if (sandbox !== expected.sandbox) {
		errors.push(`${expectedName}.toml must use sandbox ${expected.sandbox}; found ${sandbox ?? 'missing'}.`);
	}
	if (!/^description\s*=\s*"[^"\r\n]+"\s*$/m.test(text)) {
		errors.push(`${expectedName}.toml has no single-line description.`);
	}
	if (!/^developer_instructions\s*=\s*"""[\s\S]+"""\s*$/m.test(text)) {
		errors.push(`${expectedName}.toml has no multiline developer_instructions.`);
	}
}

const EXPECTED_COMPLEXITY_SKILLS = new Map([
	['complexity-review', ['DietrichGebert/ponytail', 'v4.8.4', 'bc9ee949d5f439e8b9f3bb92c6d6d3d1e6ebd324', 'MIT', 'docs/AGENCY_AGENTS_ADOPTION.md', 'read-only by default', 'delete', 'stdlib', 'native', 'yagni', 'shrink', '"findings"', 'subordinate']],
	['complexity-audit', ['DietrichGebert/ponytail', 'v4.8.4', 'bc9ee949d5f439e8b9f3bb92c6d6d3d1e6ebd324', 'MIT', 'docs/AGENCY_AGENTS_ADOPTION.md', 'read-only by default', '"impact"', '"findings"', '"mutationsPerformed": 0', 'subordinate']],
]);

for (const [skillName, markers] of EXPECTED_COMPLEXITY_SKILLS) {
	let text;
	try {
		text = await readRepositoryText('.agents', 'skills', skillName, 'SKILL.md');
	} catch (error) {
		errors.push(`Missing .agents/skills/${skillName}/SKILL.md: ${error.message}`);
		continue;
	}

	governedTexts.push(text);
	if (!new RegExp(`^name:\\s*${skillName}\\s*$`, 'm').test(text)) {
		errors.push(`.agents/skills/${skillName}/SKILL.md frontmatter name mismatch.`);
	}
	if (!/^description:\s*\S/m.test(text)) {
		errors.push(`.agents/skills/${skillName}/SKILL.md has no description.`);
	}
	for (const marker of markers) {
		if (!text.includes(marker)) {
			errors.push(`.agents/skills/${skillName}/SKILL.md is missing required marker: ${marker}.`);
		}
	}
}

const routingOwnerReferences = new Set(
	[...routing.matchAll(/\b[a-z][a-z0-9_]*(?:architect|guardian|engineer|implementer|reviewer)\b/g)].map(
		(match) => match[0],
	),
);
for (const reference of routingOwnerReferences) {
	if (!EXPECTED_AGENTS.has(reference)) {
		errors.push(`Routing document names unregistered owner ${reference}.`);
	}
}
for (const name of EXPECTED_AGENTS.keys()) {
	if (!routing.includes(name)) {
		errors.push(`Routing document does not name registered owner ${name}.`);
	}
}

if (!/`baukasten-press-ui` remains the primary UI workflow and design authority\./.test(agentsInstructions)) {
	errors.push('AGENTS.md must keep baukasten-press-ui as the primary UI workflow and design authority.');
}

for (const pattern of ['~/.codex/agents', '~\\.codex\\agents', '$HOME/.codex/agents', '%USERPROFILE%\\.codex\\agents']) {
	if (governedTexts.some((text) => text.includes(pattern))) {
		errors.push(`Governance files must not introduce a user-level Agent installation instruction (${pattern}).`);
	}
}

if (errors.length > 0) {
	console.error('Agent infrastructure validation failed:');
	for (const error of errors) {
		console.error(`- ${error}`);
	}
	process.exit(1);
}

console.log(`Agent infrastructure valid: ${expectedNames.join(', ')}; complexity skills valid: ${[...EXPECTED_COMPLEXITY_SKILLS.keys()].join(', ')}`);
