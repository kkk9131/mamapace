export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export function clamp(text: string, n: number): string {
  if (!text) return '';
  const t = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

export function needsSearch(messages: ChatMessage[], minQueryLen: number): boolean {
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser) return false;
  const q = (lastUser.content || '').toLowerCase();
  const jp = lastUser.content || '';
  if (jp.length < minQueryLen) return false;
  const keywords = ['ニュース', '価格', '値段', '料金', '統計', '規格', '法令', '法律', '日時', '今日', '最新', 'バージョン', 'ver', '在庫', '発売', '場所', 'どこ', '住所', '地図'];
  if (keywords.some(k => jp.includes(k))) return true;
  const enHints = ['price', 'news', 'stats', 'statistics', 'law', 'regulation', 'version', 'stock', 'where'];
  if (enHints.some(k => q.includes(k))) return true;
  return false;
}

export function toGeminiContents(systemPrompt: string, history: ChatMessage[], maxUserLen: number) {
  const parts = [{ role: 'user', parts: [{ text: systemPrompt }] } as any];
  for (const m of history) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    parts.push({ role, parts: [{ text: clamp(m.content, maxUserLen) }] });
  }
  return parts;
}

export function formatWithSources(text: string, sources: { title: string; source: string }[]) {
  const lines = (text || '').trim().split(/\r?\n/).filter(l => l.trim().length > 0);
  if (sources && sources.length > 0) {
    const body = lines.slice(0, 5);
    const lab = sources.slice(0, 2).map((s, i) => `[${i + 1}] ${s.source}`).join(', ');
    return [...body, `出典: ${lab}`].join('\n');
  }
  return lines.slice(0, 6).join('\n');
}

