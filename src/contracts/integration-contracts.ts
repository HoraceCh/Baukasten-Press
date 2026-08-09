/** Phase 0 boundary DTOs and pure fail-closed validation; no I/O or workflow mutation. */
import type { CorrelationId, EntityId, IsoUtcTimestamp, Sha256Hash } from '../domain/publication-contract';

export const INTEGRATION_CONTRACT_VERSION = '1.0' as const;
export const SOURCE_CONTENT_ENCODING = 'utf-8' as const;
export const SOURCE_HASH_ALGORITHM = 'sha-256' as const;
export type IntegrationErrorCode = 'unsupported_contract' | 'invalid_request' | 'authorization_denied' | 'conflict' | 'rate_limited' | 'unavailable' | 'timeout' | 'rejected' | 'unknown';
export interface NormalizedIntegrationError { readonly code: IntegrationErrorCode; readonly summary: string; readonly retryable: boolean; readonly downstreamStatus?: number; }
export interface SourceIntakeRequestV1 { readonly contractVersion: typeof INTEGRATION_CONTRACT_VERSION; readonly sourceNoteRefId: EntityId; readonly publicationItemId: EntityId; readonly correlationId: CorrelationId; readonly sourceVersion: number; readonly sourcePath: string; readonly requestedAt: IsoUtcTimestamp; }
type IntakePins = Readonly<Omit<SourceIntakeRequestV1, 'requestedAt'>>;
export type SourceIntakeResultV1 =
	| (IntakePins & { readonly status: 'captured'; readonly capturedAt: IsoUtcTimestamp; readonly sourceModifiedAt: IsoUtcTimestamp | null; readonly contentEncoding: typeof SOURCE_CONTENT_ENCODING; readonly content: string; readonly hashAlgorithm: typeof SOURCE_HASH_ALGORITHM; readonly contentHash: Sha256Hash })
	| (IntakePins & { readonly status: 'failed'; readonly error: NormalizedIntegrationError });
/** A future Obsidian implementation may implement this port. */
export interface ObsidianSourceIntakeV1 { readonly contractVersion: typeof INTEGRATION_CONTRACT_VERSION; capture(request: SourceIntakeRequestV1): Promise<SourceIntakeResultV1>; }

export interface PublishAdapterRequestV1 { readonly contractVersion: typeof INTEGRATION_CONTRACT_VERSION; readonly requestId: EntityId; readonly publicationItemId: EntityId; readonly correlationId: CorrelationId; readonly destinationId: string; readonly sourceNoteRefId: EntityId; readonly sourceContentHash: Sha256Hash; readonly publicDraftId: EntityId; readonly publicDraftVersion: number; readonly publicDraftContentHash: Sha256Hash; readonly publicDraftContent: string; readonly reviewDecisionId: EntityId; readonly confirmationId: EntityId; readonly confirmedBy: string; readonly confirmedAt: IsoUtcTimestamp; readonly requestedAt: IsoUtcTimestamp; }
type PublishResultPins = Readonly<Pick<PublishAdapterRequestV1, 'contractVersion' | 'requestId' | 'publicationItemId' | 'correlationId' | 'destinationId' | 'sourceNoteRefId' | 'sourceContentHash' | 'publicDraftId' | 'publicDraftVersion' | 'publicDraftContentHash' | 'reviewDecisionId' | 'confirmationId' | 'confirmedBy' | 'confirmedAt'>>;
export type PublishAdapterResultV1 =
	| (PublishResultPins & { readonly status: 'succeeded'; readonly downstreamId: string; readonly downstreamUrl: string | null; readonly downstreamRevision: string | null })
	| (PublishResultPins & { readonly status: 'failed'; readonly error: NormalizedIntegrationError });
/** A port only: Phase 0 deliberately provides no Website client. */
export interface PublishAdapterV1 { readonly destinationId: string; readonly contractVersion: typeof INTEGRATION_CONTRACT_VERSION; publish(request: PublishAdapterRequestV1): Promise<PublishAdapterResultV1>; }
export interface ContractValidationResult { readonly valid: boolean; readonly errors: readonly string[]; }

