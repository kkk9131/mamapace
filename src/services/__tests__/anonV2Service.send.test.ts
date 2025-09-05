import { sendAnonMessage } from '../anonV2Service';

jest.mock('../supabaseClient', () => ({
  getSupabaseClient: () => mockClient,
}));

const mockClient: any = {
  rpc: jest.fn(),
};

describe('sendAnonMessage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('fallback to anon_send_message path returns created row', async () => {
    // First try block will not return (simulate no success)
    mockClient.rpc
      // get_or_create_current_anon_room
      .mockResolvedValueOnce({ data: { room_id: 'anon_20250101_10', ephemeral_name: 'fox' }, error: null })
      // send_anonymous_message returns null to force fallback
      .mockResolvedValueOnce({ data: null, error: new Error('blocked') })
      // anon_send_message returns created row
      .mockResolvedValueOnce({
        data: [{ id: 'm1', content: 'hello', display_name: 'fox', created_at: '2025-01-01T10:00:00Z' }],
        error: null,
      });
    const res = await sendAnonMessage('hello');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe('m1');
      expect(res.data.content).toBe('hello');
    }
  });

  test('rate limited path returns retryAfterSeconds', async () => {
    mockClient.rpc
      .mockResolvedValueOnce({ data: { room_id: 'anon_20250101_10', ephemeral_name: 'fox' }, error: null })
      .mockResolvedValueOnce({ data: { error: 'Rate limit', retry_after_seconds: 7 }, error: null });
    const res = await sendAnonMessage('hello');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.retryAfterSeconds).toBe(7);
    }
  });
});

