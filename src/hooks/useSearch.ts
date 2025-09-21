import { useEffect, useMemo, useRef, useState } from 'react';

import {
  QueryKind,
  parseQuery,
  searchPostsByHashtag,
  searchUsers,
  SearchPostItem,
  SearchUserItem,
} from '../services/searchService';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function useSearch(input: string) {
  const [status, setStatus] = useState<Status>('idle');
  const [kind, setKind] = useState<QueryKind>('none');
  const [users, setUsers] = useState<SearchUserItem[]>([]);
  const [posts, setPosts] = useState<SearchPostItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastQuery = useRef<string>('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsed = useMemo(() => parseQuery(input), [input]);

  useEffect(() => {
    setKind(parsed.kind);
    if (timer.current) {
      clearTimeout(timer.current);
    }

    if (parsed.kind === 'none') {
      setStatus('idle');
      setUsers([]);
      setPosts([]);
      setError(null);
      return;
    }

    setStatus('loading');
    setError(null);
    const qKey = `${parsed.kind}:${parsed.term}`;
    lastQuery.current = qKey;

    timer.current = setTimeout(async () => {
      try {
        if (lastQuery.current !== qKey) {
          return; // outdated
        }
        if (parsed.kind === 'user') {
          const { items } = await searchUsers(parsed.term, { limit: 20 });
          if (lastQuery.current !== qKey) {
            return;
          }
          setUsers(items);
          setPosts([]);
          setStatus('success');
        } else if (parsed.kind === 'hashtag') {
          const { items } = await searchPostsByHashtag(parsed.term, {
            limit: 20,
          });
          if (lastQuery.current !== qKey) {
            return;
          }
          setPosts(items);
          setUsers([]);
          setStatus('success');
        }
      } catch (e: any) {
        if (lastQuery.current !== qKey) {
          return;
        }
        setError(String(e?.message || '検索に失敗しました'));
        setStatus('error');
      }
    }, 300);

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [parsed.kind, parsed.term]);

  return { status, kind, users, posts, error };
}
