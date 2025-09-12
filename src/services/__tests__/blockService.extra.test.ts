import { jest } from '@jest/globals';

let mockCount = 0;
let mockData: any[] = [];
let mockErrorOn: Partial<Record<'insert'|'delete'|'select', boolean>> = {};

jest.mock('../supabaseClient', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'me' } }, error: null }) },
    from: () => {
      const b: any = {
        insert: async () => ({ error: mockErrorOn.insert ? { message: 'insert-failed' } : null }),
        delete() { b._op='delete'; return b; },
        select(_: string, opts?: any) { b._op='select'; b._opts=opts; return b; },
        eq() { return b; },
        in() { return b; },
        head() { return b; },
        then: (resolve: any) => {
          if (b._opts?.head) return resolve({ count: mockErrorOn.select ? undefined : mockCount, error: mockErrorOn.select ? { message: 'select-failed' } : null });
          return resolve({ data: mockErrorOn.select ? null : mockData, error: mockErrorOn.select ? { message: 'select-failed' } : null });
        },
      };
      return b;
    },
  }),
}));

import { isBlockedBatch, blockUser } from '../blockService';

describe('blockService extras', () => {
  beforeEach(() => {
    mockCount = 0;
    mockData = [];
    mockErrorOn = {};
  });

  it('isBlockedBatch returns Set of blocked ids', async () => {
    mockData = [{ blocked_id: 'u1' }, { blocked_id: 'u3' }];
    const res = await isBlockedBatch(['u1','u2','u3']);
    expect(res.has('u1')).toBe(true);
    expect(res.has('u2')).toBe(false);
    expect(res.has('u3')).toBe(true);
  });

  it('blockUser includes contextual tag on error', async () => {
    mockErrorOn.insert = true;
    await expect(blockUser('u9')).rejects.toThrow('[blockUser]');
  });
});

