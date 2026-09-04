import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
export const repositoryRoot = path.resolve(path.dirname(scriptPath), '..');
const SIGNAL_KEYS = ['schemaVersion', 'taskId', 'taskClass', 'surfaces', 'paths', 'mutationIntent', 'ambiguity', 'inputTrust', 'evidenceRefs', 'prerequisiteDecisionRefs'];
const OUTPUT_KEYS = ['status', 'primaryOwner', 'serialHandoffs', 'capabilityTier', 'model', 'reasoningEffort', 'sandboxCeiling', 'selectedResourceIds', 'matchedRuleIds', 'requiredGates', 'decisionReasons', 'fallbackTrace'];
const CASE_KEYS = ['caseId', 'signal', 'trustedContext', 'scenario', 'coverageTags', 'expectedRoute'];
const SCENARIO_KEYS = ['availableResources', 'availableTuples', 'attested', 'preferCodegraph', 'requestedTuple', 'eligibleCandidateTuples', 'runtimeCapability'];
const AUTOMATIC = ['gpt-5.6-terra/medium', 'gpt-5.6-sol/high'];
const CANDIDATES = ['gpt-5.6-luna/low', 'gpt-5.6-sol/medium'];
const EVALUATION_ONLY = ['gpt-5.6-sol/low', 'gpt-5.6-sol/xhigh', 'gpt-5.6-sol/max', 'gpt-5.6-sol/ultra', 'gpt-5.6-terra/low', 'gpt-5.6-terra/high', 'gpt-5.6-terra/xhigh', 'gpt-5.6-terra/max', 'gpt-5.6-terra/ultra', 'gpt-5.6-luna/medium', 'gpt-5.6-luna/high', 'gpt-5.6-luna/xhigh', 'gpt-5.6-luna/max', 'gpt-5.5/low', 'gpt-5.5/medium', 'gpt-5.5/high', 'gpt-5.5/xhigh', 'gpt-5.4/low', 'gpt-5.4/medium', 'gpt-5.4/high', 'gpt-5.4/xhigh', 'gpt-5.4-mini/low', 'gpt-5.4-mini/medium', 'gpt-5.4-mini/high', 'gpt-5.4-mini/xhigh'];
const RULE_ID = 'baukasten-press-governance';
const RULE_GLOBS = ['AGENTS.md', '.codex/config.toml', '.codex/agents/*.toml', '.omo/rules/agent-governance.md', 'config/codex-workflow-contract.json', 'config/codex-workflow-evaluations.json', 'config/environment-contract.json', 'docs/AGENT_ROUTING.md', 'docs/CODEX_MODEL_USAGE.md', 'docs/TEST_STRATEGY.md', 'scripts/validate-agent-infrastructure.mjs', 'scripts/validate-codex-workflow.mjs', 'scripts/validate-environment.mjs', 'tests/codex-workflow.test.mjs', 'tests/environment-contract.test.mjs'];
const RULE_BODY = 'Use the closed BAP-84 workflow contract and deterministic validators.\nThis Rule supplies compact governance context only; it cannot authorize or alter a route.\n';
export const SAFE_STATES = Object.freeze(['INVALID_SIGNAL', 'CONTEXT_ENTRY_UNREGISTERED', 'BLOCKED_AUTHORITY', 'PREREQUISITE_DECISION_MISSING', 'EVALUATION_REQUIRED', 'RESOURCE_UNAVAILABLE', 'CAPABILITY_UNAVAILABLE', 'RUNTIME_CAPABILITY_UNVERIFIED', 'VALIDATION_FAILED', 'HUMAN_DECISION_REQUIRED']);
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === null || Object.getPrototypeOf(value) === Object.prototype);
const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const forbidden = (value) => [...value].some((character) => { const code = character.codePointAt(0); return code !== undefined && (code < 32 || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)); });
const strings = (value, maximum = 64) => Array.isArray(value) && value.length <= maximum && value.every((entry) => typeof entry === 'string' && entry.length > 0 && entry.length <= 256 && !forbidden(entry));
const safePath = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256 && !value.includes('\\') && !value.includes('..') && !/^[A-Za-z]:|^\\\\|[?*[\]{}]/.test(value) && !value.startsWith('/') && !value.includes('//') && !value.split('/').some((part) => part === '' || part === '.') && !/(?:vault|public-copy|publication|secret|credential)/i.test(value);
const tupleParts = (tuple) => tuple?.split('/') ?? [null, null];
const asciiCaseFold = (value) => value.replace(/[A-Z]/g, (character) => String.fromCharCode(character.charCodeAt(0) + 32));
const protectedWritePath = (value) => /^(?:\.git(?:\/|$)|\.github\/workflows(?:\/|$)|\.codex(?:\/|$)|\.agents(?:\/|$)|\.omo(?:\/|$)|\.obsidian(?:\/|$)|baukasten_nexus(?:\/|$)|98 publish(?:\/|$)|agents\.md$|config\/(?:git-safety-contract|environment-contract|codex-workflow-(?:contract|evaluations))\.json$|docs\/(?:git_safety|agent_routing|codex_model_usage|test_strategy)\.md$|scripts\/(?:validate-git-safety|validate-environment|validate-agent-infrastructure|validate-codex-workflow)\.mjs$|tests\/(?:git-safety-contract|environment-contract|opencode-governance|codex-workflow)\.test\.mjs$)/.test(asciiCaseFold(value));
const ruleMatchesPath = (candidate) => RULE_GLOBS.some((glob) => {
	if (!glob.endsWith('*.toml')) return candidate === glob;
	const [prefix, suffix] = glob.split('*');
	const filename = candidate.slice(prefix.length, candidate.length - suffix.length);
	return candidate.startsWith(prefix) && candidate.endsWith(suffix) && filename.length > 0 && !filename.includes('/');
});

