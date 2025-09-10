import { getSupabaseClient } from './supabaseClient';
import { ReportReasonCode, ReportTargetType } from '../types/Report';

type SubmitReportParams = {
  targetType: ReportTargetType;
  targetId: string;
  reasonCode: ReportReasonCode | string;
  reasonText?: string;
  metadata?: Record<string, unknown>;
};

export async function submitReport(params: SubmitReportParams) {
  const { targetType, targetId, reasonCode, reasonText, metadata } = params;
  const supabase = getSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason_code: reasonCode,
    reason_text: reasonText ?? null,
    metadata: metadata ?? {},
  });

  if (error) {
    throw new Error(`[submitReport] failed: ${error.message || 'unknown error'}`);
  }
}
