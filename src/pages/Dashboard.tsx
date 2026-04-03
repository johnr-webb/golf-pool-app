import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { mockGolfers } from '../data/mockGolfers';
import { usePools } from '../hooks/usePools';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { pools, loading } = usePools();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const topGolfers = {
    favorite: mockGolfers.filter(g => g.bucket === 'favorite').slice(0, 3),
    contender: mockGolfers.filter(g => g.bucket === 'contender').slice(0, 3),
    longshot: mockGolfers.filter(g => g.bucket === 'longshot').slice(0, 3),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Golf Pool</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">Welcome, {user?.displayName}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Your Pools</h2>
            {loading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            ) : pools.length > 0 ? (
              <div className="space-y-2">
                {pools.slice(0, 3).map(pool => (
                  <Link
                    key={pool.id}
                    to={`/pool/${pool.id}`}
                    className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">{pool.name}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        new Date() > pool.lockTime 
                          ? 'bg-red-100 text-red-600' 
                          : 'bg-green-100 text-green-600'
                      }`}>
                        {new Date() > pool.lockTime ? 'Locked' : 'Open'}
                      </span>
                    </div>
                  </Link>
                ))}
                {pools.length > 3 && (
                  <Link
                    to="/pools"
                    className="block text-center text-sm text-[#1e3a5f] hover:underline pt-2"
                  >
                    View all {pools.length} pools
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-gray-500 mb-4">You haven't joined any pools yet</p>
            )}
            <Link
              to="/pools"
              className="mt-4 inline-block px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2d5a87] transition"
            >
              {pools.length > 0 ? 'Manage Pools' : 'Join a Pool'}
            </Link>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Current Tournament</h2>
            <p className="text-gray-500 mb-2">Masters Tournament</p>
            <p className="text-sm text-gray-400 mb-4">April 10-13, 2025</p>
            <div className="text-sm text-gray-500">
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Selections Open
              </p>
              <p className="mt-1">Lock time: April 10, 10:00 AM ET</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Picks Preview</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {Object.entries(topGolfers).map(([bucket, golfers]) => (
              <div key={bucket}>
                <h3 className="text-sm font-medium text-gray-500 uppercase mb-2 capitalize">
                  {bucket}s
                </h3>
                <div className="space-y-2">
                  {golfers.map(golfer => (
                    <div
                      key={golfer.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{golfer.name}</span>
                        <span className="text-xs text-gray-400 ml-2">#{golfer.worldRanking}</span>
                      </div>
                      <span className="text-sm text-gray-500">{golfer.odds / 100}:1</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
