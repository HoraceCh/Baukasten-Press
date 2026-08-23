import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const FIXTURE_ROOT_SEGMENTS = ['docs', 'fixtures'];
const EXPECTED_FIXTURE_DIRECTORIES = ['skill-evidence', 'skill-lineage', 'skill-manifest', 'skill-trust-env'];

function joinPath(root, ...segments) {
	return path.resolve(root, ...segments);
}

function toPosix(value) {
	return value.split(path.sep).join('/');
}

async function readJsonFile(absolutePath, errors, label) {
	let text;
	try {
		text = await readFile(absolutePath, 'utf8');
	} catch (error) {
		errors.push(`${label}: unreadable (${error.message}).`);
		return null;
	}
	try {
		return JSON.parse(text);
	} catch (error) {
		errors.push(`${label}: malformed JSON (${error.message}).`);
		return null;
	}
}

function isPlainObject(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
	return typeof value === 'string' && value.length > 0;
}

function checkExactFields(record, allowedFields, errors, label, violationClass) {
	const unknown = Object.keys(record).filter((key) => !allowedFields.includes(key));
	for (const key of unknown) {
		errors.push(`${label}: ${violationClass} unknown field "${key}" (schema forbids undeclared fields).`);
	}
}

function checkEnum(record, field, allowedValues, errors, label, violationClass) {
	const value = record[field];
	if (!allowedValues.includes(value)) {
		errors.push(`${label}: ${violationClass} field "${field}" must be one of ${allowedValues.join(' | ')}; found ${JSON.stringify(value ?? null)}.`);
		return false;
	}
	return true;
}

const MANIFEST_FIELDS = [
	'schema_version', 'skill_id', 'name', 'category', 'revision_id', 'provenance',
	'trust_state', 'enabled', 'environment_contract_ref', 'lineage', 'evidence_ref',
	'path', 'created_by', 'updated_at',
];
const MANIFEST_CATEGORIES = ['tool_guide', 'workflow', 'reference'];
const TRUST_STATES = ['provisional', 'trusted', 'deprecated', 'retired'];
const LINEAGE_ORIGIN_KINDS = ['authored', 'fixed', 'derived', 'captured', 'imported'];

function evaluateProvenance(provenance, errors, label) {
	if (!isPlainObject(provenance)) {
		errors.push(`${label}: D3 provenance is missing or not an object.`);
		return;
	}
	if (provenance.origin === 'project-authored') {
		checkExactFields(provenance, ['origin', 'created_from_issue'], errors, label, 'D6');
		if (!('created_from_issue' in provenance)) {
			errors.push(`${label}: D6 project-authored provenance requires created_from_issue (string or null).`);
		}
		return;
	}
	if (provenance.origin === 'imported') {
		checkExactFields(provenance, ['origin', 'source_url', 'source_tag', 'source_commit', 'license', 'boundary_doc_ref'], errors, label, 'D6');
		if (!/^https:\/\//.test(provenance.source_url ?? '')) {
			errors.push(`${label}: D3 imported provenance requires https source_url.`);
		}
		if (!isNonEmptyString(provenance.source_tag)) {
			errors.push(`${label}: D3 imported provenance requires a pinned source_tag.`);
		}
		if (!/^[0-9a-f]{40}$/.test(provenance.source_commit ?? '')) {
			errors.push(`${label}: D3 imported provenance requires a 40-hex immutable source_commit.`);
		}
		if (!isNonEmptyString(provenance.license)) {
			errors.push(`${label}: D3 imported provenance requires license.`);
		}
		if (!isNonEmptyString(provenance.boundary_doc_ref)) {
			errors.push(`${label}: D3 imported provenance requires boundary_doc_ref.`);
		}
		return;
	}
	errors.push(`${label}: D3 provenance.origin must be "project-authored" or "imported"; found ${JSON.stringify(provenance.origin ?? null)}.`);
}

