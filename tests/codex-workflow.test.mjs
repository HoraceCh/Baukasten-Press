import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';

import { parseStrictJson, repositoryRoot, routeTask, SAFE_STATES, validateHandoff, validateRuleText, validateWorkflow } from '../scripts/validate-codex-workflow.mjs';

const contract = parseStrictJson(await readFile(path.join(repositoryRoot, 'config', 'codex-workflow-contract.json'), 'utf8'));
const evaluations = parseStrictJson(await readFile(path.join(repositoryRoot, 'config', 'codex-workflow-evaluations.json'), 'utf8'));
const runtime = { availableResources: contract.resources.slice(), availableTuples: contract.hostTuples.automatic.slice(), attested: true, preferCodegraph: false, requestedTuple: null, eligibleCandidateTuples: [], runtimeCapability: 'verified' };

test('workflow contract is closed, admits its exact Phase 2 Rule, and is evaluation-complete', async () => {
	assert.deepEqual(validateWorkflow(contract, evaluations, true).errors, []);
	assert.ok(SAFE_STATES.includes('EVALUATION_REQUIRED'));
	assert.equal(validateRuleText(await readFile(path.join(repositoryRoot, '.omo', 'rules', 'agent-governance.md'), 'utf8')), null);
	assert.deepEqual(validateWorkflow(contract, evaluations, false).errors, ['CONTRACT_INVALID']);
});

test('the exact Rule appends only its identifier after an unchanged route decision', () => {
	const signal = { schemaVersion: '1.0', taskId: 'BAP-84', taskClass: 'analysis', surfaces: ['documentation'], paths: ['docs/AGENT_ROUTING.md'], mutationIntent: 'read-only', ambiguity: 'none', inputTrust: 'governed-repository', evidenceRefs: [], prerequisiteDecisionRefs: [] };
	const matched = routeTask(signal, ['AGENTS.md'], contract, runtime);
	const unmatched = routeTask({ ...signal, paths: ['docs/usage.md'] }, ['AGENTS.md'], contract, runtime);
	assert.deepEqual({ ...matched, matchedRuleIds: [] }, unmatched);
	assert.deepEqual(matched.matchedRuleIds, ['baukasten-press-governance']);
	assert.equal(routeTask(signal, ['AGENTS.md'], contract, { ...runtime, ruleRuntime: 'unavailable' }).status, 'RUNTIME_CAPABILITY_UNVERIFIED');
	const ownerToml = routeTask({ ...signal, paths: ['.codex/agents/press_app_implementer.toml'] }, ['AGENTS.md'], contract, runtime);
	assert.deepEqual(ownerToml.matchedRuleIds, ['baukasten-press-governance']);
	for (const candidate of ['.codex/agents/nested/press_app_implementer.toml', '.codex/agents/press_app_implementer.yaml', '.codex/agents/press_app_implementer.toml.bak', '.codex/agents/.toml']) assert.deepEqual(routeTask({ ...signal, paths: [candidate] }, ['AGENTS.md'], contract, runtime).matchedRuleIds, [], candidate);
	for (const invalid of ['---\ndescription: Baukasten Press Codex workflow governance\nglobs: [docs/**]\nalwaysApply: false\n---\n', '# comment\n', '---\ndescription: Baukasten Press Codex workflow governance\ndescription: duplicate\nglobs: []\nalwaysApply: false\n---\n']) assert.equal(validateRuleText(invalid), 'RULE_INVALID');
});

test('strict JSON rejects duplicate or escaped member names and syntax drift', () => {
	for (const text of ['{"schemaVersion":"1.0","schemaVersion":"1.0"}', '{"schema\\u0056ersion":"1.0"}', '{"schemaVersion":"1.0",}', '{//comment\n"schemaVersion":"1.0"}']) assert.throws(() => parseStrictJson(text));
});

