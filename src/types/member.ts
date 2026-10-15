import type { MembershipPlan } from '../utils/membership';

// Member data types for the Gym Membership System

export interface Member {
    id: string;
    name: string;
    phone: string;
    age: number;
    weight: number;
    membershipType: MembershipPlan;
    startDate: string;
    endDate: string;
    status: 'Active' | 'Expired';
    daysRemaining?: number;
    notified?: boolean;
  }

  export interface MemberLookupResponse {
    success: boolean;
    member?: PublicMember;
    error?: string;
  }

  export interface MembersListResponse {
    success: boolean;
    members?: Member[];
    error?: string;
  }

  export interface ApiResponse {
    success: boolean;
    message?: string;
    error?: string;
    newEndDate?: string;
    code?: string;
  }

  export interface NewMemberData {
    id?: string;
    name: string;
    phone: string;
    age: number;
    weight: number;
    membershipType: MembershipPlan;
    startDate: string;
  }

  export interface RenewalData {
    memberId: string;
    membershipType: MembershipPlan;
    startDate: string;
  }

export type PublicMember = Pick<Member,
  'id' | 'name' | 'phone' | 'membershipType' | 'startDate' | 'endDate' | 'status' | 'daysRemaining'>;

export interface OwnerSession {
  sessionToken: string;
  expiresAt: number;
  apiUrl: string;
}

export interface LoginResponse extends ApiResponse {
  sessionToken?: string;
  expiresAt?: number;
}