function evaluateManifest(manifest, errors, label) {
	if (!isPlainObject(manifest)) {
		errors.push(`${label}: D2 manifest is not a JSON object.`);
		return false;
	}
	checkExactFields(manifest, MANIFEST_FIELDS, errors, label, 'D6');
	if (manifest.schema_version !== 1) {
		errors.push(`${label}: D6 schema_version must be 1; found ${JSON.stringify(manifest.schema_version ?? null)}.`);
	}
	if (!isNonEmptyString(manifest.skill_id)) {
		errors.push(`${label}: D2 skill_id missing.`);
	}
	if (!isNonEmptyString(manifest.name)) {
		errors.push(`${label}: D2 name missing.`);
	}
	checkEnum(manifest, 'category', MANIFEST_CATEGORIES, errors, label, 'D6');
	if (!isNonEmptyString(manifest.revision_id)) {
		errors.push(`${label}: D2 revision_id missing.`);
	}
	evaluateProvenance(manifest.provenance, errors, label);
	checkEnum(manifest, 'trust_state', TRUST_STATES, errors, label, 'D6');
	if (typeof manifest.enabled !== 'boolean') {
		errors.push(`${label}: D6 enabled must be a boolean.`);
	}
	const lineage = manifest.lineage;
	if (!isPlainObject(lineage)) {
		errors.push(`${label}: D2 lineage missing or not an object.`);
	} else {
		checkExactFields(lineage, ['origin_kind', 'parent_skill_ids', 'parent_revision_ids'], errors, label, 'D6');
		checkEnum(lineage, 'origin_kind', LINEAGE_ORIGIN_KINDS, errors, label, 'D6');
		if (!Array.isArray(lineage.parent_skill_ids) || !Array.isArray(lineage.parent_revision_ids)) {
			errors.push(`${label}: D6 lineage parent collections must be arrays.`);
		}
	}
	if (!('environment_contract_ref' in manifest)) {
		errors.push(`${label}: D6 environment_contract_ref slot must be present (null until BAP-52 declarations exist).`);
	}
	if (!('evidence_ref' in manifest)) {
		errors.push(`${label}: D6 evidence_ref slot must be present (null until BAP-53 records exist).`);
	}
	if (!isNonEmptyString(manifest.path)) {
		errors.push(`${label}: D2 path missing.`);
	}
	if (!isNonEmptyString(manifest.created_by)) {
		errors.push(`${label}: D2 created_by missing.`);
	}
	if (!isNonEmptyString(manifest.updated_at)) {
		errors.push(`${label}: D2 updated_at missing.`);
	}
	return true;
}

const ECD_FIELDS = [
	'schema_version', 'skill_id', 'os', 'runtime_constraints', 'gui', 'headless',
	'required_tools', 'required_mcp_capabilities', 'filesystem_assumptions', 'network',
	'credential_category', 'capability_expectations', 'project_scope', 'created_by', 'updated_at',
];

function evaluateEnvironmentDeclaration(ecd, errors, label) {
	if (!isPlainObject(ecd)) {
		errors.push(`${label}: ECD is missing or not an object.`);
		return;
	}
	checkExactFields(ecd, ECD_FIELDS, errors, label, 'D6');
	if (ecd.schema_version !== 1) {
		errors.push(`${label}: D6 ECD schema_version must be 1.`);
	}
	if (!isPlainObject(ecd.os) || !Array.isArray(ecd.os.supported) || ecd.os.supported.length === 0) {
		errors.push(`${label}: A4 ECD os.supported must be a non-empty array (unknown fails closed).`);
	}
	if (!['none', 'optional', 'required'].includes(ecd.gui)) {
		errors.push(`${label}: A4 ECD gui must be none | optional | required; found ${JSON.stringify(ecd.gui ?? null)}.`);
	}
	if (!['supported', 'unsupported'].includes(ecd.headless)) {
		errors.push(`${label}: A4 ECD headless must be supported | unsupported; found ${JSON.stringify(ecd.headless ?? null)}.`);
	}
	if (!Array.isArray(ecd.required_tools)) {
		errors.push(`${label}: A4 ECD required_tools must be an array.`);
	}
	if (!Array.isArray(ecd.required_mcp_capabilities)) {
		errors.push(`${label}: A4 ECD required_mcp_capabilities must be an array.`);
	} else {
		for (const capability of ecd.required_mcp_capabilities) {
			if (!isPlainObject(capability) || !['required', 'optional'].includes(capability.necessity)) {
				errors.push(`${label}: A4 ECD MCP capability entries require necessity required | optional.`);
			}
		}
	}
	if (!Array.isArray(ecd.filesystem_assumptions)) {
		errors.push(`${label}: A4 ECD filesystem_assumptions must be an array.`);
	}
	if (!['none', 'egress_optional', 'egress_required'].includes(ecd.network)) {
		errors.push(`${label}: A4 ECD network must be none | egress_optional | egress_required; found ${JSON.stringify(ecd.network ?? null)}.`);
	}
	if (!['none', 'operator_supplied_runtime_only'].includes(ecd.credential_category)) {
		errors.push(`${label}: T9 ECD credential_category must be none | operator_supplied_runtime_only (capability category only; values forbidden).`);
	}
	const expectations = ecd.capability_expectations;
	if (!isPlainObject(expectations)) {
		errors.push(`${label}: A4 ECD capability_expectations missing.`);
	} else {
		if (!['repository', 'none'].includes(expectations.read)) {
			errors.push(`${label}: A4 ECD capability_expectations.read must be repository | none.`);
		}
		if (!['none', 'runtime_ignored_artifacts_only'].includes(expectations.write_scope)) {
			errors.push(`${label}: A4 ECD capability_expectations.write_scope must be none | runtime_ignored_artifacts_only.`);
		}
		if (expectations.external_write !== false) {
			errors.push(`${label}: T9 ECD capability_expectations.external_write must be false at schema v1; found ${JSON.stringify(expectations.external_write ?? null)}.`);
		}
	}
	if (!Array.isArray(ecd.project_scope) || ecd.project_scope.length === 0) {
		errors.push(`${label}: A4 ECD project_scope must be a non-empty array.`);
	}
}

