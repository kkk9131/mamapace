// Hashtag utilities (Japanese-friendly)

/**
 * Extract hashtags from a plain text post body.
 * - Supports Japanese tags (kanji/kana) and alphanumerics
 * - Allowed characters after '#': Unicode letters/numbers, underscore, 'ー', '・'
 * - Normalizes with NFKC and deduplicates
 */
export function extractHashtagsFromText(body: string): string[] {
  if (!body) {
    return [];
  }
  const text = body.normalize('NFKC');
  const regex = /#([\p{L}\p{N}_ー・]+)/gu;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    const tag = (m[1] || '').trim();
    if (tag.length > 0) {
      found.add(tag.slice(0, 48));
    }
  }
  return Array.from(found);
}
