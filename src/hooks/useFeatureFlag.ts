import { useEffect, useState } from 'react';

import { getFeatureFlag } from '../services/featureFlagService';

export function useFeatureFlag(key: string, defaultValue = false) {
  const [enabled, setEnabled] = useState<boolean>(defaultValue);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const v = await getFeatureFlag(key, defaultValue);
        if (mounted) {
          setEnabled(v);
        }
      } catch (e) {
        if (mounted) {
          setError(e);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [key, defaultValue]);

  return { enabled, loading, error } as const;
}