function evaluateTrustEnvironmentScenario(scenario, errors, label) {
	if (!isPlainObject(scenario) || !isNonEmptyString(scenario.scenario_id)) {
		errors.push(`${label}: scenario envelope requires scenario_id.`);
		return;
	}
	const slice = scenario.manifest_slice;
	if (isPlainObject(slice)) {
		checkEnum(slice, 'trust_state', TRUST_STATES, errors, label, 'D6');
		if (typeof slice.enabled !== 'boolean') {
			errors.push(`${label}: D6 manifest_slice.enabled must be boolean.`);
		}
		if (slice.trust_state === 'retired' && slice.enabled === true && scenario.expected?.available_candidate === true) {
			errors.push(`${label}: L7 retired skill treated as available candidate despite enabled switch (A2 outranks A1).`);
		}
	}
	if (isPlainObject(scenario.environment_declaration)) {
		evaluateEnvironmentDeclaration(scenario.environment_declaration, errors, label);
	}
	if (!isPlainObject(scenario.expected)) {
		errors.push(`${label}: scenario requires an expected outcome block.`);
	}
}

const EVIDENCE_FIELDS = [
	'evidence_schema_version', 'evidence_id', 'task_ref', 'skill_id', 'revision_id',
	'outcome', 'invoking_agent_owner', 'invoking_runtime', 'repository_head', 'recorded_at',
	'actor', 'environment_result_ref', 'tool_observations', 'validation_refs', 'qa_outcome',
	'failure_attribution', 'fallback_reason', 'quality_record_id', 'provenance_refs',
	'redaction_status', 'producer',
];
const EVIDENCE_OUTCOMES = ['selected', 'applied', 'completed', 'fallback', 'failed'];
const FAILURE_ATTRIBUTIONS = ['skill', 'tool', 'environment', 'user_input', 'unknown'];
const REDACTION_STATES = ['verified_redacted', 'unknown', 'violated'];

function evaluateQualityRecord(record, errors, label) {
	const allowed = [
		'quality_schema_version', 'quality_record_id', 'evidence_id', 'validation_status',
		'independent_qa_status', 'deterministic_checks', 'warnings', 'defect_classification',
		'output_acceptance', 'reviewer_reference', 'evidence_basis', 'quality_category',
	];
	if (!isPlainObject(record)) {
		errors.push(`${label}: E5 quality record is missing or not an object.`);
		return;
	}
	checkExactFields(record, allowed, errors, label, 'E5');
	if (record.quality_schema_version !== 1) {
		errors.push(`${label}: E5 quality_schema_version must be 1.`);
	}
	if (!isNonEmptyString(record.quality_record_id)) {
		errors.push(`${label}: E5 quality_record_id missing.`);
	}
	if (!isNonEmptyString(record.evidence_id)) {
		errors.push(`${label}: E5 quality record evidence_id missing.`);
	}
	if (!['pass', 'fail', 'not_run'].includes(record.validation_status)) {
		errors.push(`${label}: E5 validation_status must be pass | fail | not_run.`);
	}
	if (!['pass', 'fail', 'warning', 'not_performed'].includes(record.independent_qa_status)) {
		errors.push(`${label}: E5 independent_qa_status must be pass | fail | warning | not_performed.`);
	}
	if (!['accepted', 'rejected', 'pending'].includes(record.output_acceptance)) {
		errors.push(`${label}: E5 output_acceptance must be accepted | rejected | pending.`);
	}
	if (!['satisfactory', 'conditional', 'unsatisfactory'].includes(record.quality_category)) {
		errors.push(`${label}: E5 quality_category must be satisfactory | conditional | unsatisfactory (numeric scoring forbidden).`);
	}
	if (!isNonEmptyString(record.reviewer_reference)) {
		errors.push(`${label}: E5 reviewer_reference missing.`);
	}
}

