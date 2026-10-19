// Credentials are sent only in POST bodies; the permanent password is never persisted.
import type {
  Member, MemberLookupResponse, MembersListResponse, ApiResponse,
  NewMemberData, RenewalData, OwnerSession, LoginResponse,
} from '../types/member';

const SESSION_KEY = 'gymOwnerSession';
export const SESSION_ENDED_EVENT = 'gym-owner-session-ended';
let authenticationRevision = 0;
let ownerSession: OwnerSession | null = null;
const pendingMutations = new Map<string, string>();

export function getApiUrl(): string {
  const configured = typeof __GYM_PUBLIC_CONFIG__ !== 'undefined' ? __GYM_PUBLIC_CONFIG__.apiUrl : '';
  return configured || localStorage.getItem('gymApiUrl') || '';
}

export function setApiUrl(url: string): void {
  if (url !== getApiUrl()) clearAdminSession();
  localStorage.setItem('gymApiUrl', url);
}

export function clearAdminSession(): void {
  authenticationRevision += 1; // Also cancel a login that has not returned a token yet.
  const hadSession = ownerSession !== null;
  ownerSession = null;
  pendingMutations.clear();
  eraseLegacyCredentials();
  if (hadSession) window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
}

function readSession(): OwnerSession | null {
  eraseLegacyCredentials();
  if (!ownerSession) return null;
  if (ownerSession.expiresAt > Date.now() && ownerSession.apiUrl === getApiUrl()) return ownerSession;
  clearAdminSession();
  return null;
}

function eraseLegacyCredentials(): void {
  for (const key of [SESSION_KEY, 'gymAdminPassword']) {
    try { sessionStorage.removeItem(key); } catch { /* Storage can be unavailable; sessions never depend on it. */ }
    try { localStorage.removeItem?.(key); } catch { /* Erase legacy data when the browser permits it. */ }
  }
}

export function isAdminLoggedIn(): boolean {
  return readSession() !== null;
}

export function getSessionExpiresAt(): number | null {
  return readSession()?.expiresAt ?? null;
}

function failure(error: string, code = 'NETWORK_ERROR'): ApiResponse {
  return { success: false, error, code };
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, retryRead = false): Promise<unknown> {
  const attempts = retryRead ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal, redirect: 'follow', cache: 'no-store' });
      if (!response.ok) throw new Error('Server error');
      // Keep the abort deadline alive during redirected response-body consumption too.
      return await response.json();
    } catch (error: unknown) {
      const retryable = error instanceof Error && (error.name === 'AbortError' || error.name === 'TypeError');
      if (!retryable || attempt === attempts - 1) throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Request failed');
}

async function requestJson<T extends ApiResponse>(url: string, options: RequestInit, retryRead = false): Promise<T> {
  try {
    const data: unknown = await fetchWithTimeout(url, options, retryRead);
    if (!data || typeof data !== 'object' || !('success' in data) || typeof data.success !== 'boolean') {
      return failure('Invalid server response', 'INVALID_RESPONSE') as T;
    }
    return data as T;
  } catch (error: unknown) {
    return failure(error instanceof Error && error.name === 'AbortError' ? 'Request timed out' : 'Network error') as T;
  }
}

function isTrustedEndpoint(url: string): boolean {
  try {
    const endpoint = new URL(url);
    return endpoint.protocol === 'https:' && endpoint.hostname === 'script.google.com' &&
      /^\/macros\/s\/[^/]+\/exec$/.test(endpoint.pathname) && !endpoint.search && !endpoint.hash &&
      !endpoint.username && !endpoint.password;
  } catch {
    return false;
  }
}

function postJson<T extends ApiResponse>(payload: object, retryRead = false, url = getApiUrl()): Promise<T> {
  if (!url) return Promise.resolve(failure('API URL not configured', 'NOT_CONFIGURED') as T);
  // Reject query credentials and arbitrary destinations before sending owner credentials.
  if (!isTrustedEndpoint(url)) {
    return Promise.resolve(failure('Configure a Google Apps Script HTTPS /exec URL', 'NOT_CONFIGURED') as T);
  }
  return requestJson<T>(url, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload),
  }, retryRead);
}