const HASH = /^[a-f0-9]{64}$/;
const ERROR_CODES: readonly IntegrationErrorCode[] = ['unsupported_contract', 'invalid_request', 'authorization_denied', 'conflict', 'rate_limited', 'unavailable', 'timeout', 'rejected', 'unknown'];
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value: object, keys: readonly string[]): boolean => { const actual = Object.keys(value).sort(); const expected = [...keys].sort(); return actual.length === expected.length && actual.every((key, index) => key === expected[index]); };
const id = (value: unknown): value is string => typeof value === 'string' && /^\S(?:.*\S)?$/.test(value);
const hash = (value: unknown): value is Sha256Hash => typeof value === 'string' && HASH.test(value);
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;
const iso = (value: unknown): value is IsoUtcTimestamp => typeof value === 'string' && !Number.isNaN(new Date(value).valueOf()) && new Date(value).toISOString() === value;
const result = (errors: string[]): ContractValidationResult => ({ valid: errors.length === 0, errors });
const safePath = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && !value.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(value) && !value.includes('\\') && !value.split('/').some((part) => part === '' || part === '.' || part === '..' || part.toLowerCase() === `.${'obsidian'}`);
const safeSummary = (value: unknown): boolean => typeof value === 'string' && value.length > 0 && value.length <= 500 && !/[\r\n]/.test(value) && !/(stack trace|authorization:|bearer\s|token=|password=|secret=)/i.test(value);
const absoluteHttpUrl = (value: string): boolean => { try { const parsed = new URL(value); return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && Boolean(parsed.hostname); } catch { return false; } };
function validateError(value: unknown, errors: string[], label: string): void {
	if (!isObject(value) || !exactKeys(value, ['code', 'summary', 'retryable', ...(Object.prototype.hasOwnProperty.call(value, 'downstreamStatus') ? ['downstreamStatus'] : [])])) { errors.push(`${label} must contain only normalized error fields`); return; }
	if (!ERROR_CODES.includes(value.code as IntegrationErrorCode)) errors.push(`${label}.code is not recognized`);
	if (!safeSummary(value.summary)) errors.push(`${label}.summary must be a safe one-line message`);
	if (typeof value.retryable !== 'boolean') errors.push(`${label}.retryable must be boolean`);
	if ('downstreamStatus' in value && (!Number.isInteger(value.downstreamStatus) || (value.downstreamStatus as number) < 100 || (value.downstreamStatus as number) > 599)) errors.push(`${label}.downstreamStatus must be an HTTP status`);
}
function echo(value: Record<string, unknown>, request: object, pin: string, errors: string[]): void { if (value[pin] !== (request as Record<string, unknown>)[pin]) errors.push(`${pin} must echo the request exactly`); }