function evaluateEvidenceRecord(record, errors, label) {
	if (!isPlainObject(record)) {
		errors.push(`${label}: E1 evidence record is not a JSON object.`);
		return;
	}
	checkExactFields(record, EVIDENCE_FIELDS, errors, label, 'E1');
	if (record.evidence_schema_version !== 1) {
		errors.push(`${label}: E1 evidence_schema_version must be 1.`);
	}
	if (!isNonEmptyString(record.evidence_id)) {
		errors.push(`${label}: E1 evidence_id missing.`);
	}
	const identityMissing = !isNonEmptyString(record.skill_id) || !isNonEmptyString(record.revision_id);
	if (identityMissing) {
		errors.push(`${label}: E1 skill_id/revision_id missing.`);
	}
	checkEnum(record, 'outcome', EVIDENCE_OUTCOMES, errors, label, 'E4');
	if (record.outcome === 'failed') {
		if (!FAILURE_ATTRIBUTIONS.includes(record.failure_attribution)) {
			errors.push(`${label}: E4b failed outcomes require failure_attribution (skill | tool | environment | user_input | unknown).`);
		}
	} else if (record.failure_attribution !== null) {
		errors.push(`${label}: E9 failure_attribution must be null unless outcome is failed.`);
	}
	if (record.outcome === 'fallback' && !isNonEmptyString(record.fallback_reason)) {
		errors.push(`${label}: E4 fallback outcomes require fallback_reason.`);
	}
	if (record.outcome !== 'fallback' && record.fallback_reason !== null) {
		errors.push(`${label}: E9 fallback_reason must be null unless outcome is fallback.`);
	}
	if (!/^[0-9a-f]{40}$/.test(record.repository_head ?? '')) {
		errors.push(`${label}: E1 repository_head must be a 40-hex commit SHA.`);
	}
	if (!Array.isArray(record.tool_observations) || !Array.isArray(record.validation_refs) || !Array.isArray(record.provenance_refs)) {
		errors.push(`${label}: E1 tool_observations/validation_refs/provenance_refs must be arrays.`);
	}
	checkEnum(record, 'redaction_status', REDACTION_STATES, errors, label, 'E8');
	if (!isPlainObject(record.producer) || !isNonEmptyString(record.producer.identity) || !isNonEmptyString(record.producer.mechanism)) {
		errors.push(`${label}: E7 producer identity/mechanism missing or unverifiable shape.`);
	}
	const positiveEligibilityClaimed = record.outcome === 'completed'
		&& ['pass', 'warning'].includes(record.qa_outcome)
		&& record.quality_record_id !== null;
	if (positiveEligibilityClaimed && record.redaction_status !== 'verified_redacted') {
		errors.push(`${label}: E8 redaction_status ${JSON.stringify(record.redaction_status)} is never eligible as positive trust evidence.`);
	}
	if (positiveEligibilityClaimed && !isNonEmptyString(record.quality_record_id)) {
		errors.push(`${label}: E5 completed positive-evidence claims require a linked quality record.`);
	}
}

function evaluateRevisionBundle(bundle, errors, label) {
	if (!isPlainObject(bundle) || bundle.scenario_id === undefined || !Array.isArray(bundle.participants)) {
		errors.push(`${label}: L-class bundle requires scenario_id and participants array.`);
		return;
	}
	const revisions = bundle.participants.filter((participant) => isPlainObject(participant) && participant.record !== 'governed_decision');
	for (const participant of revisions) {
		if (!isNonEmptyString(participant.skill_id) || !isNonEmptyString(participant.revision_id)) {
			errors.push(`${label}: L2 bundle participant missing skill_id/revision_id.`);
		}
	}
	const revisionsByReference = new Map();
	for (const participant of revisions) {
		if (!isNonEmptyString(participant.skill_id) || !isNonEmptyString(participant.revision_id)) continue;
		const reference = `${participant.skill_id}@${participant.revision_id}`;
		if (revisionsByReference.has(reference)) {
			const existingHash = revisionsByReference.get(reference).content_hash;
			if (existingHash !== participant.content_hash) {
				errors.push(`${label}: L5 duplicate revision identity ${reference} re-admitted with different content hash (silent historical overwrite).`);
			}
		}
		revisionsByReference.set(reference, participant);
	}
	const skillIds = new Set(revisions.map((participant) => participant.skill_id));
	for (const participant of revisions) {
		if (!isNonEmptyString(participant.skill_id)) continue;
		const reference = `${participant.skill_id}@${participant.revision_id}`;
		const labelWithRef = `${label} [${reference}]`;
		const parents = Array.isArray(participant.parent_skill_ids) ? participant.parent_skill_ids : [];
		const parentRevisions = Array.isArray(participant.parent_revision_ids) ? participant.parent_revision_ids : [];
		for (const parent of parents) {
			if (parent === participant.skill_id) {
				errors.push(`${labelWithRef}: L3 self-parenting detected.`);
			}
			if (!skillIds.has(parent)) {
				errors.push(`${labelWithRef}: L2 parent skill ${parent} does not resolve within bundle scope.`);
			}
		}
		if (participant.origin_kind === 'fixed') {
			if (parents.length !== 0) {
				errors.push(`${labelWithRef}: L4a/L2 FIX must use parent_revision_ids (same identity), not parent_skill_ids.`);
			}
			if (parentRevisions.length !== 1) {
				errors.push(`${labelWithRef}: L4a FIX requires exactly one parent revision.`);
			} else {
				const [parentReference] = parentRevisions;
				const [parentSkill] = parentReference.split('@');
				if (parentSkill !== participant.skill_id) {
					errors.push(`${labelWithRef}: L4a FIX changed stable identity (parent belongs to ${parentSkill}).`);
				}
				if (!revisionsByReference.has(parentReference)) {
					errors.push(`${labelWithRef}: L2 FIX parent revision ${parentReference} does not resolve within bundle scope.`);
				}
			}
		}
		if (participant.origin_kind === 'derived') {
			if (parents.includes(participant.skill_id)) {
				errors.push(`${labelWithRef}: L4b DERIVED reused its own (parent) identity.`);
			}
			if (parents.length === 0) {
				errors.push(`${labelWithRef}: L2 DERIVED requires at least one resolvable parent skill.`);
			}
		}
		if (participant.guardrail_prerequisites !== undefined) {
			const guardrails = participant.guardrail_prerequisites;
			for (const required of ['procedure_evidence', 'independent_postcondition_validation', 'capability_boundary', 'limitations_preconditions']) {
				if (!guardrails[required]) {
					errors.push(`${labelWithRef}: CAPTURED guardrail prerequisite "${required}" missing; whole-task success alone is insufficient.`);
				}
			}
		}
	}
	const adjacency = new Map();
	for (const [reference, participant] of revisionsByReference) {
		const revisionEdges = (participant.parent_revision_ids ?? []).filter((parent) => revisionsByReference.has(parent));
		const skillEdges = (participant.parent_skill_ids ?? [])
			.filter((parent) => skillIds.has(parent))
			.flatMap((parentSkill) => [...revisionsByReference.keys()].filter((candidate) => candidate.startsWith(`${parentSkill}@`)));
		adjacency.set(reference, [...revisionEdges, ...skillEdges]);
	}
	const visiting = new Set();
	const visited = new Set();
	function visit(node, trail) {
		if (visiting.has(node)) {
			errors.push(`${label}: L1 cyclic lineage detected through ${[...trail, node].join(' -> ')}.`);
			return;
		}
		if (visited.has(node)) return;
		visiting.add(node);
		for (const next of adjacency.get(node) ?? []) {
			visit(next, [...trail, node]);
		}
		visiting.delete(node);
		visited.add(node);
	}
	for (const reference of revisionsByReference.keys()) {
		visit(reference, []);
	}
}

