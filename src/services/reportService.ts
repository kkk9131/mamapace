import { ReportReasonCode, ReportTargetType } from '../types/Report';
import { ServiceError } from '../utils/errors';

import { getSupabaseClient } from './supabaseClient';

type SubmitReportParams = {
  targetType: ReportTargetType;
  targetId: string;
  reasonCode: ReportReasonCode | string;
  reasonText?: string;
  metadata?: Record<string, unknown>;
};

const REPORT_FUNCTION_TIMEOUT_MS = 5000; // Extracted config

export async function submitReport(params: SubmitReportParams) {
  const { targetType, targetId, reasonCode, reasonText, metadata } = params;
  // Runtime input validation (defense-in-depth)
  if (!targetId || typeof targetId !== 'string' || !targetId.trim()) {
    throw new ServiceError(
      'REPORT_INVALID_INPUT',
      '[submitReport] invalid targetId',
    );
  }
  if (targetId.length > 255) {
    throw new ServiceError(
      'REPORT_INVALID_INPUT',
      '[submitReport] targetId too long',
    );
  }
  if (!targetType) {
    throw new ServiceError(
      'REPORT_INVALID_INPUT',
      '[submitReport] invalid targetType',
    );
  }
  if (
    !reasonCode ||
    (typeof reasonCode === 'string' && reasonCode.trim().length === 0)
  ) {
    throw new ServiceError(
      'REPORT_INVALID_INPUT',
      '[submitReport] invalid reasonCode',
    );
  }
  const safeReasonText =
    typeof reasonText === 'string'
      ? reasonText.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 500)
      : null;
  const supabase = getSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    throw new ServiceError('NOT_AUTHENTICATED', 'Not authenticated');
  }

  // Prefer Edge Function submit-report; fallback to direct insert if unavailable or network issue
  let shouldFallback = true;
  try {
    const invoker = (supabase as any).functions?.invoke as
      | ((name: string, options: any) => Promise<{ data: unknown; error: any }>)
      | undefined;
    if (typeof invoker === 'function') {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        REPORT_FUNCTION_TIMEOUT_MS,
      );
      const { data, error } = await (supabase as any).functions.invoke(
        'submit-report',
        {
          body: {
            target_type: targetType,
            target_id: targetId,
            reason_code: reasonCode,
            reason_text: safeReasonText ?? undefined,
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (!error && (data as any)?.ok) {
        shouldFallback = false;
        return;
      }
      if (error) {
        const status =
          (error as any)?.context?.status || (error as any)?.status;
        const message = (error as any)?.message || 'submit-report failed';
        // Client error/unauthorized/rate-limited/duplicate -> do not fallback, surface error
        if (status && [400, 401, 403, 409, 429].includes(status)) {
          throw new ServiceError('REPORT_FUNCTION_REJECTED', message, error);
        }
        // Not found or server/network errors -> allow fallback
        shouldFallback = true;
      }
    }
  } catch (e: any) {
    // Distinguish AbortError vs client errors that should not fallback
    const status = (e as any)?.context?.status || (e as any)?.status;
    if (status && [400, 401, 403].includes(status)) {
      throw new ServiceError(
        'REPORT_FUNCTION_REJECTED',
        e?.message || 'submit-report failed',
        e,
      );
    }
    if (e?.name === 'AbortError') {
      shouldFallback = true;
    } else {
      // Network or unexpected errors -> fallback
      shouldFallback = true;
    }
  }

  if (shouldFallback) {
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason_code: reasonCode,
      reason_text: safeReasonText,
      metadata: metadata ?? {},
    });

    if (error) {
      throw new ServiceError(
        'REPORT_INSERT_FAILED',
        error.message || 'report insert failed',
        error
      );
    }
  }
}
