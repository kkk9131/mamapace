import { useCallback, useEffect, useMemo, useState } from 'react';
import { blockUser, unblockUser, listBlockedUsers } from '../services/blockService';

export function useBlockedList() {
  const [blocked, setBlocked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ids = await listBlockedUsers();
      setBlocked(ids);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isBlocked = useCallback(
    (userId?: string | null) => (!!userId ? blocked.includes(userId) : false),
    [blocked]
  );

  const block = useCallback(
    async (userId: string) => {
      await blockUser(userId);
      setBlocked(prev => (prev.includes(userId) ? prev : [...prev, userId]));
    },
    []
  );

  const unblock = useCallback(
    async (userId: string) => {
      await unblockUser(userId);
      setBlocked(prev => prev.filter(id => id !== userId));
    },
    []
  );

  return useMemo(
    () => ({ blocked, loading, error, refresh, isBlocked, block, unblock }),
    [blocked, loading, error, refresh, isBlocked, block, unblock]
  );
}