async function listFixtureFiles(fixturesRoot, relativeDirectory, errors) {
	const directory = joinPath(fixturesRoot, relativeDirectory);
	try {
		return (await readdir(directory))
			.filter((entry) => entry.endsWith('.json'))
			.filter((entry) => entry !== 'expected-verdicts.json')
			.sort()
			.map((entry) => ({ fileName: entry, absolutePath: joinPath(directory, entry) }));
	} catch (error) {
		errors.push(`Fixture directory docs/fixtures/${relativeDirectory} unreadable: ${error.message}`);
		return [];
	}
}

function evaluatePromotionGateAttempt(scenario, errors, label) {
	const attempt = scenario.attempted_transition;
	if (!isPlainObject(attempt) || attempt.to_trust_state !== 'trusted') return;
	if (!Array.isArray(attempt.evidence_refs) || !attempt.evidence_refs.every(isNonEmptyString) || attempt.evidence_refs.length === 0) {
		errors.push(`${label}: P-GATE promotion lacks a resolvable evidence basis (gate P1).`);
	}
	if (!isNonEmptyString(attempt.decision_owner) || /^(execution agent|opencode)/i.test(attempt.decision_owner)) {
		errors.push(`${label}: P-GATE promotion requires an authorized decision owner; agents may only propose (gate P2).`);
	}
	if (attempt.rationale_recorded !== true) {
		errors.push(`${label}: P-GATE promotion requires recorded rationale (gate P4).`);
	}
}

function evaluateHostContextCompatibility(scenario, errors, label) {
	const declaration = scenario.environment_declaration;
	const host = scenario.host_context;
	if (!isPlainObject(declaration) || !isPlainObject(host)) return;
	if (Array.isArray(declaration.os?.supported) && !declaration.os.supported.includes(host.os_detected)) {
		errors.push(`${label}: A3 host OS ${JSON.stringify(host.os_detected)} is not in the supported list.`);
	}
	if (declaration.gui === 'required' && (host.gui_available === false || host.headless === true)) {
		errors.push(`${label}: A3 required GUI is unavailable on this host.`);
	}
	for (const tool of Array.isArray(declaration.required_tools) ? declaration.required_tools : []) {
		if (!isNonEmptyString(tool.check_hint)) {
			errors.push(`${label}: A4 required tool ${JSON.stringify(tool.name ?? null)} declares no verification hint; unknown fails closed.`);
			continue;
		}
		if (host.tools_verified?.[tool.name] !== true) {
			errors.push(`${label}: A3 required tool ${tool.name} is not verified available on this host.`);
		}
	}
	for (const capability of Array.isArray(declaration.required_mcp_capabilities) ? declaration.required_mcp_capabilities : []) {
		if (capability.necessity === 'required' && host.mcp_available?.[capability.name] !== true) {
			errors.push(`${label}: A3 required MCP capability ${JSON.stringify(capability.name ?? null)} is unavailable on this host.`);
		}
	}
	if (declaration.network === 'egress_required' && host.network_verified !== true) {
		errors.push(`${label}: A4 required egress network could not be verified; unknown fails closed.`);
	}
}