export async function loginOwner(ownerId: string, password: string): Promise<ApiResponse> {
  clearAdminSession();
  const revision = authenticationRevision;
  const apiUrl = getApiUrl();
  const response = await postJson<LoginResponse>({ action: 'login', ownerId, password }, false, apiUrl);
  if (revision !== authenticationRevision || apiUrl !== getApiUrl()) {
    if (response.success && typeof response.sessionToken === 'string' && /^[a-f0-9]{64}$/.test(response.sessionToken)) {
      // Best-effort cleanup uses the original endpoint, never the replacement gym.
      await postJson({ action: 'logout', sessionToken: response.sessionToken }, true, apiUrl);
    }
    return failure('Login was cancelled. Please log in again.', 'LOGIN_CANCELLED');
  }
  if (response.success) {
    if (typeof response.sessionToken !== 'string' || !/^[a-f0-9]{64}$/.test(response.sessionToken) ||
        typeof response.expiresAt !== 'number' || !Number.isFinite(response.expiresAt) ||
        response.expiresAt <= Date.now() || response.expiresAt > Date.now() + 31 * 60 * 1000 ||
        apiUrl !== getApiUrl()) {
      return failure('Invalid login response', 'INVALID_RESPONSE');
    }
    const session: OwnerSession = { sessionToken: response.sessionToken, expiresAt: response.expiresAt, apiUrl, securityPolicy: response.securityPolicy };
    ownerSession = session;
  }
  return { success: response.success, error: response.error, code: response.code };
}

export async function logoutOwner(): Promise<ApiResponse> {
  const session = readSession();
  clearAdminSession();
  if (!session) return { success: true };
  return postJson({ action: 'logout', sessionToken: session.sessionToken }, true);
}

export async function lookupMember(memberId: string): Promise<MemberLookupResponse> {
  const baseUrl = getApiUrl();
  if (!baseUrl) return failure('System Error: API URL not configured', 'NOT_CONFIGURED');
  if (!isTrustedEndpoint(baseUrl)) return failure('Configure a Google Apps Script HTTPS /exec URL', 'NOT_CONFIGURED');
  if (typeof __GYM_PUBLIC_CONFIG__ !== 'undefined' && __GYM_PUBLIC_CONFIG__.lookupMode === 'capability') {
    return postJson<MemberLookupResponse>({ action: 'lookupMember', lookupToken: memberId });
  }
  try {
    const url = new URL(baseUrl);
    url.search = '';
    url.hash = '';
    url.searchParams.set('action', 'lookup');
    url.searchParams.set('id', memberId);
    return requestJson<MemberLookupResponse>(url.toString(), {}, true);
  } catch {
    return failure('Invalid API URL', 'NOT_CONFIGURED');
  }
}

async function postAdminAction<T extends ApiResponse>(payload: object, retryRead = false): Promise<T> {
  const session = readSession();
  if (!session) return failure('Please log in again', 'UNAUTHORIZED') as T;
  const response = await postJson<T>({ ...payload, sessionToken: session.sessionToken }, retryRead);
  // A late failure from an old session must not sign out a newer login.
  if (response.code === 'UNAUTHORIZED' && readSession()?.sessionToken === session.sessionToken) clearAdminSession();
  return response;
}

export function getAllMembers(): Promise<MembersListResponse> {
  return postAdminAction({ action: 'getAll' }, true);
}

export function addMember(member: NewMemberData): Promise<ApiResponse> {
  return postMutation({ action: 'addMember', member });
}

export function updateMember(member: Partial<Member> & { id: string }): Promise<ApiResponse> {
  return postMutation({ action: 'updateMember', member });
}

export function renewMembership(data: RenewalData): Promise<ApiResponse> {
  return postMutation({ action: 'renewMember', ...data });
}

export function deleteMember(memberId: string, expectedVersion?: string, stepUpToken?: string): Promise<ApiResponse> {
  return postMutation({ action: 'deleteMember', memberId, expectedVersion, stepUpToken });
}

async function postMutation(payload: Record<string, unknown>): Promise<ApiResponse> {
  const revision = authenticationRevision;
  const intent = { ...payload };
  delete intent.stepUpToken; // Fresh proof on retry does not change the mutation.
  const key = revision + ':' + JSON.stringify(intent);
  let operationId = pendingMutations.get(key);
  if (!operationId) {
    if (pendingMutations.size >= 20) return failure('Unconfirmed changes require review before continuing.', 'OPERATION_REVIEW_REQUIRED');
    operationId = mutationId();
    if (!operationId && readSession()?.securityPolicy?.historyEnabled) return failure('This browser cannot safely submit changes. Use a current HTTPS browser.', 'UNSUPPORTED_CLIENT');
    if (operationId) pendingMutations.set(key, operationId);
  }
  const response = await postAdminAction({ ...payload, operationId });
  if (revision === authenticationRevision && (response.success || !['NETWORK_ERROR', 'REQUEST_FAILED', 'HISTORY_REVIEW_REQUIRED'].includes(response.code || ''))) pendingMutations.delete(key);
  return response;
}

function mutationId(): string | undefined {
  // Current HTTPS browsers provide this; no weak Math.random fallback.
  return globalThis.crypto?.randomUUID?.();
}

export function getOwnerSecurityPolicy() {
  return readSession()?.securityPolicy;
}

