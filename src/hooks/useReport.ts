import { useCallback, useState } from 'react';
import { submitReport } from '../services/reportService';
import { ReportReasonCode, ReportTargetType } from '../types/Report';

export function useReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState(false);

  const send = useCallback(
    async (
      targetType: ReportTargetType,
      targetId: string,
      reasonCode: ReportReasonCode | string,
      reasonText?: string,
      metadata?: Record<string, unknown>
    ) => {
      setLoading(true);
      setError(null);
      setSuccess(false);
      try {
        await submitReport({
          targetType,
          targetId,
          reasonCode,
          reasonText,
          metadata,
        });
        setSuccess(true);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { send, loading, error, success };
}

