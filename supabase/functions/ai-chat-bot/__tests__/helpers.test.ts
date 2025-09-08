import { clamp, needsSearch, toGeminiContents, formatWithSources } from '../helpers';

describe('helpers', () => {
  test('clamp limits length and strips controls', () => {
    const s = 'a'.repeat(10) + '\u0007';
    expect(clamp(s, 5)).toBe('aaaaa…');
  });

  test('needsSearch true for price keyword and min length', () => {
    const msgs = [{ role: 'user' as const, content: '価格はいくらですか？' }];
    expect(needsSearch(msgs, 2)).toBe(true);
  });

  test('needsSearch false for short query', () => {
    const msgs = [{ role: 'user' as const, content: '値' }];
    expect(needsSearch(msgs, 2)).toBe(false);
  });

  test('toGeminiContents wraps system and roles', () => {
    const parts = toGeminiContents('SYS', [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'ok' },
    ], 100);
    expect(parts[0].parts[0].text).toBe('SYS');
    expect(parts[1].role).toBe('user');
    expect(parts[2].role).toBe('model');
  });

  test('formatWithSources adds source line only when sources present', () => {
    const text = '行1\n行2\n行3\n行4\n行5\n行6';
    const outNo = formatWithSources(text, []);
    expect(outNo.split('\n')).toHaveLength(6);
    const outSrc = formatWithSources(text, [{ title: 't', source: 'ex.com' }]);
    expect(outSrc.endsWith('出典: [1] ex.com')).toBe(true);
  });
});

