import { useState, useCallback } from 'react';
import { saveSelections } from '../services/poolService';
import { useAuth } from '../context/AuthContext';
import type { Selection } from '../types';

export function useSelections(poolId: string) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async (selections: Selection) => {
    if (!user) return;

    try {
      setSaving(true);
      setError(null);
      await saveSelections(poolId, user.uid, selections);
    } catch (err) {
      console.error('Error saving selections:', err);
      setError('Failed to save selections');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [poolId, user]);

  return {
    save,
    saving,
    error,
  };
}
