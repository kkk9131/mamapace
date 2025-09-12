import { jest } from '@jest/globals';

// Mocks and spies (prefix with mock* to satisfy Jest restrictions)
let mockInvokedBody: any = null;
let mockInvokeShouldError: any = null as null | { status?: number; message?: string };
let mockInvokeShouldThrowAbort = false;
let mockInsertedRow: any = null;

jest.mock('../supabaseClient', () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'me' } }, error: null }),
    },
    functions: {
      invoke: async (_name: string, options: any) => {
        if (mockInvokeShouldThrowAbort) {
          const err: any = new Error('Aborted');
          err.name = 'AbortError';
          throw err;
        }
        mockInvokedBody = options?.body;
        if (mockInvokeShouldError) {
          return { data: null, error: { status: mockInvokeShouldError.status, message: mockInvokeShouldError.message } };
        }
        return { data: { ok: true }, error: null };
      },
    },
    from: () => ({
      insert: async (row: any) => {
        mockInsertedRow = row;
        return { error: null };
      },
    }),
  }),
}));

import { submitReport } from '../reportService';
import { ServiceError } from '../../utils/errors';

describe('reportService with Edge Function', () => {
  beforeEach(() => {
    mockInvokedBody = null;
    mockInsertedRow = null;
    mockInvokeShouldError = null;
    mockInvokeShouldThrowAbort = false;
  });

  it('uses Edge Function when successful and does not fallback', async () => {
    await expect(
      submitReport({ targetType: 'user', targetId: 'u1', reasonCode: 'spam' })
    ).resolves.toBeUndefined();
    expect(mockInvokedBody).toBeTruthy();
    expect(mockInsertedRow).toBeNull(); // no fallback
  });

  it('throws and does not fallback on 400 error', async () => {
    mockInvokeShouldError = { status: 400, message: 'bad request' };
    await expect(
      submitReport({ targetType: 'user', targetId: 'u1', reasonCode: 'spam' })
    ).rejects.toBeInstanceOf(ServiceError);
    expect(mockInsertedRow).toBeNull();
  });

  it('falls back to direct insert on AbortError (timeout/network)', async () => {
    mockInvokeShouldThrowAbort = true;
    await expect(
      submitReport({ targetType: 'user', targetId: 'u1', reasonCode: 'spam' })
    ).resolves.toBeUndefined();
    expect(mockInsertedRow).toBeTruthy();
  });
});
