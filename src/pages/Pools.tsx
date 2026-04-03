import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePools } from '../hooks/usePools';

export default function Pools() {
  const { pools, loading, createNewPool, joinByCode } = usePools();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [poolName, setPoolName] = useState('');
  const [lockTime, setLockTime] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!poolName || !lockTime) return;
    
    try {
      setSubmitting(true);
      setError('');
      const poolId = await createNewPool(poolName, new Date(lockTime));
      if (poolId) {
        setShowCreateModal(false);
        setPoolName('');
        setLockTime('');
        navigate(`/pool/${poolId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create pool');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode) return;
    
    try {
      setSubmitting(true);
      setError('');
      const poolId = await joinByCode(joinCode);
      if (poolId) {
        setShowJoinModal(false);
        setJoinCode('');
        navigate(`/pool/${poolId}`);
      } else {
        setError('Invalid invite code');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to join pool');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/dashboard" className="text-2xl font-bold text-[#1e3a5f]">
            Golf Pool
          </Link>
          <Link
            to="/dashboard"
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Your Pools</h1>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowJoinModal(true);
                setError('');
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Join Pool
            </button>
            <button
              onClick={() => {
                setShowCreateModal(true);
                setError('');
              }}
              className="px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2d5a87] transition"
            >
              Create Pool
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
          </div>
        ) : pools.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500 mb-4">You haven't joined any pools yet</p>
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2d5a87] transition"
            >
              Join or Create a Pool
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pools.map(pool => (
              <Link
                key={pool.id}
                to={`/pool/${pool.id}`}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{pool.name}</h2>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Lock: {pool.lockTime.toLocaleDateString()}</span>
                  <span>{pool.inviteCode}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Join Pool</h2>
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter invite code"
              maxLength={6}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none mb-4 uppercase text-center text-2xl tracking-widest"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setError('');
                  setJoinCode('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={!joinCode || submitting}
                className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2d5a87] transition disabled:opacity-50"
              >
                {submitting ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Pool</h2>
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}
            <input
              type="text"
              value={poolName}
              onChange={(e) => setPoolName(e.target.value)}
              placeholder="Pool name"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none mb-4"
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Selection Lock Time
            </label>
            <input
              type="datetime-local"
              value={lockTime}
              onChange={(e) => setLockTime(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setError('');
                  setPoolName('');
                  setLockTime('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!poolName || !lockTime || submitting}
                className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2d5a87] transition disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
