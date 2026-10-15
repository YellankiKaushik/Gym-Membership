
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Phone, Calendar, Award, Plus, Edit2, Trash2,
  RefreshCw, LogOut, CheckCircle, Loader2, Users,
  ChevronDown, X, Save, AlertTriangle, Search
} from 'lucide-react';
import {
  getAllMembers, loginOwner, logoutOwner, isAdminLoggedIn,
  getSessionExpiresAt, SESSION_ENDED_EVENT, addMember, renewMembership, deleteMember,
  getApiUrl, updateMember
} from '../api/gymApi';
import type { Member, NewMemberData } from '../types/member';
import WhatsAppReminder from '../components/WhatsAppReminder';
import MemberDialog from '../components/MemberDialog';
import { MEMBERSHIP_PLANS, gymToday, isMembershipDate, suggestedRenewalStart, renewalDateError, dayAfter, memberSummary, filterMembers, membershipState, type MembershipFilter } from '../utils/membership';

type ModalType = 'add' | 'edit' | 'renew' | 'delete' | null;


export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(isAdminLoggedIn);
  const [ownerId, setOwnerId] = useState('');
  const requestVersion = useRef(0);
  const loginAttempt = useRef(0);
  const [password, setPassword] = useState('');
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [filter, setFilter] = useState<MembershipFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form state for add/edit
  const [formData, setFormData] = useState<Partial<NewMemberData>>({
    id: '',
    name: '',
    phone: '',
    age: 0,
    weight: 0,
    membershipType: '3 Months',
    startDate: gymToday(),
  });

  // Renewal form state
  const [renewalData, setRenewalData] = useState({
    membershipType: '3 Months' as Member['membershipType'],
    startDate: gymToday(),
  });

  const resetOwnerView = useCallback(() => {
    requestVersion.current += 1;
    loginAttempt.current += 1;
    setIsAuthenticated(false);
    setMembers([]);
    setModal(null);
    setSelectedMember(null);
    setFormData({});
    setPassword('');
    setSuccess(null);
    setLoading(false);
  }, []);

  const handleLogout = useCallback(async () => {
    const pending = logoutOwner(); // Captures token, immediately clears browser session.
    resetOwnerView();
    const version = requestVersion.current;
    const response = await pending;
    if (version !== requestVersion.current) return;
    if (!response.success && response.code !== 'UNAUTHORIZED') {
      setError('Signed out locally. Server logout could not be confirmed; the session expires within 30 minutes.');
    }
  }, [resetOwnerView]);

  const fetchMembers = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const response = await getAllMembers();
      if (version !== requestVersion.current || !isAdminLoggedIn()) return;
      if (response.success && Array.isArray(response.members)) {
        setMembers(response.members);
        setLastRefresh(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(new Date()));
      } else {
        setError(response.error || 'Failed to fetch members');
      }
    } catch {
      if (version === requestVersion.current) setError('Failed to fetch members');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdminLoggedIn()) void fetchMembers();
    return () => {
      requestVersion.current += 1;
      loginAttempt.current += 1;
    };
  }, [fetchMembers]);

  useEffect(() => {
    const onSessionEnded = () => {
      resetOwnerView();
      setError('Session ended. Please log in again.');
    };
    window.addEventListener(SESSION_ENDED_EVENT, onSessionEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onSessionEnded);
  }, [resetOwnerView]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const expiresAt = getSessionExpiresAt();
    if (!expiresAt) return;
    // Activity cannot extend this absolute server-issued expiration.
    const absoluteTimer = window.setTimeout(() => { void handleLogout(); }, Math.max(0, expiresAt - Date.now()));
    let idleTimer: number;
    const resetTimer = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => { void handleLogout(); }, 30 * 60 * 1000);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      window.clearTimeout(absoluteTimer);
      window.clearTimeout(idleTimer);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated, handleLogout]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!getApiUrl()) {
      setError('Owner login is currently unavailable. Ask the installer to configure this gym.');
      return;
    }
    const pending = loginOwner(ownerId.trim(), password);
    const attempt = ++loginAttempt.current;
    setLoading(true);
    setError(null);
    try {
      const response = await pending;
      if (attempt !== loginAttempt.current || response.code === 'LOGIN_CANCELLED') return;
      setPassword('');
      if (response.success) {
        setIsAuthenticated(true);
        await fetchMembers();
      } else {
        setError(response.error || 'Login failed');
      }
    } catch {
      if (attempt === loginAttempt.current) setError('Login failed. Please try again.');
    } finally {
      if (attempt === loginAttempt.current) {
        setPassword('');
        setLoading(false);
      }
    }
  };

  const openAddModal = () => {
    setError(null);
    setFormData({
      id: '',
      name: '',
      phone: '',
      age: 25,
      weight: 70,
      membershipType: '3 Months',
      startDate: gymToday(),
    });
    setModal('add');
  };

  const openEditModal = (member: Member) => {
    setError(null);
    setSelectedMember(member);
    setFormData({
      id: member.id,
      name: member.name,
      phone: member.phone,
      age: member.age,
      weight: member.weight,
      membershipType: member.membershipType,
      startDate: member.startDate,
    });
    setModal('edit');
  };

  const openRenewModal = (member: Member) => {
    setError(null);
    setSelectedMember(member);
    setRenewalData({
      membershipType: member.membershipType,
      startDate: suggestedRenewalStart(member.endDate),
    });
    setModal('renew');
  };

  const openDeleteModal = (member: Member) => {
    setError(null);
    setSelectedMember(member);
    setModal('delete');
  };

  const closeModal = useCallback(() => {
    setModal(null);
    setSelectedMember(null);
    setError(null);
  }, []);

  const handleAddMember = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();

    const version = requestVersion.current;
    const name = String(formData.name || '').trim();
    const phone = String(formData.phone || '').trim();
    const age = Number(formData.age);
    const weight = Number(formData.weight);
    const startDate = String(formData.startDate || '').trim();

    if (!name) {
      setError('Name is required');
      return;
    }
    if (!/^[+\d ()-]+$/.test(phone) || !(/^(?:91)?\d{10}$/.test(phone.replace(/\D/g, '')))) {
      setError('Enter a 10-digit phone number, optionally with +91.');
      return;
    }
    if (!Number.isInteger(age) || age <= 0 || age > 120) {
      setError('Age must be a whole number from 1 to 120.');
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0 || weight > 500) {
      setError('Weight must be greater than 0, up to 500 kg.');
      return;
    }
    if (!isMembershipDate(startDate)) {
      setError('Enter a valid start date as YYYY-MM-DD.');
      return;
    }


    setLoading(true);
    setError(null);

    const newMemberData: NewMemberData = {
      name: name,
      phone: phone,
      age: age,
      weight: weight,
      membershipType: formData.membershipType || '3 Months',
      startDate: startDate
    };

    try {
      const response = await addMember(newMemberData);

      if (version !== requestVersion.current || !isAdminLoggedIn()) return;
      if (response.success) {
        setSuccess(`Member added. ID: ${response.memberId || 'refresh to confirm'}`);
        closeModal();
        await fetchMembers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || 'Failed to add member');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      if (version === requestVersion.current && isAdminLoggedIn()) setLoading(false);
    }
  };


  const handleEditMember = async (e?: React.MouseEvent) => {
    e?.preventDefault();

    if (!selectedMember) {
      setError("No member selected for editing");
      return;
    }

    const version = requestVersion.current;
    const rawName = String(formData.name || '').trim();
    const rawPhone = String(formData.phone || '').trim();
    const rawAge = Number(formData.age);
    const rawWeight = Number(formData.weight);
    const rawStartDate = String(formData.startDate || '').trim();

    if (!rawName) {
      setError('Name is required');
      return;
    }
    if (!/^[+\d ()-]+$/.test(rawPhone) || !(/^(?:91)?\d{10}$/.test(rawPhone.replace(/\D/g, '')))) {
      setError('Enter a 10-digit phone number, optionally with +91.');
      return;
    }
    if (!Number.isInteger(rawAge) || rawAge <= 0 || rawAge > 120) {
      setError('Age must be a whole number from 1 to 120.');
      return;
    }
    if (!Number.isFinite(rawWeight) || rawWeight <= 0 || rawWeight > 500) {
      setError('Weight must be greater than 0, up to 500 kg.');
      return;
    }
    if (!isMembershipDate(rawStartDate)) {
      setError('Enter a valid start date as YYYY-MM-DD.');
      return;
    }


    setLoading(true);
    setError(null);

    const payload: Member = {
      id: selectedMember.id,
      version: selectedMember.version,
      name: rawName,
      phone: rawPhone,
      age: rawAge,
      weight: rawWeight,
      membershipType: formData.membershipType || selectedMember.membershipType,
      startDate: rawStartDate,
      endDate: selectedMember.endDate,
      status: selectedMember.status,
    };

    try {
      const response = await updateMember(payload as Member);

      if (version !== requestVersion.current || !isAdminLoggedIn()) return;
      if (response.success) {
        setSuccess('Member updated successfully!');
        closeModal();
        await fetchMembers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || 'Failed to update member');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member');
    } finally {
      if (version === requestVersion.current && isAdminLoggedIn()) setLoading(false);
    }
  };

  const handleRenewMember = async () => {
    if (!selectedMember) return;
    const dateError = renewalDateError(renewalData.startDate, selectedMember.endDate);
    if (dateError) { setError(dateError); return; }
    const version = requestVersion.current;
    setLoading(true);
    setError(null);

    try {
      const response = await renewMembership({
        memberId: selectedMember.id,
        expectedVersion: selectedMember.version,
        membershipType: renewalData.membershipType,
        startDate: renewalData.startDate,
      });
      if (version !== requestVersion.current || !isAdminLoggedIn()) return;
      if (response.success) {
        setSuccess(`Membership renewed! New end date: ${response.newEndDate || 'refresh the member list to confirm'}`);
        closeModal();
        await fetchMembers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || 'Failed to renew membership');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to renew membership');
    } finally {
      if (version === requestVersion.current && isAdminLoggedIn()) setLoading(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!selectedMember) return;
    const version = requestVersion.current;
    setLoading(true);
    setError(null);

    try {
      const response = await deleteMember(selectedMember.id, selectedMember.version);
      if (version !== requestVersion.current || !isAdminLoggedIn()) return;
      if (response.success) {
        setSuccess('Member deleted successfully!');
        closeModal();
        await fetchMembers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || 'Failed to delete member');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete member');
    } finally {
      if (version === requestVersion.current && isAdminLoggedIn()) setLoading(false);
    }
  };

  const filteredMembers = filterMembers(members, filter, searchTerm);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const paginatedMembers = filteredMembers.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const stats = memberSummary(members);

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-[65vh] py-10 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4 shadow-lg shadow-purple-500/30">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Owner Login</h1>
            <p className="text-purple-200/70 text-sm">Enter your Owner ID and password to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="owner-id" className="block text-sm text-slate-300 mb-1">Owner ID</label>
              <input
                id="owner-id"
                type="text"
                autoComplete="username"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                required
                maxLength={128}
                disabled={loading}
                className="w-full px-4 py-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label htmlFor="owner-password" className="block text-sm text-slate-300 mb-1">Password</label>
              <input
                id="owner-password"
                type="password"
                autoComplete="current-password"
                required
                minLength={12}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter owner password"
                className="w-full px-4 py-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={loading}
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm text-center"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-2xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Login
                </>
              )}
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Owner Dashboard</h1>
              <p className="text-xs text-slate-300">Manage Members</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Success Toast */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:max-w-lg z-50 bg-emerald-500/90 backdrop-blur-lg text-white px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            <span role="status">{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 text-center"
          >
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-slate-300">Total Members</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-emerald-500/20 border border-emerald-500/30 rounded-2xl p-4 text-center"
          >
            <div className="text-2xl font-bold text-emerald-300">{stats.active}</div>
            <div className="text-xs text-emerald-300/60">Active Members</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-red-500/20 border border-red-500/30 rounded-2xl p-4 text-center"
          >
            <div className="text-2xl font-bold text-red-300">{stats.expired}</div>
            <div className="text-xs text-red-300/60">Expired Members</div>
          </motion.div>
          <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-amber-200">{stats.expiring}</div>
            <div className="text-xs text-amber-200">Expiring Soon</div>
          </div>
        </div>

        <p className="text-xs text-slate-300 mb-4">{lastRefresh ? `Last refreshed at ${lastRefresh} IST. ` : ''}Refresh to load changes made in Google Sheets. Expiring Soon includes today through seven days away.</p>
        {/* Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              aria-pressed={filter === 'all'}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === 'all'
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-purple-300 hover:bg-white/10'
                }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('active')}
              aria-pressed={filter === 'active'}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === 'active'
                ? 'bg-emerald-500/30 text-emerald-300'
                : 'bg-white/5 text-purple-300 hover:bg-white/10'
                }`}
            >
              Active
            </button>
            <button onClick={() => setFilter('expiring')} aria-pressed={filter === 'expiring'} className="px-4 py-2 rounded-xl text-sm bg-amber-500/20 text-amber-200">Expiring Soon</button>
            <button
              onClick={() => setFilter('expired')}
              aria-pressed={filter === 'expired'}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === 'expired'
                ? 'bg-red-500/30 text-red-300'
                : 'bg-white/5 text-purple-300 hover:bg-white/10'
                }`}
            >
              Expired
            </button>
          </div>

          <div className="w-full sm:flex-1 sm:min-w-52 sm:max-w-sm relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-slate-300" />
            </div>
            <input
              type="text"
              aria-label="Search members by ID, name, or phone"
              placeholder="Search by ID, name, or phone"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-purple-300/30 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"
            />
            {searchTerm && (
              <button
                aria-label="Clear member search"
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-label="Refresh members"
              onClick={fetchMembers}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /><span>Refresh</span>
            </button>
            <button
              onClick={openAddModal}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
              <span>Add Member</span>
            </button>
          </div>
        </div>

        {/* Global Error Display */}
        {error && !modal && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-2xl flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div role="alert" className="text-red-200 text-sm">
              <strong className="block font-semibold mb-1">Unable to complete action</strong>
              {error}
            </div>
          </motion.div>
        )}

        {/* Members List */}
        {loading && members.length === 0 ? (
          <div role="status" aria-label="Loading members" className="flex items-center justify-center gap-3 py-20">Loading members
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10">
            <Users className="w-12 h-12 text-purple-400/20 mx-auto mb-4" />
            <p className="text-white font-medium">No members found</p>
            <p className="text-slate-300 text-sm mt-1">{members.length === 0 ? 'Add your first member to get started.' : 'Try adjusting your search or filters.'}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedMembers.map((member, index) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-xs text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">
                        {member.id || 'N/A'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${membershipState(member.endDate).expiringSoon ? 'bg-amber-500/20 text-amber-200' : membershipState(member.endDate).status === 'Active'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-red-500/20 text-red-300'
                        }`}>
                        {membershipState(member.endDate).expiringSoon ? 'Expiring Soon' : membershipState(member.endDate).status}
                      </span>
                    </div>
                    <h3 className="text-white font-semibold truncate">{member.name || 'N/A'}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-300">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {member.phone || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" />
                        {member.membershipType || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {member.endDate || 'N/A'} · {Math.max(0, membershipState(member.endDate).daysRemaining)} days left
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <WhatsAppReminder member={member} />
                    <button
                      onClick={() => openRenewModal(member)}
                      disabled={loading}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-emerald-500/20 hover:bg-emerald-500/30 rounded-xl text-emerald-300 transition-all disabled:opacity-50"
                      aria-label={`Renew ${member.name}`} title="Renew"
                    >
                      <RefreshCw className="w-4 h-4" />Renew
                    </button>
                    <button
                      onClick={() => openEditModal(member)}
                      disabled={loading}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 rounded-xl text-blue-300 transition-all disabled:opacity-50"
                      aria-label={`Edit ${member.name}`} title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />Edit
                    </button>
                    <button
                      onClick={() => openDeleteModal(member)}
                      disabled={loading}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-red-500/20 hover:bg-red-500/30 rounded-xl text-red-300 transition-all disabled:opacity-50"
                      aria-label={`Delete ${member.name}`} title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />Delete
                    </button>
                  </div>
                </div>
              </motion.div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, Math.min(prev, totalPages) - 1))}
                  disabled={page === 1 || loading}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-purple-300 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                  Previous
                </button>
                <div className="text-sm text-slate-300">
                  Page <span className="text-white font-bold">{page}</span> of {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages || loading}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-purple-300 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {modal && (
          <MemberDialog busy={loading} onClose={closeModal}>
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 id="member-dialog-title" className="text-xl font-bold text-white">
                  {modal === 'add' && 'Add New Member'}
                  {modal === 'edit' && 'Edit Member'}
                  {modal === 'renew' && 'Renew Membership'}
                  {modal === 'delete' && 'Delete Member'}
                </h2>
                <button
                  onClick={closeModal}
                  disabled={loading} aria-label="Close member dialog"
                  className="p-2 hover:bg-white/10 rounded-xl text-purple-300 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div role="alert" className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
                  {error}
                </div>
              )}

              {/* Add/Edit Form */}
              {(modal === 'add' || modal === 'edit') && (
                <form onSubmit={event => { event.preventDefault(); if (modal === 'add') void handleAddMember(); else void handleEditMember(); }}><fieldset disabled={loading} className="space-y-4">
                  {modal === 'edit' && (
                    <div>
                      <label htmlFor="edit-member-id" className="block text-sm text-slate-300 mb-1">Member ID</label>
                      <input id="edit-member-id"
                        type="text"
                        value={formData.id || ''}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white opacity-50 cursor-not-allowed focus:outline-none"
                        disabled
                      />
                    </div>
                  )}
                  <div>
                    <label htmlFor="member-name" className="block text-sm text-slate-300 mb-1">Name</label>
                    <input id="member-name" required maxLength={120}
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="member-phone" className="block text-sm text-slate-300 mb-1">Phone</label>
                    <input id="member-phone" required maxLength={24} autoComplete="tel"
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="member-age" className="block text-sm text-slate-300 mb-1">Age</label>
                      <input id="member-age" required min={1} max={120} step={1} inputMode="numeric"
                        type="number"
                        value={formData.age || ''}
                        onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="member-weight" className="block text-sm text-slate-300 mb-1">Weight (kg)</label>
                      <input id="member-weight" required min={0.1} max={500} step="any" inputMode="decimal"
                        type="number"
                        value={formData.weight || ''}
                        onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="member-plan" className="block text-sm text-slate-300 mb-1">Membership Type</label>
                    <div className="relative">
                      <select id="member-plan"
                        value={formData.membershipType || '3 Months'}
                        onChange={(e) => setFormData({ ...formData, membershipType: e.target.value as Member['membershipType'] })}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {MEMBERSHIP_PLANS.map(plan => <option key={plan} value={plan}>{plan}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300 pointer-events-none" />
                    </div>
                  </div>
                  {modal === 'edit' && <p className="text-sm text-purple-200/70">
                    Changing the start date or plan recalculates expiry. Contact-only edits preserve the existing expiry.
                  </p>}
                  <div>
                    <label htmlFor="member-start" className="block text-sm text-slate-300 mb-1">Start Date</label>
                    <input id="member-start" required min="1900-01-01" max="9999-12-31"
                      type="date"
                      value={formData.startDate || ''}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-2xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        {modal === 'add' ? 'Add Member' : 'Save Changes'}
                      </>
                    )}
                  </button>


                </fieldset></form>
              )}

              {/* Renew Form */}
              {modal === 'renew' && selectedMember && (
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-slate-300 text-sm">Renewing membership for:</p>
                    <p className="text-white font-semibold">{selectedMember.name} ({selectedMember.id})</p>
                    <p className="text-slate-300 text-sm">Current: {selectedMember.membershipType} • Expires: {selectedMember.endDate}</p>
                  </div>
                  <div>
                    <label htmlFor="renew-plan" className="block text-sm text-slate-300 mb-1">New Membership Type</label>
                    <div className="relative">
                      <select id="renew-plan"
                        value={renewalData.membershipType}
                        onChange={(e) => setRenewalData({ ...renewalData, membershipType: e.target.value as Member['membershipType'] })}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {MEMBERSHIP_PLANS.map(plan => <option key={plan} value={plan}>{plan}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="renew-start" className="block text-sm text-slate-300 mb-1">New Start Date</label>
                    <input id="renew-start"
                      type="date"
                      value={renewalData.startDate}
                      min={dayAfter(selectedMember.endDate)}
                      onChange={(e) => setRenewalData({ ...renewalData, startDate: e.target.value })}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <p className="text-sm text-purple-200/70">
                    Current expiry is inclusive. Renewal must start after {selectedMember.endDate}.
                    The suggested date preserves paid time. Your entered date is used exactly;
                    an overlap is rejected. Choosing a later date leaves a gap.
                  </p>
                  <button
                    onClick={handleRenewMember}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5" />
                        Renew Membership
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Delete Confirmation */}
              {modal === 'delete' && selectedMember && (
                <div className="space-y-4">
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <p className="text-white font-semibold mb-1">Are you sure?</p>
                    <p className="text-red-300/70 text-sm">
                      This will permanently delete <strong>{selectedMember.name}</strong> ({selectedMember.id}) from the system.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={closeModal}
                      disabled={loading}
                      className="py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteMember}
                      disabled={loading}
                      className="py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
          </MemberDialog>
        )}
      </AnimatePresence>
    </div>
  );
}
