import { getSupabaseClient } from './supabaseClient';
import { ReportReasonCode, ReportTargetType } from '../types/Report';
import { ServiceError } from '../utils/errors';

type SubmitReportParams = {
  targetType: ReportTargetType;
  targetId: string;
  reasonCode: ReportReasonCode | string;
  reasonText?: string;
  metadata?: Record<string, unknown>;
};

export async function submitReport(params: SubmitReportParams) {
  const { targetType, targetId, reasonCode, reasonText, metadata } = params;
  // Runtime input validation (defense-in-depth)
  if (!targetId || typeof targetId !== 'string' || !targetId.trim()) {
    throw new ServiceError('REPORT_INVALID_INPUT', '[submitReport] invalid targetId');
  }
  if (targetId.length > 255) {
    throw new ServiceError('REPORT_INVALID_INPUT', '[submitReport] targetId too long');
  }
  if (!targetType) {
    throw new ServiceError('REPORT_INVALID_INPUT', '[submitReport] invalid targetType');
  }
  if (!reasonCode || (typeof reasonCode === 'string' && reasonCode.trim().length === 0)) {
    throw new ServiceError('REPORT_INVALID_INPUT', '[submitReport] invalid reasonCode');
  }
  const safeReasonText =
    typeof reasonText === 'string'
      ? reasonText.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 500)
      : null;
  const supabase = getSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) throw new ServiceError('NOT_AUTHENTICATED', 'Not authenticated');

  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason_code: reasonCode,
    reason_text: safeReasonText,
    metadata: metadata ?? {},
  });

  if (error) {
    throw new ServiceError('REPORT_INSERT_FAILED', error.message || 'report insert failed', error);
  }
}