export function validateRuleText(text) {
	if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 4096 || forbidden(text.replaceAll('\n', '').replaceAll('\r', '').replaceAll('\t', ''))) return 'RULE_INVALID';
	const normalized = text.replaceAll('\r\n', '\n');
	const frontmatter = `---\ndescription: Baukasten Press Codex workflow governance\nglobs:\n${RULE_GLOBS.map((glob) => `  - ${glob}\n`).join('')}alwaysApply: false\n---\n\n`;
	return normalized === `${frontmatter}${RULE_BODY}` ? null : 'RULE_INVALID';
}

export function parseStrictJson(text) {
	if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 262144 || (text.match(/[[{]/g)?.length ?? 0) > 4096 || forbidden(text.replaceAll('\n', '').replaceAll('\r', '').replaceAll('\t', ''))) throw new Error('JSON_INVALID');
	let cursor = 0;
	const fail = () => { throw new Error('JSON_INVALID'); };
	const skip = () => { while (/[\t\n\r ]/.test(text[cursor] ?? '')) cursor += 1; };
	const string = (name = false) => { if (text[cursor] !== '"') fail(); const start = cursor++; let escaped = false; while (cursor < text.length) { const character = text[cursor++]; if (character === '"' && !escaped) { const raw = text.slice(start, cursor); if (name && raw.includes('\\')) fail(); try { return JSON.parse(raw); } catch { fail(); } } escaped = character === '\\' && !escaped; } fail(); };
	const value = () => { skip(); if (text[cursor] === '{') { cursor += 1; skip(); const result = Object.create(null); const names = new Set(); if (text[cursor] === '}') { cursor += 1; return result; } while (true) { skip(); const name = string(true); if (names.has(name)) fail(); names.add(name); skip(); if (text[cursor++] !== ':') fail(); result[name] = value(); skip(); if (text[cursor] === '}') { cursor += 1; return result; } if (text[cursor++] !== ',') fail(); } } if (text[cursor] === '[') { cursor += 1; skip(); const result = []; if (text[cursor] === ']') { cursor += 1; return result; } while (true) { result.push(value()); skip(); if (text[cursor] === ']') { cursor += 1; return result; } if (text[cursor++] !== ',') fail(); } } if (text[cursor] === '"') return string(); const literal = text.slice(cursor).match(/^(true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/)?.[0]; if (!literal) fail(); cursor += literal.length; return JSON.parse(literal); };
	const result = value(); skip(); if (cursor !== text.length) fail(); return result;
}

export function validateSignal(signal, contract) {
	if (!exact(signal, SIGNAL_KEYS) || signal.schemaVersion !== '1.0' || typeof signal.taskId !== 'string' || !/^BAP-[1-9][0-9]{0,5}$/.test(signal.taskId) || !contract.taskSignal.taskClasses.includes(signal.taskClass) || !strings(signal.surfaces, 8) || signal.surfaces.length === 0 || new Set(signal.surfaces).size !== signal.surfaces.length || !signal.surfaces.every((entry) => contract.taskSignal.surfaces.includes(entry)) || !strings(signal.paths, 32) || !signal.paths.every(safePath) || (['implementation', 'mechanical', 'final-review'].includes(signal.taskClass) && signal.paths.length === 0) || !contract.taskSignal.mutationIntents.includes(signal.mutationIntent) || !contract.taskSignal.ambiguity.includes(signal.ambiguity) || !contract.taskSignal.inputTrust.includes(signal.inputTrust) || !strings(signal.evidenceRefs) || !strings(signal.prerequisiteDecisionRefs) || !signal.prerequisiteDecisionRefs.every((entry) => /^decision:BAP-[1-9][0-9]{0,5}:[a-z0-9-]{1,64}$/.test(entry))) return 'INVALID_SIGNAL';
	return null;
}

export function validateHandoff(payload, contract) {
	let encoded;
	try { encoded = JSON.stringify(payload); } catch { return 'HANDOFF_INVALID'; }
	const identifiers = (value) => strings(value, 32) && value.every((entry) => /^BAP-[1-9][0-9]{0,5}$/.test(entry) || contract.owners.includes(entry) || contract.resources.includes(entry) || /^gpt-[a-z0-9.-]+\/(?:low|medium|high|xhigh|max|ultra)$/.test(entry));
	const handoffPath = (value) => safePath(value) && /^(?:AGENTS\.md|(?:docs|config|scripts|tests|\.codex)\/[A-Za-z0-9._/-]+)$/.test(value);
	const refs = (value) => strings(value, 32) && value.every((entry) => /^(?:evidence:BAP-84:[a-z0-9-]{1,64}|decision:BAP-84:[a-z0-9-]{1,64}|commit:[0-9a-f]{7,40}|test:BAP-84:[a-z0-9-]{1,64})$/.test(entry));
	if (!plain(payload) || Buffer.byteLength(encoded, 'utf8') > contract.handoff.maximumBytes || !exact(payload, ['identifiers', 'paths', 'refs']) || !identifiers(payload.identifiers) || !strings(payload.paths, 32) || !payload.paths.every(handoffPath) || !refs(payload.refs)) return 'HANDOFF_INVALID';
	return null;
}

function route(status, owner = null, tier = null, tuple = null, sandbox = 'read-only', resources = [], gates = ['owner-routing'], reasons = [status], fallback = []) { const [model, reasoningEffort] = tupleParts(tuple); return { status, primaryOwner: owner, serialHandoffs: status === 'ROUTED' && owner === 'press_app_implementer' ? ['qa_release_reviewer'] : [], capabilityTier: tier, model, reasoningEffort, sandboxCeiling: sandbox, selectedResourceIds: resources, matchedRuleIds: [], requiredGates: gates, decisionReasons: reasons, fallbackTrace: fallback }; }
function validateScenario(value, contract) { const keys = Object.hasOwn(value ?? {}, 'ruleRuntime') ? [...SCENARIO_KEYS, 'ruleRuntime'] : SCENARIO_KEYS; return exact(value, keys) && strings(value.availableResources, 32) && value.availableResources.every((id) => contract.resources.includes(id)) && strings(value.availableTuples, 32) && value.availableTuples.every((tuple) => [...AUTOMATIC, ...CANDIDATES].includes(tuple)) && typeof value.attested === 'boolean' && typeof value.preferCodegraph === 'boolean' && (value.requestedTuple === null || typeof value.requestedTuple === 'string') && Array.isArray(value.eligibleCandidateTuples) && value.eligibleCandidateTuples.length === 0 && ['verified', 'invalid'].includes(value.runtimeCapability) && (!Object.hasOwn(value, 'ruleRuntime') || ['available', 'unavailable'].includes(value.ruleRuntime)); }
function ownerFor(signal) { if (signal.taskClass === 'final-review') return 'qa_release_reviewer'; if (signal.surfaces.includes('publication')) return 'publication_contract_guardian'; if (signal.surfaces.includes('agent-runtime')) return 'agent_runtime_security_engineer'; if (signal.surfaces.includes('workflow-topology') || signal.surfaces.includes('git-policy')) return 'press_system_architect'; if (['implementation', 'mechanical'].includes(signal.taskClass) && signal.mutationIntent === 'workspace-write') return 'press_app_implementer'; return 'press_system_architect'; }
function defaultScenario(contract) { return { availableResources: contract.resources.slice(), availableTuples: AUTOMATIC.slice(), attested: true, preferCodegraph: false, requestedTuple: null, eligibleCandidateTuples: [], runtimeCapability: 'verified' }; }

export function routeTask(signal, context, contract, scenario = defaultScenario(contract)) {
	const invalid = validateSignal(signal, contract); if (invalid) return route('INVALID_SIGNAL');
	if (!strings(context, 16) || !context.every((entry) => contract.trustedContext.includes(entry))) return route('CONTEXT_ENTRY_UNREGISTERED');
	if (!signal.evidenceRefs.every((entry) => contract.registeredEvidenceRefs.includes(entry)) || !signal.prerequisiteDecisionRefs.every((entry) => contract.settledDecisions.includes(entry))) return route('PREREQUISITE_DECISION_MISSING');
	if (signal.ambiguity === 'declared') return route('HUMAN_DECISION_REQUIRED');
	const owner = ownerFor(signal); if (['git-mutation', 'external-write', 'vault-write', 'publication', 'provider-call', 'credential-access'].includes(signal.mutationIntent)) return route('BLOCKED_AUTHORITY', owner);
	if (signal.mutationIntent === 'workspace-write' && signal.paths.some(protectedWritePath)) return route('BLOCKED_AUTHORITY', owner);
	if (['repository-untrusted', 'external-untrusted', 'mixed-untrusted'].includes(signal.inputTrust) && signal.mutationIntent !== 'read-only') return route('HUMAN_DECISION_REQUIRED');
	if (!validateScenario(scenario, contract) || scenario.runtimeCapability === 'invalid') return route('VALIDATION_FAILED');
	if (contract.rule.enabled && scenario.ruleRuntime === 'unavailable') return route('RUNTIME_CAPABILITY_UNVERIFIED', owner);
	const tier = owner === 'press_app_implementer' ? 'engineering-synthesizer' : owner === 'press_system_architect' && signal.taskClass === 'analysis' ? 'worker' : 'judge'; const automatic = tier === 'engineering-synthesizer' ? AUTOMATIC[0] : AUTOMATIC[1]; const requested = scenario.requestedTuple ?? automatic;
	if (EVALUATION_ONLY.includes(requested)) return route('EVALUATION_REQUIRED', owner, tier, null, 'read-only', [], ['owner-routing', 'evaluation-promotion'], ['EVALUATION_ONLY_TUPLE']);
	if (CANDIDATES.includes(requested) && !contract.candidatePromotions?.some((record) => record.tuple === requested && record.evidenceRef === 'evidence:BAP-84:phase-1' && record.decisionRef === 'decision:BAP-84:evaluated-model-routing' && record.qualification === 'governed-promotion-v1')) return route('EVALUATION_REQUIRED', owner, tier, null, 'read-only', [], ['owner-routing', 'evaluation-promotion'], ['CANDIDATE_NOT_ELIGIBLE']);
	if (![...AUTOMATIC, ...CANDIDATES].includes(requested)) return route('CAPABILITY_UNAVAILABLE', owner, tier, null, 'read-only', [], ['owner-routing'], ['REQUESTED_TUPLE_UNKNOWN']);
	if (!scenario.availableTuples.includes(requested)) return route('CAPABILITY_UNAVAILABLE', owner, tier, null, 'read-only', [], ['owner-routing'], ['REQUESTED_TUPLE_UNAVAILABLE']);
	if (!scenario.attested) return route('RUNTIME_CAPABILITY_UNVERIFIED', owner, tier, requested, 'read-only', [], ['owner-routing'], ['RUNTIME_UNATTESTED']);
	if (!scenario.availableResources.includes('repository-contracts') || !scenario.availableResources.includes('node-governance-validator')) return route('RESOURCE_UNAVAILABLE', owner, tier, requested, 'read-only', [], ['owner-routing'], ['REQUIRED_RESOURCE_UNAVAILABLE']);
	const resources = ['repository-contracts']; const fallback = []; if (scenario.preferCodegraph && scenario.availableResources.includes('codegraph-index')) resources.push('codegraph-index'); else { if (!scenario.availableResources.includes('rtk-readonly')) return route('RESOURCE_UNAVAILABLE', owner, tier, requested, 'read-only', resources, ['owner-routing'], ['RTK_RESOURCE_UNAVAILABLE']); resources.push('rtk-readonly'); if (scenario.preferCodegraph) fallback.push('FALLBACK_CODEGRAPH_TO_RTK'); }
	resources.push('node-governance-validator', `tuple:${requested}`); if (!scenario.availableResources.includes(`tuple:${requested}`)) return route('CAPABILITY_UNAVAILABLE', owner, tier, null, 'read-only', resources, ['owner-routing'], ['TUPLE_RESOURCE_UNAVAILABLE'], fallback);
	if (signal.surfaces.includes('ui')) { if (!scenario.availableResources.includes('baukasten.press-ui')) return route('RESOURCE_UNAVAILABLE', owner, tier, requested, 'read-only', resources, ['owner-routing'], ['UI_RESOURCE_UNAVAILABLE'], fallback); resources.push('baukasten.press-ui'); }
	const reason = owner === 'press_system_architect' ? 'OWNER_ARCHITECTURE' : owner === 'publication_contract_guardian' ? 'OWNER_PUBLICATION' : owner === 'agent_runtime_security_engineer' ? 'OWNER_RUNTIME' : owner === 'press_app_implementer' ? 'OWNER_IMPLEMENTATION' : 'OWNER_REVIEW'; const gates = owner === 'press_app_implementer' ? ['owner-routing', 'independent-qa'] : ['owner-routing'];
	const result = route('ROUTED', owner, tier, requested, tier === 'engineering-synthesizer' ? 'workspace-write' : 'read-only', resources, gates, [reason, CANDIDATES.includes(requested) ? 'CANDIDATE_EVALUATED' : 'AUTOMATIC_TUPLE'], fallback);
	return contract.rule.enabled && signal.paths.some(ruleMatchesPath) ? { ...result, matchedRuleIds: [RULE_ID] } : result;
}
function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
const sameArray = (actual, expected) => Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
function contractSchemaValid(contract) {
	return exact(contract.taskSignal, ['keys', 'taskClasses', 'surfaces', 'mutationIntents', 'ambiguity', 'inputTrust'])
		&& sameArray(contract.taskSignal.keys, SIGNAL_KEYS)
		&& sameArray(contract.taskSignal.taskClasses, ['analysis', 'contract', 'implementation', 'mechanical', 'final-review'])
		&& sameArray(contract.taskSignal.surfaces, ['workflow-topology', 'git-policy', 'publication', 'agent-runtime', 'workspace', 'ui', 'tests', 'documentation'])
		&& sameArray(contract.taskSignal.mutationIntents, ['read-only', 'workspace-write', 'git-mutation', 'external-write', 'vault-write', 'publication', 'provider-call', 'credential-access'])
		&& sameArray(contract.taskSignal.ambiguity, ['none', 'declared'])
		&& sameArray(contract.taskSignal.inputTrust, ['governed-repository', 'operator-supplied', 'repository-untrusted', 'external-untrusted', 'mixed-untrusted'])
		&& sameArray(contract.routeOutput, OUTPUT_KEYS)
		&& exact(contract.tiers, ['worker', 'engineering-synthesizer', 'judge']) && contract.tiers.worker === 'read-only' && contract.tiers['engineering-synthesizer'] === 'workspace-write' && contract.tiers.judge === 'read-only'
		&& exact(contract.hostTuples, ['automatic', 'candidates', 'evaluationOnly']) && sameArray(contract.hostTuples.automatic, AUTOMATIC) && sameArray(contract.hostTuples.candidates, CANDIDATES) && sameArray(contract.hostTuples.evaluationOnly, EVALUATION_ONLY)
		&& sameArray(contract.requiredGates, ['owner-routing', 'independent-qa', 'evaluation-promotion'])
		&& exact(contract.handoff, ['maximumBytes', 'allowed']) && contract.handoff.maximumBytes === 16384 && sameArray(contract.handoff.allowed, ['identifiers', 'paths', 'refs'])
		&& exact(contract.rule, ['enabled', 'path']) && contract.rule.path === '.omo/rules/agent-governance.md'
		&& strings(contract.resources, 32) && new Set(contract.resources).size === contract.resources.length
		&& strings(contract.decisionCodes, 64) && new Set(contract.decisionCodes).size === contract.decisionCodes.length && SAFE_STATES.every((state) => contract.decisionCodes.includes(state))
		&& strings(contract.fallbackCodes, 8) && sameArray(contract.fallbackCodes, ['FALLBACK_CODEGRAPH_TO_RTK'])
		&& strings(contract.evaluationCoverage, 128) && new Set(contract.evaluationCoverage).size === contract.evaluationCoverage.length
		&& Array.isArray(contract.candidatePromotions) && sameArray(contract.candidatePromotions.map((record) => record.tuple), CANDIDATES)
		&& contract.candidatePromotions.every((record) => exact(record, ['tuple', 'caseId', 'evidenceRef', 'decisionRef', 'qualification']) && /^candidate-(?:luna|sol)$/.test(record.caseId) && record.evidenceRef === 'evidence:BAP-84:phase-1' && record.decisionRef === 'decision:BAP-84:evaluated-model-routing' && record.qualification === 'governed-promotion-v1');
}
function routeSchemaValid(routeValue, contract) {
	const tuples = [...AUTOMATIC, ...CANDIDATES];
	return exact(routeValue, OUTPUT_KEYS) && (routeValue.status === 'ROUTED' || SAFE_STATES.includes(routeValue.status))
		&& (routeValue.primaryOwner === null || contract.owners.includes(routeValue.primaryOwner))
		&& Array.isArray(routeValue.serialHandoffs) && routeValue.serialHandoffs.every((owner) => contract.owners.includes(owner))
		&& (routeValue.capabilityTier === null || Object.hasOwn(contract.tiers, routeValue.capabilityTier))
		&& (routeValue.model === null || typeof routeValue.model === 'string') && (routeValue.reasoningEffort === null || ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(routeValue.reasoningEffort))
		&& (routeValue.model === null ? routeValue.reasoningEffort === null : tuples.includes(`${routeValue.model}/${routeValue.reasoningEffort}`))
		&& ['read-only', 'workspace-write'].includes(routeValue.sandboxCeiling)
		&& strings(routeValue.selectedResourceIds, 32) && routeValue.selectedResourceIds.every((id) => contract.resources.includes(id))
		&& Array.isArray(routeValue.matchedRuleIds) && routeValue.matchedRuleIds.length <= 1 && routeValue.matchedRuleIds.every((entry) => entry === RULE_ID)
		&& strings(routeValue.requiredGates, 8) && routeValue.requiredGates.every((gate) => contract.requiredGates.includes(gate))
		&& strings(routeValue.decisionReasons, 8) && routeValue.decisionReasons.every((code) => contract.decisionCodes.includes(code))
		&& strings(routeValue.fallbackTrace, 8) && routeValue.fallbackTrace.every((code) => contract.fallbackCodes.includes(code));
}
export function deriveCoverageTags(contract, entry, actual) {
	const tags = new Set([`class:${entry.signal.taskClass}`, `status:${actual.status}`]);
	if (actual.primaryOwner) tags.add(`owner:${actual.primaryOwner}`);
	if (actual.model && actual.reasoningEffort) {
		const tuple = `${actual.model}/${actual.reasoningEffort}`;
		if (AUTOMATIC.includes(tuple)) tags.add(`automatic:${tuple}`);
		if (CANDIDATES.includes(tuple)) tags.add(`candidate:${tuple}`);
	}
	if (actual.decisionReasons.includes('EVALUATION_ONLY_TUPLE')) tags.add('evaluation-only');
	if (actual.selectedResourceIds.includes('repository-contracts')) tags.add('resource:repository-contracts');
	if (actual.selectedResourceIds.includes('codegraph-index')) tags.add('resource:codegraph');
	if (actual.fallbackTrace.includes('FALLBACK_CODEGRAPH_TO_RTK')) tags.add('fallback:codegraph-to-rtk');
	if (actual.status === 'RESOURCE_UNAVAILABLE') tags.add('resource:unavailable');
	if (actual.status === 'CAPABILITY_UNAVAILABLE') tags.add('capability:unavailable');
	if (actual.status === 'RUNTIME_CAPABILITY_UNVERIFIED') tags.add('runtime:unverified');
	if (actual.serialHandoffs.includes('qa_release_reviewer')) tags.add('handoff:implementation-to-qa');
	if (actual.matchedRuleIds.length === 0) tags.add('rule:absent'); else tags.add('rule:matched');
	return tags;
}

export function validateWorkflow(contract, evaluations, ruleDirectoryPresent = false) {
	const errors = [];
	if (!exact(contract, ['schemaVersion', 'contractVersion', 'enabled', 'owners', 'taskSignal', 'routeOutput', 'tiers', 'hostTuples', 'resources', 'registeredEvidenceRefs', 'settledDecisions', 'trustedContext', 'requiredGates', 'decisionCodes', 'fallbackCodes', 'handoff', 'rule', 'evaluationCoverage', 'candidatePromotions']) || contract.schemaVersion !== '1.0' || contract.contractVersion !== '1.0' || typeof contract.enabled !== 'boolean' || (!contract.enabled && ruleDirectoryPresent) || (contract.enabled && !ruleDirectoryPresent) || contract.rule?.enabled !== contract.enabled || contract.rule?.path !== '.omo/rules/agent-governance.md') errors.push('CONTRACT_INVALID');
	if (!sameArray(contract.owners, ['press_system_architect', 'publication_contract_guardian', 'agent_runtime_security_engineer', 'press_app_implementer', 'qa_release_reviewer']) || !contractSchemaValid(contract)) errors.push('CONTRACT_SCHEMA_INVALID');
	const tuples = [...contract.hostTuples.automatic, ...contract.hostTuples.candidates, ...contract.hostTuples.evaluationOnly]; if (new Set(tuples).size !== tuples.length || contract.hostTuples.automatic.join(',') !== AUTOMATIC.join(',') || contract.hostTuples.candidates.join(',') !== CANDIDATES.join(',') || contract.hostTuples.evaluationOnly.join(',') !== EVALUATION_ONLY.join(',')) errors.push('HOST_TUPLES_INVALID');
	if (!exact(evaluations, ['schemaVersion', 'contractVersion', 'evaluationVersion', 'cases', 'promotionRecords']) || evaluations.schemaVersion !== '1.0' || evaluations.contractVersion !== contract.contractVersion || evaluations.evaluationVersion !== '1.0' || !Array.isArray(evaluations.cases) || !Array.isArray(evaluations.promotionRecords) || evaluations.promotionRecords.length !== 0) errors.push('EVALUATIONS_INVALID');
	const coverage = new Set(); const owners = new Set(); const states = new Set();
	const executed = new Map(); for (const entry of evaluations.cases ?? []) { if (!exact(entry, CASE_KEYS) || typeof entry.caseId !== 'string' || !/^[a-z0-9-]{1,64}$/.test(entry.caseId) || !strings(entry.trustedContext, 16) || !validateScenario(entry.scenario, contract) || !strings(entry.coverageTags, 32) || !routeSchemaValid(entry.expectedRoute, contract)) { errors.push(`EVALUATION_CASE_INVALID:${entry.caseId ?? 'unknown'}`); continue; } const actual = routeTask(entry.signal, entry.trustedContext, contract, entry.scenario); if (!routeSchemaValid(actual, contract) || !equal(entry.expectedRoute, actual)) { errors.push(`EXPECTED_ROUTE_MISMATCH:${entry.caseId}`); continue; } const derived = [...deriveCoverageTags(contract, entry, actual)].sort(); if (!sameArray([...entry.coverageTags].sort(), derived)) { errors.push(`COVERAGE_TAG_MISMATCH:${entry.caseId}`); continue; } executed.set(entry.caseId, actual); for (const tag of derived) coverage.add(tag); owners.add(actual.primaryOwner); states.add(actual.status); }
	for (const promotion of contract.candidatePromotions ?? []) { const actual = executed.get(promotion.caseId); if (!actual || actual.status !== 'ROUTED' || `${actual.model}/${actual.reasoningEffort}` !== promotion.tuple) errors.push(`CANDIDATE_PROMOTION_UNPROVEN:${promotion.tuple}`); }
	for (const tag of contract.evaluationCoverage ?? []) if (!coverage.has(tag)) errors.push(`COVERAGE_MISSING:${tag}`); for (const state of SAFE_STATES) if (!states.has(state)) errors.push(`COVERAGE_MISSING:state:${state}`); for (const owner of contract.owners ?? []) if (!owners.has(owner)) errors.push(`COVERAGE_MISSING:owner:${owner}`);
	return { errors, stats: { cases: evaluations.cases?.length ?? 0, enabled: contract.enabled } };
}
export async function main(argumentsList = process.argv.slice(2)) { try { const [contractText, evaluationText] = await Promise.all([readFile(path.join(repositoryRoot, 'config', 'codex-workflow-contract.json'), 'utf8'), readFile(path.join(repositoryRoot, 'config', 'codex-workflow-evaluations.json'), 'utf8')]); const contract = parseStrictJson(contractText); const evaluations = parseStrictJson(evaluationText); const rulePath = path.join(repositoryRoot, contract.rule.path); const ruleText = await readFile(rulePath, 'utf8').catch(() => null); const result = validateWorkflow(contract, evaluations, ruleText !== null); if (result.errors.length || (contract.enabled && validateRuleText(ruleText))) { process.stderr.write(`Codex workflow validation failed: ${result.errors.length ? result.errors.join(',') : 'RULE_INVALID'}\n`); return 1; } if (argumentsList.length === 2 && argumentsList[0] === '--case') { const entry = evaluations.cases.find((candidate) => candidate.caseId === argumentsList[1]); if (!entry) { process.stderr.write('Codex workflow validation failed: CASE_NOT_FOUND\n'); return 1; } process.stdout.write(`${JSON.stringify(routeTask(entry.signal, entry.trustedContext, contract, entry.scenario))}\n`); return 0; } if (argumentsList.length !== 0) { process.stderr.write('Codex workflow validation failed: ARGUMENTS_INVALID\n'); return 1; } process.stdout.write(`Codex workflow contract valid: ${result.stats.cases} evaluation cases; rule ${contract.enabled ? 'enabled' : 'disabled'}.\n`); return 0; } catch { process.stderr.write('Codex workflow validation failed: VALIDATION_FAILED\n'); return 1; } }
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) process.exitCode = await main();
