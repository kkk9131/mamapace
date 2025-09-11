import { jest } from '@jest/globals';

// Capture inserted payload for assertions
let insertedRow: any = null;

jest.mock('../supabaseClient', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'me' } }, error: null }) },
    from: () => ({
      insert(row: any) {
        insertedRow = row;
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

import { submitReport } from '../reportService';

describe('reportService.submitReport', () => {
  beforeEach(() => {
    insertedRow = null;
  });

  it('validates inputs and inserts sanitized payload', async () => {
    await expect(
      submitReport({
        targetType: 'user',
        targetId: 'target-uuid-like',
        reasonCode: 'spam',
        reasonText: 'bad\u0007text',
      })
    ).resolves.toBeUndefined();
    expect(insertedRow).toBeTruthy();
    expect(insertedRow.reporter_id).toBe('me');
    expect(insertedRow.reason_text).toBe('badtext'); // control char stripped
  });

  it('throws on invalid targetId', async () => {
    await expect(
      submitReport({ targetType: 'user', targetId: '', reasonCode: 'spam' })
    ).rejects.toThrow('invalid targetId');
  });
});

