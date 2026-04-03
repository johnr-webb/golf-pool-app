import { useState, useEffect } from 'react';
import { getPool, getPoolMembers, getUserSelections } from '../services/poolService';
import { useAuth } from '../context/AuthContext';
import type { Pool, PoolMember, Selection } from '../types';

export function usePool(poolId: string) {
  const { user } = useAuth();
  const [pool, setPool] = useState<Pool | null>(null);
  const [members, setMembers] = useState<PoolMember[]>([]);
  const [userSelections, setUserSelections] = useState<Selection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [poolData, membersData, selectionsData] = await Promise.all([
          getPool(poolId),
          getPoolMembers(poolId),
          user ? getUserSelections(poolId, user.uid) : Promise.resolve(null),
        ]);

        if (!poolData) {
          setError('Pool not found');
          return;
        }

        setPool(poolData);
        setMembers(membersData);
        setUserSelections(selectionsData);
        setError(null);
      } catch (err) {
        console.error('Error fetching pool:', err);
        setError('Failed to load pool');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [poolId, user]);

  const isLocked = pool ? new Date() > pool.lockTime : false;

  const memberCount = members.length;

  const userMember = user
    ? members.find(m => m.userId === user.uid)
    : null;

  return {
    pool,
    members,
    userSelections,
    loading,
    error,
    isLocked,
    memberCount,
    userMember,
  };
}