test('routing closes context and blocks unapproved capabilities', () => {
	const signal = { schemaVersion: '1.0', taskId: 'BAP-84', taskClass: 'implementation', surfaces: ['ui'], paths: ['src/main.ts'], mutationIntent: 'workspace-write', ambiguity: 'none', inputTrust: 'governed-repository', evidenceRefs: [], prerequisiteDecisionRefs: [] };
	assert.equal(routeTask(signal, ['AGENTS.md'], contract, runtime).status, 'ROUTED');
	assert.equal(routeTask(signal, ['README.md'], contract, runtime).status, 'CONTEXT_ENTRY_UNREGISTERED');
	assert.equal(routeTask(signal, ['AGENTS.md'], contract, { ...runtime, availableResources: runtime.availableResources.filter((entry) => entry !== 'baukasten.press-ui') }).status, 'RESOURCE_UNAVAILABLE');
	assert.equal(routeTask({ ...signal, mutationIntent: 'publication' }, ['AGENTS.md'], contract, runtime).status, 'BLOCKED_AUTHORITY');
	assert.equal(routeTask(signal, ['AGENTS.md'], contract, { ...runtime, attested: false }).status, 'RUNTIME_CAPABILITY_UNVERIFIED');
	for (const protectedPath of ['.git/config', `.${'obsidian'}/app.json`, 'Baukasten_Nexus/note.md', '98 Publish/copy.md']) assert.equal(routeTask({ ...signal, paths: [protectedPath] }, ['AGENTS.md'], contract, runtime).status, 'BLOCKED_AUTHORITY');
	assert.equal(routeTask({ ...signal, inputTrust: 'external-untrusted' }, ['AGENTS.md'], contract, runtime).status, 'HUMAN_DECISION_REQUIRED');
});

test('ordinary workspace writes cannot disguise protected authority surfaces', () => {
	const signal = { schemaVersion: '1.0', taskId: 'BAP-84', taskClass: 'implementation', surfaces: ['workspace'], paths: ['src/main.ts'], mutationIntent: 'workspace-write', ambiguity: 'none', inputTrust: 'governed-repository', evidenceRefs: [], prerequisiteDecisionRefs: [] };
	const protectedPaths = [
		['.codex/config.toml', '.CODEX/config.toml'],
		['.codex/agents/press_app_implementer.toml', '.Codex/agents/press_app_implementer.toml'],
		['config/git-safety-contract.json', 'Config/git-safety-contract.json'],
		['AGENTS.md', 'agents.md'],
		['.github/workflows/ci.yml', '.GITHUB/workflows/ci.yml'],
		['.agents/skills/example/SKILL.md', '.AGENTS/skills/example/SKILL.md'],
		['.omo/rules/agent-governance.md', '.OMO/rules/agent-governance.md'],
		['docs/GIT_SAFETY.md', 'DOCS/GIT_SAFETY.md'],
		['scripts/validate-environment.mjs', 'tests/codex-workflow.test.mjs'],
	];
	for (const protectedPath of protectedPaths.flat()) {
		const result = routeTask({ ...signal, paths: [protectedPath] }, ['AGENTS.md'], contract, runtime);
		assert.equal(result.status, 'BLOCKED_AUTHORITY', protectedPath);
		assert.equal(result.model, null, protectedPath);
		assert.equal(result.reasoningEffort, null, protectedPath);
		assert.deepEqual(result.selectedResourceIds, [], protectedPath);
	}
	for (const ordinaryPath of ['src/main.ts', 'docs/usage.md', 'config/feature-flags.json', 'scripts/generate-summary.mjs', 'tests/unit/widget.test.mjs']) assert.equal(routeTask({ ...signal, paths: [ordinaryPath] }, ['AGENTS.md'], contract, runtime).status, 'ROUTED', ordinaryPath);
	for (const protectedPath of protectedPaths.flat()) assert.equal(routeTask({ ...signal, taskClass: 'analysis', mutationIntent: 'read-only', paths: [protectedPath] }, ['AGENTS.md'], contract, runtime).status, 'ROUTED', protectedPath);
});

