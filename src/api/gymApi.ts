// Credentials are sent only in POST bodies; the permanent password is never persisted.
import type {
  Member, MemberLookupResponse, MembersListResponse, ApiResponse,
  NewMemberData, RenewalData, OwnerSession, LoginResponse,
} from '../types/member';

const SESSION_KEY = 'gymOwnerSession';
export const SESSION_ENDED_EVENT = 'gym-owner-session-ended';

export function getApiUrl(): string {
  return localStorage.getItem('gymApiUrl') || '';
}

export function setApiUrl(url: string): void {
  if (url !== getApiUrl()) clearAdminSession();
  localStorage.setItem('gymApiUrl', url);
}

export function clearAdminSession(): void {
  const hadSession = sessionStorage.getItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('gymAdminPassword'); // Remove credentials left by older releases.
  if (hadSession) window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
}

function readSession(): OwnerSession | null {
  sessionStorage.removeItem('gymAdminPassword');
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (value && typeof value === 'object' && 'sessionToken' in value &&
        typeof value.sessionToken === 'string' && /^[a-f0-9]{64}$/.test(value.sessionToken) &&
        'expiresAt' in value && typeof value.expiresAt === 'number' &&
        Number.isFinite(value.expiresAt) && value.expiresAt > Date.now() &&
        'apiUrl' in value && value.apiUrl === getApiUrl()) {
      return value as OwnerSession;
    }
  } catch { /* Corrupt browser state must not authenticate the owner. */ }
  clearAdminSession();
  return null;
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

async function fetchWithTimeout(url: string, options: RequestInit = {}, retryRead = false): Promise<Response> {
  const attempts = retryRead ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      return await fetch(url, { ...options, signal: controller.signal, redirect: 'follow', cache: 'no-store' });
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
    const response = await fetchWithTimeout(url, options, retryRead);
    if (!response.ok) throw new Error('Server error');
    const data: unknown = await response.json();
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

function postJson<T extends ApiResponse>(payload: object, retryRead = false): Promise<T> {
  const url = getApiUrl();
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
  const apiUrl = getApiUrl();
  const response = await postJson<LoginResponse>({ action: 'login', ownerId, password });
  if (response.success) {
    if (typeof response.sessionToken !== 'string' || !/^[a-f0-9]{64}$/.test(response.sessionToken) ||
        typeof response.expiresAt !== 'number' || !Number.isFinite(response.expiresAt) ||
        response.expiresAt <= Date.now() || response.expiresAt > Date.now() + 31 * 60 * 1000 ||
        apiUrl !== getApiUrl()) {
      return failure('Invalid login response', 'INVALID_RESPONSE');
    }
    const session: OwnerSession = { sessionToken: response.sessionToken, expiresAt: response.expiresAt, apiUrl };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
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
  return postAdminAction({ action: 'addMember', member });
}

export function updateMember(member: Partial<Member> & { id: string }): Promise<ApiResponse> {
  return postAdminAction({ action: 'updateMember', member });
}

export function renewMembership(data: RenewalData): Promise<ApiResponse> {
  return postAdminAction({ action: 'renewMember', ...data });
}

export function deleteMember(memberId: string): Promise<ApiResponse> {
  return postAdminAction({ action: 'deleteMember', memberId });
}
