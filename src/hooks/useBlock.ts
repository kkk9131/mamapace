import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  blockUser,
  unblockUser,
  listBlockedUsers,
} from '../services/blockService';

// Simple TTL cache (module-scoped) to avoid frequent reloads across screens
let cachedBlocked: string[] | null = null;
let cachedAt = 0;
const BLOCKED_TTL_MS = 60 * 1000; // 60s

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
      cachedBlocked = ids;
      cachedAt = Date.now();
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Serve from cache if fresh
    if (cachedBlocked && Date.now() - cachedAt < BLOCKED_TTL_MS) {
      setBlocked(cachedBlocked);
      return;
    }
    void refresh();
  }, [refresh]);

  const isBlocked = useCallback(
    (userId?: string | null) => (userId ? blocked.includes(userId) : false),
    [blocked]
  );

  const block = useCallback(async (userId: string) => {
    if (!userId || pending.current.has(userId)) {
      return;
    }
    pending.current.add(userId);
    setMutating(true);
    try {
      await blockUser(userId);
      setBlocked(prev => {
        const next = prev.includes(userId) ? prev : [...prev, userId];
        cachedBlocked = next;
        cachedAt = Date.now();
        return next;
      });
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      pending.current.delete(userId);
      setMutating(false);
    }
  }, []);

  const unblock = useCallback(async (userId: string) => {
    if (!userId || pending.current.has(userId)) {
      return;
    }
    pending.current.add(userId);
    setMutating(true);
    try {
      await unblockUser(userId);
      setBlocked(prev => {
        const next = prev.filter(id => id !== userId);
        cachedBlocked = next;
        cachedAt = Date.now();
        return next;
      });
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      pending.current.delete(userId);
      setMutating(false);
    }
  }, []);

  return useMemo(
    () => ({
      blocked,
      loading,
      error,
      mutating,
      refresh,
      isBlocked,
      block,
      unblock,
    }),
    [blocked, loading, error, mutating, refresh, isBlocked, block, unblock]
  );
}
