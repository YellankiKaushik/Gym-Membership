
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Phone, Calendar, Award, Plus, Edit2, Trash2,
  RefreshCw, LogOut, CheckCircle, Loader2, Users,
  ChevronDown, X, Save, AlertTriangle
} from 'lucide-react';
import {
  getAllMembers, verifyAdminPassword, isAdminLoggedIn,
  clearAdminSession, addMember, renewMembership, deleteMember,
  getApiUrl, updateMember
} from '../api/gymApi';
import type { Member, NewMemberData } from '../types/member';

type ModalType = 'add' | 'edit' | 'renew' | 'delete' | null;

const generateMemberId = (members: Member[]): string => {
  if (members.length === 0) return '001';
  const maxIdInt = Math.max(
    ...members.map(m => parseInt(m.id, 10) || 0)
  );
  return String(maxIdInt + 1).padStart(3, '0');
};

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all');

  // Form state for add/edit
  const [formData, setFormData] = useState<Partial<NewMemberData>>({
    id: '',
    name: '',
    phone: '',
    age: 0,
    weight: 0,
    membershipType: '3 Months',
    startDate: new Date().toISOString().split('T')[0],
  });

  // Renewal form state
  const [renewalData, setRenewalData] = useState({
    membershipType: '3 Months' as '3 Months' | '6 Months' | '1 Year',
    startDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (isAdminLoggedIn()) {
      setIsAuthenticated(true);
      fetchMembers();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!getApiUrl()) {
      setError('API URL not configured. Please set up first.');
      setLoading(false);
      return;
    }

    try {
      const success = await verifyAdminPassword(password);
      if (success) {
        setIsAuthenticated(true);
        fetchMembers();
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAdminSession();
    setIsAuthenticated(false);
    setMembers([]);
    setPassword('');
  };

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getAllMembers();
      if (response.success && response.members) {
        setMembers(response.members);
      } else {
        setError(response.error || 'Failed to fetch members');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch members');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setFormData({
      id: '',
      name: '',
      phone: '',
      age: 25,
      weight: 70,
      membershipType: '3 Months',
      startDate: new Date().toISOString().split('T')[0],
    });
    setModal('add');
  };

  const openEditModal = (member: Member) => {
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
    setSelectedMember(member);
    setRenewalData({
      membershipType: member.membershipType,
      startDate: new Date().toISOString().split('T')[0],
    });
    setModal('renew');
  };

  const openDeleteModal = (member: Member) => {
    setSelectedMember(member);
    setModal('delete');
  };

  const closeModal = () => {
    setModal(null);
    setSelectedMember(null);
  };

  const handleAddMember = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();

    // 🚨 VALIDATION START
    const name = formData.name?.trim() || '';
    const phone = (formData.phone || '').replace(/\D/g, '');
    const age = Number(formData.age);
    const weight = Number(formData.weight);
    const startDate = formData.startDate?.trim() || '';

    if (!name) {
      setError('Name is required');
      return;
    }
    if (!phone || phone.length !== 10) {
      setError('Phone must be exactly 10 digits');
      return;
    }
    if (isNaN(age) || age <= 0) {
      setError('Age must be a valid number greater than 0');
      return;
    }
    if (isNaN(weight) || weight <= 0) {
      setError('Weight must be a valid number greater than 0');
      return;
    }
    if (!startDate) {
      setError('Start date is required');
      return;
    }
    // 🚨 VALIDATION END

    setLoading(true);
    setError(null);

    // Auto-generate ID just before payload creation (ignore formData.id)
    const generatedId = generateMemberId(members);

    const newMemberData: NewMemberData = {
      id: generatedId,
      name: name,
      phone: phone,
      age: age,
      weight: weight,
      membershipType: formData.membershipType || '3 Months',
      startDate: startDate
    };

    try {
      const response = await addMember(newMemberData);

      if (response.success) {
        setSuccess('Member added successfully!');
        closeModal();
        fetchMembers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || 'Failed to add member');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };


  const handleEditMember = async (e?: React.MouseEvent) => {
    e?.preventDefault();

    if (!selectedMember) {
      setError("No member selected for editing");
      return;
    }

    // 🚨 VALIDATION START
    const rawName = formData.name?.trim() || '';
    const rawPhone = (formData.phone || '').replace(/\D/g, '');
    const rawAge = Number(formData.age);
    const rawWeight = Number(formData.weight);
    const rawStartDate = formData.startDate?.trim() || '';

    if (!rawName) {
      setError('Name is required');
      return;
    }
    if (!rawPhone || rawPhone.length !== 10) {
      setError('Phone must be exactly 10 digits');
      return;
    }
    if (isNaN(rawAge) || rawAge <= 0) {
      setError('Age must be a valid number greater than 0');
      return;
    }
    if (isNaN(rawWeight) || rawWeight <= 0) {
      setError('Weight must be a valid number greater than 0');
      return;
    }
    if (!rawStartDate) {
      setError('Start date is required');
      return;
    }
    // 🚨 VALIDATION END

    setLoading(true);
    setError(null);

    const payload: Member = {
      id: selectedMember.id,
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

      if (response.success) {
        setSuccess('Member updated successfully!');
        closeModal();
        fetchMembers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || 'Failed to update member');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member');
    } finally {
      setLoading(false);
    }
  };

  const handleRenewMember = async () => {
    if (!selectedMember) return;
    setLoading(true);
    setError(null);

    try {
      const response = await renewMembership({
        memberId: selectedMember.id,
        membershipType: renewalData.membershipType,
        startDate: renewalData.startDate,
      });
      if (response.success) {
        setSuccess(`Membership renewed! New end date: ${response.newEndDate}`);
        closeModal();
        fetchMembers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || 'Failed to renew membership');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to renew membership');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!selectedMember) return;
    setLoading(true);
    setError(null);

    try {
      const response = await deleteMember(selectedMember.id);
      if (response.success) {
        setSuccess('Member deleted successfully!');
        closeModal();
        fetchMembers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || 'Failed to delete member');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete member');
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(m => {
    if (filter === 'all') return true;
    if (filter === 'active') return m.status === 'Active';
    if (filter === 'expired') return m.status === 'Expired';
    return true;
  });

  const stats = {
    total: members.length,
    active: members.filter(m => m.status === 'Active').length,
    expired: members.filter(m => m.status === 'Expired').length,
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4 shadow-lg shadow-purple-500/30">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Admin Login</h1>
            <p className="text-purple-200/70 text-sm">Enter your password to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
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
              <h1 className="text-lg font-bold text-white">Admin Panel</h1>
              <p className="text-xs text-purple-300/60">Manage Members</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
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
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/90 backdrop-blur-lg text-white px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 text-center"
          >
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-purple-300/60">Total</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-emerald-500/20 border border-emerald-500/30 rounded-2xl p-4 text-center"
          >
            <div className="text-2xl font-bold text-emerald-300">{stats.active}</div>
            <div className="text-xs text-emerald-300/60">Active</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-red-500/20 border border-red-500/30 rounded-2xl p-4 text-center"
          >
            <div className="text-2xl font-bold text-red-300">{stats.expired}</div>
            <div className="text-xs text-red-300/60">Expired</div>
          </motion.div>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === 'all'
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-purple-300 hover:bg-white/10'
                }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === 'active'
                ? 'bg-emerald-500/30 text-emerald-300'
                : 'bg-white/5 text-purple-300 hover:bg-white/10'
                }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilter('expired')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === 'expired'
                ? 'bg-red-500/30 text-red-300'
                : 'bg-white/5 text-purple-300 hover:bg-white/10'
                }`}
            >
              Expired
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchMembers}
              disabled={loading}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Add Member</span>
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
            <div className="text-red-300 text-sm">
              <strong className="block font-semibold mb-1">System Error</strong>
              {error}
            </div>
          </motion.div>
        )}

        {/* Members List */}
        {loading && members.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-purple-400/30 mx-auto mb-4" />
            <p className="text-purple-300/50">No members found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMembers.map((member, index) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-xs text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">
                        {member.id || 'N/A'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${member.status === 'Active'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-red-500/20 text-red-300'
                        }`}>
                        {member.status || 'N/A'}
                      </span>
                    </div>
                    <h3 className="text-white font-semibold truncate">{member.name || 'N/A'}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-purple-300/70">
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
                        {member.endDate || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openRenewModal(member)}
                      className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-xl text-emerald-300 transition-all"
                      title="Renew"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(member)}
                      className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-xl text-blue-300 transition-all"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(member)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-red-300 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full sm:max-w-md bg-slate-900 border border-white/20 rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {modal === 'add' && 'Add New Member'}
                  {modal === 'edit' && 'Edit Member'}
                  {modal === 'renew' && 'Renew Membership'}
                  {modal === 'delete' && 'Delete Member'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-white/10 rounded-xl text-purple-300 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
                  {error}
                </div>
              )}

              {/* Add/Edit Form */}
              {(modal === 'add' || modal === 'edit') && (
                <div className="space-y-4">
                  {modal === 'edit' && (
                    <div>
                      <label className="block text-sm text-purple-300/70 mb-1">Member ID</label>
                      <input
                        type="text"
                        value={formData.id || ''}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white opacity-50 cursor-not-allowed focus:outline-none"
                        disabled
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm text-purple-300/70 mb-1">Name</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-purple-300/70 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-purple-300/70 mb-1">Age</label>
                      <input
                        type="number"
                        value={formData.age || ''}
                        onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-purple-300/70 mb-1">Weight (kg)</label>
                      <input
                        type="number"
                        value={formData.weight || ''}
                        onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-purple-300/70 mb-1">Membership Type</label>
                    <div className="relative">
                      <select
                        value={formData.membershipType || '3 Months'}
                        onChange={(e) => setFormData({ ...formData, membershipType: e.target.value as any })}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="3 Months">3 Months</option>
                        <option value="6 Months">6 Months</option>
                        <option value="1 Year">1 Year</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-purple-300/70 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate || ''}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      if (modal === 'add') handleAddMember(e);
                      if (modal === 'edit') handleEditMember(e);
                    }}
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


                </div>
              )}

              {/* Renew Form */}
              {modal === 'renew' && selectedMember && (
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-purple-300/70 text-sm">Renewing membership for:</p>
                    <p className="text-white font-semibold">{selectedMember.name} ({selectedMember.id})</p>
                    <p className="text-purple-300/50 text-sm">Current: {selectedMember.membershipType} • Expires: {selectedMember.endDate}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-purple-300/70 mb-1">New Membership Type</label>
                    <div className="relative">
                      <select
                        value={renewalData.membershipType}
                        onChange={(e) => setRenewalData({ ...renewalData, membershipType: e.target.value as any })}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="3 Months">3 Months</option>
                        <option value="6 Months">6 Months</option>
                        <option value="1 Year">1 Year</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-purple-300/70 mb-1">New Start Date</label>
                    <input
                      type="date"
                      value={renewalData.startDate}
                      onChange={(e) => setRenewalData({ ...renewalData, startDate: e.target.value })}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}