export function reauthenticateOwner(password: string, purpose: string, memberId: string, expectedVersion?: string, archiveOperationId?: string) {
  return postAdminAction<ApiResponse & { stepUpToken?: string }>({ action: 'reauthenticate', password, purpose, memberId, expectedVersion, archiveOperationId });
}

// Owner-only migration interfaces. UI activation/distribution still requires
// approval; callers never need to extract or persist the owner session token.
export function issueMemberLookup(memberId: string, validDays?: number, stepUpToken?: string, expectedVersion?: string) {
  return postAdminAction<ApiResponse & { lookupToken?: string; expiresAt?: number }>({ action: 'issueMemberLookup', memberId, validDays, stepUpToken, expectedVersion });
}

export function revokeMemberLookup(memberId: string, stepUpToken?: string, expectedVersion?: string) {
  return postAdminAction({ action: 'revokeMemberLookup', memberId, stepUpToken, expectedVersion });
}

export function restoreMember(data: { memberId: string; archiveOperationId: string; expectedVersion?: string; notificationReconciliationConfirmed: boolean }, stepUpToken: string) {
  return postMutation({ action: 'restoreMember', ...data, stepUpToken });
}

interface IdentityChallenge { id: string; nonce: string; purpose: string; installationId: string; expiresAt: number }
type IdentityProvider = (request: { nonce: string; maxAge: number }) => Promise<string>;

// Provider SDK adapter: an approved PKCE/nonce sign-in supplies a short-lived ID
// token. No token is put in URLs/storage or accepted by the frontend as proof.
export async function loginOwnerWithIdentity(obtainIdToken: IdentityProvider): Promise<ApiResponse> {
  clearAdminSession();
  const revision = authenticationRevision;
  const apiUrl = getApiUrl();
  const started = await postJson<ApiResponse & { challenge?: IdentityChallenge }>({ action: 'beginOwnerIdentity', purpose: 'login' });
  if (!started.success || !started.challenge) return failure('Secure sign-in unavailable.', 'AUTH_UNAVAILABLE');
  try {
    const idToken = await obtainIdToken({ nonce: started.challenge.nonce, maxAge: 0 });
    const verified = await requestJson<ApiResponse & { proof?: object }>('/api/owner-identity', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, challenge: started.challenge }),
    });
    if (!verified.success || !verified.proof) return failure('Secure sign-in could not be verified.', 'INVALID_IDENTITY');
    const response = await postJson<LoginResponse>({ action: 'completeOwnerIdentity', proof: verified.proof }, false, apiUrl);
    if (revision !== authenticationRevision || apiUrl !== getApiUrl()) {
      if (response.sessionToken) await postJson({ action: 'logout', sessionToken: response.sessionToken }, true, apiUrl);
      return failure('Login was cancelled.', 'LOGIN_CANCELLED');
    }
    if (!response.success || typeof response.sessionToken !== 'string' || !/^[a-f0-9]{64}$/.test(response.sessionToken) ||
        typeof response.expiresAt !== 'number' || !Number.isFinite(response.expiresAt) || response.expiresAt <= Date.now() || response.expiresAt > Date.now() + 31 * 60000) {
      return failure('Secure sign-in could not be verified.', 'INVALID_IDENTITY');
    }
    ownerSession = { sessionToken: response.sessionToken, expiresAt: response.expiresAt, apiUrl, securityPolicy: response.securityPolicy };
    return { success: true };
  } catch { return failure('Secure sign-in could not be completed.', 'INVALID_IDENTITY'); }
}

export async function reauthenticateOwnerWithIdentity(obtainIdToken: IdentityProvider, purpose: string,
  memberId: string, expectedVersion?: string, archiveOperationId?: string): Promise<ApiResponse & { stepUpToken?: string }> {
  const revision = authenticationRevision;
  const started = await postAdminAction<ApiResponse & { challenge?: IdentityChallenge }>({ action: 'beginOwnerIdentity', purpose, memberId, expectedVersion, archiveOperationId });
  if (!started.success || !started.challenge) return failure('Secure confirmation unavailable.', 'AUTH_UNAVAILABLE');
  try {
    const idToken = await obtainIdToken({ nonce: started.challenge.nonce, maxAge: 0 });
    const verified = await requestJson<ApiResponse & { proof?: object }>('/api/owner-identity', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, challenge: started.challenge }),
    });
    if (revision !== authenticationRevision) return failure('Confirmation was cancelled.', 'LOGIN_CANCELLED');
    if (!verified.success || !verified.proof) return failure('Secure confirmation could not be verified.', 'INVALID_IDENTITY');
    return postAdminAction<ApiResponse & { stepUpToken?: string }>({ action: 'completeOwnerIdentity', proof: verified.proof });
  } catch { return failure('Secure confirmation could not be completed.', 'INVALID_IDENTITY'); }
}