function evaluateEvidenceDirectoryLinks(record, errors, label, availableQualityRecordIds) {
	const claimed = record.quality_record_id;
	if (!isNonEmptyString(claimed)) return;
	if (isPlainObject(record.quality_record) && record.quality_record.quality_record_id === claimed) return;
	if (!availableQualityRecordIds.has(claimed)) {
		errors.push(`${label}: E6 quality record reference ${claimed} does not resolve to any admissible quality record.`);
	}
}

async function validateFixtureHarness(repositoryRoot, errors, stats) {
	const fixturesRoot = joinPath(repositoryRoot, ...FIXTURE_ROOT_SEGMENTS);
	const expectationsDocument = await readJsonFile(joinPath(fixturesRoot, 'expected-verdicts.json'), errors, 'docs/fixtures/expected-verdicts.json');
	const expectations = new Map();
	if (isPlainObject(expectationsDocument) && Array.isArray(expectationsDocument.expectations)) {
		for (const entry of expectationsDocument.expectations) {
			if (!isPlainObject(entry) || !isNonEmptyString(entry.fixture)) {
				errors.push('docs/fixtures/expected-verdicts.json contains a malformed expectation entry.');
				continue;
			}
			expectations.set(entry.fixture.replace(/\\/g, '/'), entry);
		}
	} else if (expectationsDocument !== null) {
		errors.push('docs/fixtures/expected-verdicts.json must contain an expectations array.');
	}

	function structuralEvaluatorFor(directoryName) {
		switch (directoryName) {
			case 'skill-manifest':
				return (record, harnessErrors, harnessLabel) => {
					evaluateManifest(record, harnessErrors, harnessLabel);
				};
			case 'skill-trust-env':
				return (record, harnessErrors, harnessLabel) => {
					evaluateTrustEnvironmentScenario(record, harnessErrors, harnessLabel);
					evaluateHostContextCompatibility(record, harnessErrors, harnessLabel);
					evaluatePromotionGateAttempt(record, harnessErrors, harnessLabel);
				};
			case 'skill-evidence':
				return (record, harnessErrors, harnessLabel, fileName) => {
					if (fileName.startsWith('qr-')) {
						evaluateQualityRecord(record, harnessErrors, harnessLabel);
						return;
					}
					let productionRecord = record;
					if (isPlainObject(record) && 'quality_record' in record) {
						const { quality_record: embedded } = record;
						evaluateQualityRecord(embedded, harnessErrors, `${harnessLabel} [embedded ${isPlainObject(embedded) ? embedded.quality_record_id ?? 'quality record' : 'quality record'}]`);
						const { quality_record: _omitted, ...rest } = record;
						void _omitted;
						productionRecord = rest;
					}
					evaluateEvidenceRecord(productionRecord, harnessErrors, harnessLabel);
				};
			case 'skill-lineage':
				return (record, harnessErrors, harnessLabel) => {
					evaluateRevisionBundle(record, harnessErrors, harnessLabel);
				};
			default:
				return null;
		}
	}

	for (const directoryName of EXPECTED_FIXTURE_DIRECTORIES) {
		const files = await listFixtureFiles(fixturesRoot, directoryName, errors);
		const parsed = new Map();
		for (const file of files) {
			stats.fixturesChecked += 1;
			const fixtureKey = toPosix(path.join('docs/fixtures', directoryName, file.fileName));
			parsed.set(fixtureKey, { file, fileName: file.fileName, record: await readJsonFile(file.absolutePath, errors, fixtureKey) });
		}

		if (directoryName === 'skill-manifest') {
			var manifestScopeSkillIds = new Set();
			for (const { record } of parsed.values()) {
				if (isPlainObject(record) && isNonEmptyString(record.skill_id)) manifestScopeSkillIds.add(record.skill_id);
			}
		}

		if (directoryName === 'skill-evidence') {
			var availableQualityRecordIds = new Set();
			for (const { fileName, record } of parsed.values()) {
				if (!isPlainObject(record)) continue;
				if (isNonEmptyString(record.quality_record_id) && fileName.startsWith('qr-')) {
					availableQualityRecordIds.add(record.quality_record_id);
				}
				if (isPlainObject(record.quality_record) && isNonEmptyString(record.quality_record.quality_record_id)) {
					availableQualityRecordIds.add(record.quality_record.quality_record_id);
				}
			}
		}

		for (const [fixtureKey, entry] of parsed) {
			const expectation = expectations.get(fixtureKey);
			if (!expectation) {
				errors.push(`Fixture ${fixtureKey} has no entry in docs/fixtures/expected-verdicts.json (harness completeness).`);
				continue;
			}
			if (!['VALID', 'INVALID'].includes(expectation.verdict)) {
				errors.push(`Expectation for ${fixtureKey} must declare verdict VALID or INVALID.`);
				continue;
			}
			const evaluationErrors = [];
			const evaluator = structuralEvaluatorFor(directoryName);
			if (entry.record !== null && evaluator) {
				evaluator(entry.record, evaluationErrors, fixtureKey, entry.fileName);
			}
			if (directoryName === 'skill-manifest' && isPlainObject(entry.record) && isPlainObject(entry.record.lineage)
				&& ['derived', 'captured'].includes(entry.record.lineage.origin_kind)) {
				for (const parent of Array.isArray(entry.record.lineage.parent_skill_ids) ? entry.record.lineage.parent_skill_ids : []) {
					if (!manifestScopeSkillIds.has(parent)) {
						evaluationErrors.push(`${fixtureKey}: D2 lineage parent ${parent} does not resolve within the manifest fixture scope.`);
					}
				}
			}
			if (directoryName === 'skill-manifest' && isPlainObject(expectation.context) && expectation.violation_class === 'D1') {
				const duplicatesTargetFileName = (expectation.context.duplicatesFixture ?? '').split('/').pop();
				const targetEntry = [...parsed.values()].find((item) => item.fileName === duplicatesTargetFileName);
				if (isPlainObject(targetEntry?.record) && isPlainObject(entry.record)) {
					if (targetEntry.record.skill_id === entry.record.skill_id) {
						evaluationErrors.push(`${fixtureKey}: D1 duplicate stable identifier ${entry.record.skill_id} (also claimed by ${expectation.context.duplicatesFixture}).`);
					} else {
						evaluationErrors.push(`harness: D1 context for ${fixtureKey} does not reproduce a duplicate (validator defect).`);
					}
				}
			}
			if (directoryName === 'skill-evidence') {
				const record = entry.record;
				if (isPlainObject(record) && typeof availableQualityRecordIds !== 'undefined') {
					evaluateEvidenceDirectoryLinks(record, evaluationErrors, fixtureKey, availableQualityRecordIds);
				}
				if (isPlainObject(record) && isPlainObject(expectation.context) && expectation.violation_class === 'E3') {
					const admitted = new Set(expectation.context.knownAdmittedRevisions ?? []);
					if (!admitted.has(`${record.skill_id}@${record.revision_id}`)) {
						evaluationErrors.push(`${fixtureKey}: E3 revision ${record.skill_id}@${record.revision_id} is not an admitted revision.`);
					}
				}
			}
			const detectedViolation = evaluationErrors.length > 0;
			if (expectation.verdict === 'VALID' && detectedViolation) {
				errors.push(`Valid fixture ${fixtureKey} unexpectedly failed validation (${evaluationErrors.length} findings) - validator defect.`);
				for (const finding of evaluationErrors) {
					errors.push(`  ^ ${finding}`);
				}
			}
			if (expectation.verdict === 'INVALID' && !detectedViolation) {
				errors.push(`Invalid fixture ${fixtureKey} passed validation but expected ${expectation.violation_class ?? 'a violation'} - validator defect.`);
			}
		}
	}

	for (const [fixtureKey] of expectations) {
		if (!fixtureKey.startsWith('docs/fixtures/') || fixtureKey.endsWith('expected-verdicts.json')) continue;
		const [, , directoryName, fileName] = fixtureKey.split('/');
		if (!EXPECTED_FIXTURE_DIRECTORIES.includes(directoryName)) {
			errors.push(`Expectation ${fixtureKey} targets a directory outside the governance fixture suite.`);
			continue;
		}
		const known = (await listFixtureFiles(fixturesRoot, directoryName, errors)).some((file) => file.fileName === fileName);
		if (!known) {
			errors.push(`Expectation ${fixtureKey} points to a missing fixture file.`);
		}
	}
}