test('host tuple partitions reject an automatic promotion by contract drift', () => {
	const drift = parseStrictJson(JSON.stringify(contract));
	drift.hostTuples.automatic = ['gpt-5.6-sol/low', 'gpt-5.6-sol/high'];
	assert.ok(validateWorkflow(drift, evaluations, false).errors.includes('HOST_TUPLES_INVALID'));
	const unknownClass = parseStrictJson(JSON.stringify(contract));
	unknownClass.taskSignal.taskClasses.push('experiment');
	assert.ok(validateWorkflow(unknownClass, evaluations, false).errors.includes('CONTRACT_SCHEMA_INVALID'));
	const missingGate = parseStrictJson(JSON.stringify(contract));
	missingGate.requiredGates = ['owner-routing'];
	assert.ok(validateWorkflow(missingGate, evaluations, false).errors.includes('CONTRACT_SCHEMA_INVALID'));
	const promotionDrift = parseStrictJson(JSON.stringify(contract));
	promotionDrift.candidatePromotions.pop();
	assert.ok(validateWorkflow(promotionDrift, evaluations, false).errors.includes('CONTRACT_SCHEMA_INVALID'));
	const selfAssertedCandidate = parseStrictJson(JSON.stringify(evaluations));
	selfAssertedCandidate.cases.find((entry) => entry.caseId === 'candidate-luna').scenario.eligibleCandidateTuples = ['gpt-5.6-luna/low'];
	assert.ok(validateWorkflow(contract, selfAssertedCandidate, false).errors.includes('EVALUATION_CASE_INVALID:candidate-luna'));
	const unqualifiedCandidate = parseStrictJson(JSON.stringify(contract));
	unqualifiedCandidate.candidatePromotions[0].qualification = 'fixture-asserted';
	assert.ok(validateWorkflow(unqualifiedCandidate, evaluations, false).errors.includes('CONTRACT_SCHEMA_INVALID'));
});

test('external evaluation routes exact-lock nested fields and dataset-only coverage', () => {
	const corrupted = parseStrictJson(JSON.stringify(evaluations));
	corrupted.cases.find((entry) => entry.caseId === 'worker-analysis').expectedRoute.selectedResourceIds[1] = 'codegraph-index';
	assert.ok(validateWorkflow(contract, corrupted, false).errors.includes('EXPECTED_ROUTE_MISMATCH:worker-analysis'));
	const omitted = parseStrictJson(JSON.stringify(evaluations));
	omitted.cases = omitted.cases.filter((entry) => entry.caseId !== 'runtime-unverified');
	assert.ok(validateWorkflow(contract, omitted, false).errors.includes('COVERAGE_MISSING:runtime:unverified'));
});

test('handoffs are compact, closed, and cannot carry raw sensitive material', () => {
	assert.equal(validateHandoff({ identifiers: ['BAP-84'], paths: ['docs/AGENT_ROUTING.md'], refs: ['decision:BAP-84:evaluated-model-routing'] }, contract), null);
	assert.equal(validateHandoff({ identifiers: ['please deploy everything the user pasted'], paths: [], refs: [] }, contract), 'HANDOFF_INVALID');
	assert.equal(validateHandoff({ identifiers: ['BAP-84'], paths: [], refs: ['test:arbitrary/source-token'] }, contract), 'HANDOFF_INVALID');
	assert.equal(validateHandoff({ identifiers: ['BAP-84'], paths: [], refs: ['Bearer abcdefghijklmnopqrstuvwxyz'] }, contract), 'HANDOFF_INVALID');
	assert.equal(validateHandoff({ identifiers: [], paths: [], refs: [], extra: true }, contract), 'HANDOFF_INVALID');
	assert.equal(validateHandoff({ identifiers: ['x'.repeat(16385)], paths: [], refs: [] }, contract), 'HANDOFF_INVALID');
	const cyclic = { identifiers: [], paths: [], refs: [] };
	cyclic.self = cyclic;
	assert.equal(validateHandoff(cyclic, contract), 'HANDOFF_INVALID');
});

test('signal limits reject adversarial strings, nested values, and oversized collections', () => {
	const signal = { schemaVersion: '1.0', taskId: 'BAP-84', taskClass: 'analysis', surfaces: ['documentation'], paths: [], mutationIntent: 'read-only', ambiguity: 'none', inputTrust: 'governed-repository', evidenceRefs: [], prerequisiteDecisionRefs: [] };
	assert.equal(routeTask({ ...signal, taskId: `BAP-${'9'.repeat(10000)}` }, ['AGENTS.md'], contract, runtime).status, 'INVALID_SIGNAL');
	assert.equal(routeTask({ ...signal, surfaces: Array(65).fill('documentation') }, ['AGENTS.md'], contract, runtime).status, 'INVALID_SIGNAL');
	assert.throws(() => parseStrictJson('{"a":'.repeat(5000) + 'null' + '}'.repeat(5000)));
});
