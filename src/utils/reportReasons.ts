export type ReportReason = {
  code: string;
  label: string;
};

export const REPORT_REASONS: ReportReason[] = [
  { code: 'spam', label: 'スパム' },
  { code: 'harassment', label: '嫌がらせ' },
  { code: 'hate', label: '差別的表現' },
  { code: 'nudity', label: '不適切なコンテンツ' },
  { code: 'other', label: 'その他' },
];

