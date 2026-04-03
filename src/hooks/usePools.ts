import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserPools, createPool, joinPoolByCode } from '../services/poolService';
import type { Pool } from '../types';

export function usePools() {
  const { user } = useAuth();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPools = useCallback(async () => {
    if (!user) {
      setPools([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userPools = await getUserPools(user.uid);
      setPools(userPools);
      setError(null);
    } catch (err) {
      console.error('Error fetching pools:', err);
      setError('Failed to load pools');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  const createNewPool = async (name: string, lockTime: Date) => {
    if (!user) return null;
    
    try {
      const poolId = await createPool(name, user.uid, user.displayName, lockTime);
      await fetchPools();
      return poolId;
    } catch (err) {
      console.error('Error creating pool:', err);
      throw new Error('Failed to create pool');
    }
  };

  const joinByCode = async (inviteCode: string) => {
    if (!user) return null;

    try {
      const poolId = await joinPoolByCode(inviteCode, user.uid, user.displayName);
      if (poolId) {
        await fetchPools();
        return poolId;
      }
      return null;
    } catch (err) {
      console.error('Error joining pool:', err);
      throw new Error('Invalid invite code');
    }
  };

  return {
    pools,
    loading,
    error,
    createNewPool,
    joinByCode,
    refresh: fetchPools,
  };
}
