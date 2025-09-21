import { parseQuery } from '../../services/searchService';

describe('parseQuery', () => {
  it('returns none for empty or whitespace', () => {
    expect(parseQuery('')).toEqual({ kind: 'none', term: '' });
    expect(parseQuery('   ')).toEqual({ kind: 'none', term: '' });
  });

  it('parses user queries with @', () => {
    expect(parseQuery('@alice')).toEqual({ kind: 'user', term: 'alice' });
    expect(parseQuery('@Alice')).toEqual({ kind: 'user', term: 'Alice' });
  });

  it('sanitizes username to allowed chars', () => {
    expect(parseQuery('@bob!!')).toEqual({ kind: 'user', term: 'bob' });
    expect(parseQuery('@eve.name')).toEqual({ kind: 'user', term: 'eve.name' });
    expect(parseQuery('@john_doe+plus')).toEqual({
      kind: 'user',
      term: 'john_doeplus',
    });
  });

  it('parses hashtag queries with Japanese letters and sanitizes', () => {
    expect(parseQuery('#ReactNative')).toEqual({ kind: 'hashtag', term: 'ReactNative' });
    expect(parseQuery('#dev!')).toEqual({ kind: 'hashtag', term: 'dev' });
    expect(parseQuery('#日本語')).toEqual({ kind: 'hashtag', term: '日本語' });
  });
});
