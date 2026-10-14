import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  User,
  Phone,
  Calendar,
  Award,
  Clock,
  Loader2,
  XCircle,
} from 'lucide-react';
import { lookupMember, getApiUrl } from '../api/gymApi';
import type { PublicMember } from '../types/member';

// Gym gallery images
import gym1 from '../assets/gym/gym1.jpg';
import gym2 from '../assets/gym/gym2.jpg';
import gym3 from '../assets/gym/gym3.jpg';

export default function MemberLookup() {
  const [memberId, setMemberId] = useState('');
  const [member, setMember] = useState<PublicMember | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!memberId.trim()) {
      setError('Please enter a Member ID');
      return;
    }

    if (!getApiUrl()) {
      setError('System not configured. Please contact the gym administrator.');
      return;
    }

    setLoading(true);
    setError(null);
    setMember(null);
    setSearched(true);

    try {
      const response = await lookupMember(memberId.trim());
      if (response.success && response.member) {
        setMember(response.member);
      } else {
        setError(response.error || 'Member not found');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetSearch = () => {
    setMemberId('');
    setMember(null);
    setError(null);
    setSearched(false);
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
      {/* HEADER */}
      <header className="pt-8 pb-4 px-4 text-center">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4 shadow-lg">
            <Award className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Gym Membership</h1>
        </motion.div>
      </header>

      {/* MAIN */}
      <main className="flex-1 px-4 pb-16">
        <div className="max-w-md mx-auto">
          {/* SEARCH FORM */}
          <motion.form
            onSubmit={handleSearch}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-purple-400" />
              </div>
              <input
                type="text"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value.toUpperCase())}
                placeholder="Enter Member ID"
                className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={loading}
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full mt-4 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-2xl shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Check Status
                </>
              )}
            </motion.button>
          </motion.form>

          {/* RESULTS */}
          <AnimatePresence mode="wait">
            {error && searched && (
              <motion.div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-6 text-center">
                <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                <p className="text-red-200">{error}</p>
                <button
                  onClick={resetSearch}
                  className="mt-4 text-sm underline text-red-300"
                >
                  Try again
                </button>
              </motion.div>
            )}

            {member && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div
                  className={`rounded-3xl p-6 border ${
                    member.status === 'Active'
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <div className="flex justify-between mb-4">
                    <span className="text-white/70">Membership Status</span>
                    <span className={member.status === 'Active' ? 'text-emerald-400' : 'text-red-400'}>
                      {member.status}
                    </span>
                  </div>

                  {member.status === 'Active' && (
                    <div className="text-center">
                      <div className="text-5xl font-bold">{member.daysRemaining}</div>
                      <div className="text-sm text-emerald-300/70">days remaining</div>
                    </div>
                  )}
                </div>

                <div className="bg-white/10 border border-white/20 rounded-3xl p-6 space-y-4">
                  <Detail icon={<User />} label="Name" value={member.name} />
                  <Detail icon={<Phone />} label="Phone" value={member.phone} />
                  <Detail icon={<Award />} label="Membership" value={member.membershipType} />
                  <Detail icon={<Calendar />} label="Valid Until" value={member.endDate} />
                  <Detail icon={<Clock />} label="Member ID" value={member.id} />
                </div>

                <button
                  onClick={resetSearch}
                  className="w-full py-3 bg-white/10 border border-white/20 rounded-2xl hover:bg-white/20"
                >
                  Search Another Member
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* GALLERY */}
        <section className="max-w-5xl mx-auto px-4 mt-20">
          <h2 className="text-2xl font-bold text-center mb-6">FitZone Gallery</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {[gym1, gym2, gym3].map((img, i) => (
              <motion.img
                key={i}
                src={img}
                whileHover={{ scale: 1.03 }}
                className="rounded-2xl object-cover w-full h-48 shadow-lg border border-white/10"
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-xs uppercase text-purple-300/60">{label}</div>
        <div className="text-white font-medium">{value}</div>
      </div>
    </div>
  );
}
