import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { blockUser, unblockUser, listBlockedUsers } from '../services/blockService';

export function useBlockedList() {
  const [blocked, setBlocked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [mutating, setMutating] = useState(false);
  const pending = useRef<Set<string>>(new Set());

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

  const block = useCallback(async (userId: string) => {
    if (!userId || pending.current.has(userId)) return;
    pending.current.add(userId);
    setMutating(true);
    try {
      await blockUser(userId);
      setBlocked(prev => (prev.includes(userId) ? prev : [...prev, userId]));
    } finally {
      pending.current.delete(userId);
      setMutating(false);
    }
  }, []);

  const unblock = useCallback(async (userId: string) => {
    if (!userId || pending.current.has(userId)) return;
    pending.current.add(userId);
    setMutating(true);
    try {
      await unblockUser(userId);
      setBlocked(prev => prev.filter(id => id !== userId));
    } finally {
      pending.current.delete(userId);
      setMutating(false);
    }
  }, []);

  return useMemo(
    () => ({ blocked, loading, error, mutating, refresh, isBlocked, block, unblock }),
    [blocked, loading, error, mutating, refresh, isBlocked, block, unblock]
  );
}