async function validateGovernedSkillManifests(repositoryRoot, errors, stats) {
	const skillsRoot = joinPath(repositoryRoot, '.agents', 'skills');
	let directories = [];
	try {
		directories = (await readdir(skillsRoot, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();
	} catch (error) {
		errors.push(`Skill root .agents/skills unreadable: ${error.message}`);
		return;
	}
	const seenSkillIds = new Map();
	for (const directoryName of directories) {
		const manifestPath = joinPath(skillsRoot, directoryName, 'skill.manifest.json');
		let manifest;
		try {
			manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
		} catch {
			continue;
		}
		stats.governedSkills += 1;
		const label = `.agents/skills/${directoryName}/skill.manifest.json`;
		const structurallyValid = evaluateManifest(manifest, errors, label);
		if (!structurallyValid) continue;
		if (seenSkillIds.has(manifest.skill_id)) {
			errors.push(`${label}: D1 duplicate stable identifier ${manifest.skill_id} (also claimed by ${seenSkillIds.get(manifest.skill_id)}).`);
		} else {
			seenSkillIds.set(manifest.skill_id, label);
		}
	}
}

function detectDuplicateIdentifierAcrossScope() {
	const scope = [
		{ skill_id: 'probe.alpha', name: 'A', category: 'workflow', revision_id: 'rev-0001', provenance: { origin: 'project-authored', created_from_issue: null }, trust_state: 'provisional', enabled: false, environment_contract_ref: null, lineage: { origin_kind: 'authored', parent_skill_ids: [], parent_revision_ids: [] }, evidence_ref: null, path: '.agents/skills/a/', created_by: 'probe', updated_at: '2026-01-01T00:00:00Z', schema_version: 1 },
		{ skill_id: 'probe.alpha', name: 'B', category: 'workflow', revision_id: 'rev-0001', provenance: { origin: 'project-authored', created_from_issue: null }, trust_state: 'provisional', enabled: false, environment_contract_ref: null, lineage: { origin_kind: 'authored', parent_skill_ids: [], parent_revision_ids: [] }, evidence_ref: null, path: '.agents/skills/b/', created_by: 'probe', updated_at: '2026-01-01T00:00:00Z', schema_version: 1 },
	];
	const seen = new Set();
	for (const manifest of scope) {
		if (seen.has(manifest.skill_id)) return true;
		seen.add(manifest.skill_id);
	}
	return false;
}

function runSelfTestProbes(errors) {
	function probe(name, condition) {
		if (!condition) {
			errors.push(`self-test: violation detector "${name}" failed to detect its synthetic case - validator defect.`);
		}
	}
	probe('D1 duplicate identifier', detectDuplicateIdentifierAcrossScope());
	const missingProvenanceScratch = [];
	evaluateProvenance(undefined, missingProvenanceScratch, 'probe');
	const missingProvenanceDetected = missingProvenanceScratch.some((message) => message.includes('D3'));
	probe('D3 missing provenance', missingProvenanceDetected);
	const cycleProbe = () => {
		const scratchErrors = [];
		evaluateRevisionBundle({
			scenario_id: 'selftest-cycle',
			participants: [
				{ skill_id: 'a', revision_id: 'rev-0001', origin_kind: 'derived', parent_skill_ids: ['b'], parent_revision_ids: [] },
				{ skill_id: 'b', revision_id: 'rev-0001', origin_kind: 'derived', parent_skill_ids: ['a'], parent_revision_ids: [] },
			],
		}, scratchErrors, 'selftest');
		return scratchErrors.some((message) => message.includes('L1'));
	};
	probe('L1 cyclic lineage', cycleProbe());
	const unresolvedProbe = () => {
		const scratchErrors = [];
		evaluateRevisionBundle({
			scenario_id: 'selftest-unresolved',
			participants: [{ skill_id: 'a', revision_id: 'rev-0001', origin_kind: 'derived', parent_skill_ids: ['ghost'], parent_revision_ids: [] }],
		}, scratchErrors, 'selftest');
		return scratchErrors.some((message) => message.includes('L2'));
	};
	probe('L2 unresolved parent', unresolvedProbe());
	const overwriteProbe = () => {
		const scratchErrors = [];
		evaluateRevisionBundle({
			scenario_id: 'selftest-overwrite',
			participants: [
				{ skill_id: 'a', revision_id: 'rev-0001', origin_kind: 'authored', parent_skill_ids: [], parent_revision_ids: [], content_hash: 'one' },
				{ skill_id: 'a', revision_id: 'rev-0001', origin_kind: 'authored', parent_skill_ids: [], parent_revision_ids: [], content_hash: 'two' },
			],
		}, scratchErrors, 'selftest');
		return scratchErrors.some((message) => message.includes('L5'));
	};
	probe('L5 silent historical overwrite', overwriteProbe());
	const retiredProbe = () => {
		const scratchErrors = [];
		evaluateTrustEnvironmentScenario({
			scenario_id: 'selftest-retired',
			manifest_slice: { skill_id: 'r', trust_state: 'retired', enabled: true },
			expected: { available_candidate: true },
		}, scratchErrors, 'selftest');
		return scratchErrors.some((message) => message.includes('L7'));
	};
	probe('L7 retired treated as available', retiredProbe());
	const unknownEnvironmentScratch = [];
	evaluateEnvironmentDeclaration({
		schema_version: 1,
		skill_id: 'u',
		os: { supported: ['any'] },
		runtime_constraints: [],
		gui: 'sometimes',
		headless: 'supported',
		required_tools: [],
		required_mcp_capabilities: [],
		filesystem_assumptions: [],
		network: 'none',
		credential_category: 'none',
		capability_expectations: { read: 'repository', write_scope: 'none', external_write: false },
		project_scope: ['probe'],
	}, unknownEnvironmentScratch, 'selftest-env');
	const unknownEnvironmentDetected = unknownEnvironmentScratch.some((message) => message.includes('A4'));
	probe('A4 unknown required environment state', unknownEnvironmentDetected);
}

export async function validateSkillRegistry(repositoryRoot) {
	const errors = [];
	const stats = { governedSkills: 0, fixturesChecked: 0 };

	await validateGovernedSkillManifests(repositoryRoot, errors, stats);
	await validateFixtureHarness(repositoryRoot, errors, stats);
	runSelfTestProbes(errors);

	return { errors, stats };
}