export function validateSourceIntakeRequestV1(value: unknown): ContractValidationResult {
	const errors: string[] = []; const fields = ['contractVersion', 'sourceNoteRefId', 'publicationItemId', 'correlationId', 'sourceVersion', 'sourcePath', 'requestedAt'];
	if (!isObject(value) || !exactKeys(value, fields)) return result(['intake request has unexpected fields or shape']);
	if (value.contractVersion !== INTEGRATION_CONTRACT_VERSION) errors.push('intake contractVersion must be exactly 1.0');
	for (const field of ['sourceNoteRefId', 'publicationItemId', 'correlationId']) if (!id(value[field])) errors.push(`${field} must be a non-blank opaque id`);
	if (!positive(value.sourceVersion)) errors.push('sourceVersion must be positive'); if (!safePath(value.sourcePath)) errors.push('sourcePath must be a vault-relative non-protected locator'); if (!iso(value.requestedAt)) errors.push('requestedAt must be an exact UTC ISO timestamp');
	return result(errors);
}
export async function validateSourceIntakeResultV1(request: SourceIntakeRequestV1, value: unknown): Promise<ContractValidationResult> {
	const errors = [...validateSourceIntakeRequestV1(request).errors]; if (!isObject(value) || typeof value.status !== 'string') return result([...errors, 'intake result has invalid shape']);
	const pins = ['contractVersion', 'sourceNoteRefId', 'publicationItemId', 'correlationId', 'sourceVersion', 'sourcePath']; for (const pin of pins) echo(value, request, pin, errors);
	if (value.status === 'failed') { if (!exactKeys(value, [...pins, 'status', 'error'])) errors.push('failed intake must not include partial capture fields'); else validateError(value.error, errors, 'intake error'); return result(errors); }
	if (value.status !== 'captured' || !exactKeys(value, [...pins, 'status', 'capturedAt', 'sourceModifiedAt', 'contentEncoding', 'content', 'hashAlgorithm', 'contentHash'])) return result([...errors, 'captured intake result has unexpected fields or status']);
	if (!iso(value.capturedAt) || new Date(value.capturedAt).valueOf() < new Date(request.requestedAt).valueOf()) errors.push('capturedAt must be UTC and not precede requestedAt');
	if (value.sourceModifiedAt !== null && !iso(value.sourceModifiedAt)) errors.push('sourceModifiedAt must be UTC or null');
	if (value.contentEncoding !== SOURCE_CONTENT_ENCODING || value.hashAlgorithm !== SOURCE_HASH_ALGORITHM || typeof value.content !== 'string' || !hash(value.contentHash)) errors.push('captured content fields are invalid'); else if (value.contentHash !== await sha256(value.content)) errors.push('contentHash must match exact UTF-8 content');
	return result(errors);
}
export async function validatePublishAdapterRequestV1(value: unknown): Promise<ContractValidationResult> {
	const errors: string[] = []; const fields = ['contractVersion', 'requestId', 'publicationItemId', 'correlationId', 'destinationId', 'sourceNoteRefId', 'sourceContentHash', 'publicDraftId', 'publicDraftVersion', 'publicDraftContentHash', 'publicDraftContent', 'reviewDecisionId', 'confirmationId', 'confirmedBy', 'confirmedAt', 'requestedAt'];
	if (!isObject(value) || !exactKeys(value, fields)) return result(['publish request has unexpected fields or shape']); if (value.contractVersion !== INTEGRATION_CONTRACT_VERSION) errors.push('publish contractVersion must be exactly 1.0');
	for (const field of ['requestId', 'publicationItemId', 'correlationId', 'destinationId', 'sourceNoteRefId', 'publicDraftId', 'reviewDecisionId', 'confirmationId', 'confirmedBy']) if (!id(value[field])) errors.push(`${field} must be a non-blank opaque value`);
	if (!hash(value.sourceContentHash) || !hash(value.publicDraftContentHash)) errors.push('source and draft hashes must be lowercase SHA-256'); if (!positive(value.publicDraftVersion) || typeof value.publicDraftContent !== 'string') errors.push('draft version/content are invalid'); else if (value.publicDraftContentHash !== await sha256(value.publicDraftContent)) errors.push('publicDraftContentHash must match exact UTF-8 draft content');
	if (!iso(value.confirmedAt) || !iso(value.requestedAt) || (iso(value.confirmedAt) && iso(value.requestedAt) && new Date(value.confirmedAt) > new Date(value.requestedAt))) errors.push('confirmation must be UTC and cannot follow request'); return result(errors);
}
export async function validatePublishAdapterResultV1(request: PublishAdapterRequestV1, value: unknown): Promise<ContractValidationResult> {
	const errors = [...(await validatePublishAdapterRequestV1(request)).errors]; if (!isObject(value) || typeof value.status !== 'string') return result([...errors, 'publish result has invalid shape']);
	const pins = ['contractVersion', 'requestId', 'publicationItemId', 'correlationId', 'destinationId', 'sourceNoteRefId', 'sourceContentHash', 'publicDraftId', 'publicDraftVersion', 'publicDraftContentHash', 'reviewDecisionId', 'confirmationId', 'confirmedBy', 'confirmedAt']; for (const pin of pins) echo(value, request, pin, errors);
	if (value.status === 'failed') { if (!exactKeys(value, [...pins, 'status', 'error'])) errors.push('failed publish result has unexpected fields'); else validateError(value.error, errors, 'publish error'); return result(errors); }
	if (value.status !== 'succeeded' || !exactKeys(value, [...pins, 'status', 'downstreamId', 'downstreamUrl', 'downstreamRevision'])) return result([...errors, 'successful publish result has unexpected fields or status']);
	if (!id(value.downstreamId)) errors.push('downstreamId must be opaque and non-blank'); if (value.downstreamUrl !== null && (typeof value.downstreamUrl !== 'string' || !absoluteHttpUrl(value.downstreamUrl))) errors.push('downstreamUrl must be absolute HTTP(S) or null'); if (value.downstreamRevision !== null && !id(value.downstreamRevision)) errors.push('downstreamRevision must be opaque or null'); return result(errors);
}
/** Stable recursive JSON: object keys sort; array order and nulls remain material. */
export function canonicalJson(value: unknown): string {
	if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value); if (typeof value === 'number') { if (!Number.isFinite(value)) throw new TypeError('canonical JSON rejects non-finite numbers'); return JSON.stringify(value); } if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`; if (!isObject(value)) throw new TypeError('canonical JSON accepts only plain JSON values'); return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}
export async function receiptHashForPublishSuccess(resultValue: PublishAdapterResultV1): Promise<Sha256Hash> { if (resultValue.status !== 'succeeded') throw new TypeError('only successful normalized results have receipt hashes'); return sha256(canonicalJson(resultValue)); }
/** A captured source reference is immutable: its id may replay only byte-for-byte. */
export function validateCapturedSourceReplay(existing: Extract<SourceIntakeResultV1, { readonly status: 'captured' }>, candidate: SourceIntakeResultV1): ContractValidationResult { return candidate.status === 'captured' && candidate.sourceNoteRefId === existing.sourceNoteRefId && canonicalJson(candidate) === canonicalJson(existing) ? result([]) : result(['captured source reference replay conflicts with immutable evidence']); }
async function sha256(content: string): Promise<Sha256Hash> { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content)); return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''); }
