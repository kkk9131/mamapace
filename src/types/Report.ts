export type ReportTargetType = 'user' | 'post' | 'comment' | 'message' | 'room';

export type ReportReasonCode =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'nudity'
  | 'other';

export type Report = {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason_code: ReportReasonCode | string;
  reason_text?: string | null;
  metadata?: Record<string, unknown>;
  status: 'open' | 'triaged' | 'closed';
  handled_by?: string | null;
  created_at: string;
  updated_at: string;
};

