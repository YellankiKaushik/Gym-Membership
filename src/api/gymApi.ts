// Gym Membership API Client

import type {
  Member,
  MemberLookupResponse,
  MembersListResponse,
  ApiResponse,
  NewMemberData,
  RenewalData
} from '../types/member';

export function getApiUrl(): string {
  return localStorage.getItem('gymApiUrl') || '';
}

export function setApiUrl(url: string): void {
  localStorage.setItem('gymApiUrl', url);
}

export function getAdminPassword(): string {
  return sessionStorage.getItem('gymAdminPassword') || '';
}

export function setAdminPassword(password: string): void {
  sessionStorage.setItem('gymAdminPassword', password);
}

export function clearAdminSession(): void {
  sessionStorage.removeItem('gymAdminPassword');
}

export function isAdminLoggedIn(): boolean {
  return !!sessionStorage.getItem('gymAdminPassword');
}

/* CORE FETCH HELPER */

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 20000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'follow'
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/* PUBLIC */

export async function lookupMember(memberId: string): Promise<MemberLookupResponse> {
  const baseUrl = getApiUrl();
  if (!baseUrl) return { success: false, error: 'System Error: API URL not configured' };
  const url = `${baseUrl}?action=lookup&id=${encodeURIComponent(memberId)}`;

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error('Server error');
    return await response.json();
  } catch (err: any) {
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Request timed out' : 'Network error'
    };
  }
}

export async function getAllMembers(): Promise<MembersListResponse> {
  const baseUrl = getApiUrl();
  if (!baseUrl) return { success: false, error: 'System Error: API URL not configured' };
  const password = getAdminPassword();
  const url = `${baseUrl}?action=getAll&password=${encodeURIComponent(password)}`;

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error('Server error');
    return await response.json();
  } catch (err: any) {
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Request timed out' : 'Network error'
    };
  }
}

/* ADMIN CRUD */

export async function addMember(memberData: NewMemberData): Promise<ApiResponse> {
  return postAdminAction({ 
    action: 'addMember', 
    member: memberData 
  });
}

export async function updateMember(
  memberData: Partial<Member> & { id: string }
): Promise<ApiResponse> {
  return postAdminAction({ 
    action: 'updateMember', 
    member: memberData 
  });
}

export async function renewMembership(renewalData: RenewalData): Promise<ApiResponse> {
  return postAdminAction({ 
    action: 'renewMember', 
    memberId: renewalData.memberId,
    membershipType: renewalData.membershipType,
    startDate: renewalData.startDate
  });
}

export async function deleteMember(memberId: string): Promise<ApiResponse> {
  return postAdminAction({ action: 'deleteMember', memberId });
}

/* CORE POST */

async function postAdminAction(payload: any): Promise<ApiResponse> {
  const baseUrl = getApiUrl();
  if (!baseUrl) return { success: false, error: 'System Error: API URL not configured' };

  try {
    const response = await fetchWithTimeout(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify({
        password: getAdminPassword(),
        ...payload
      })
    });

    if (!response.ok) throw new Error('Server error');
    return await response.json();
  } catch (err: any) {
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Request timed out' : 'Network error'
    };
  }
}

/* AUTH */

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const baseUrl = getApiUrl();
  if (!baseUrl) throw new Error('System Error: API URL not configured');

  const url = `${baseUrl}?action=getAll&password=${encodeURIComponent(password)}`;

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error('Server error');
    const data = await response.json();

    if (data.success) {
      setAdminPassword(password);
      return true;
    }
  } catch (err) {
    // Auth check failed
  }
  return false;
}