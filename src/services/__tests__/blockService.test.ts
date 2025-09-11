import { jest } from '@jest/globals';

// Minimal supabase client mock
const mockAuthGetUser = jest.fn(async () => ({ data: { user: { id: 'me' } }, error: null }));

let mockLastInsert: any = null;
let mockNextCount = 0;
let mockShouldErrorOn: Partial<Record<'insert' | 'delete' | 'select', boolean>> = {};

jest.mock('../supabaseClient', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: mockAuthGetUser },
    from: () => {
      const builder: any = {
        insert(row: any) {
          mockLastInsert = row;
          return Promise.resolve({ error: mockShouldErrorOn.insert ? { message: 'insert-failed' } : null });
        },
        delete() {
          builder._op = 'delete';
          return builder;
        },
        select(_: string, opts?: any) {
          builder._op = 'select';
          builder._opts = opts;
          return builder;
        },
        eq() {
          return builder;
        },
        head() {
          return builder;
        },
        then(resolve: any) {
          if (builder._op === 'select' && builder._opts?.count) {
            return resolve({ count: mockShouldErrorOn.select ? undefined : mockNextCount, error: mockShouldErrorOn.select ? { message: 'select-failed' } : null });
          }
          return resolve({ data: [], error: mockShouldErrorOn.select ? { message: 'select-failed' } : null });
        },
      };
      return builder;
    },
  }),
}));

import { blockUser, unblockUser, listBlockedUsers, isBlocked } from '../blockService';

describe('blockService', () => {
  beforeEach(() => {
    mockLastInsert = null;
    mockShouldErrorOn = {};
    mockNextCount = 0;
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'me' } }, error: null });
  });

  it('blockUser inserts with current user as blocker', async () => {
    await expect(blockUser('other')).resolves.toBeUndefined();
    expect(mockLastInsert).toEqual({ blocker_id: 'me', blocked_id: 'other' });
  });

  it('blockUser throws contextual error on failure', async () => {
    mockShouldErrorOn.insert = true;
    await expect(blockUser('other')).rejects.toThrow('[blockUser]');
  });

  it('unblockUser resolves (mocked delete)', async () => {
    await expect(unblockUser('other')).resolves.toBeUndefined();
  });

  it('listBlockedUsers returns array', async () => {
    // Our mock returns empty data by default
    await expect(listBlockedUsers()).resolves.toEqual([]);
  });

  it('isBlocked returns true when count>0', async () => {
    mockNextCount = 1;
    await expect(isBlocked('other')).resolves.toBe(true);
  });

  it('isBlocked returns false when count=0', async () => {
    mockNextCount = 0;
    await expect(isBlocked('other')).resolves.toBe(false);
  });
});
