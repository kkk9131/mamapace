import { fetchLiveMessages, getAnonComments, getAnonMessageMeta } from '../anonV2Service';

jest.mock('../supabaseClient', () => ({
  getSupabaseClient: () => mockClient,
}));

const mockClient: any = {
  from: jest.fn(),
  rpc: jest.fn(),
};

describe('anonV2Service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('fetchLiveMessages falls back to RPC when view fails', async () => {
    mockClient.from.mockReturnValue({ select: () => ({ order: () => ({ data: null, error: new Error('view error') }) }) });
    mockClient.rpc
      .mockResolvedValueOnce({ data: { room_id: 'anon_20250101_10' }, error: null }) // get_or_create_current_anon_room
      .mockResolvedValueOnce({
        data: [
          { id: '1', content: 'hello', display_name: 'x', created_at: '2025-01-01T10:00:00Z', expires_at: '2025-01-01T11:00:00Z' },
        ],
        error: null,
      }); // get_anonymous_messages

    const rows = await fetchLiveMessages();
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe('hello');
  });

  test('getAnonComments returns typed list', async () => {
    mockClient.rpc.mockResolvedValueOnce({
      data: [
        { id: 'c1', message_id: 'm1', display_name: 'fox', content: 'hi', created_at: '2025-01-01T10:00:00Z' },
      ],
      error: null,
    });
    const list = await getAnonComments('m1', 10);
    expect(list[0]).toMatchObject({ id: 'c1', message_id: 'm1', content: 'hi' });
  });

  test('getAnonMessageMeta returns typed meta', async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: { reaction_count: 2, comment_count: 1, reacted: true }, error: null });
    const meta = await getAnonMessageMeta('m1');
    expect(meta).toEqual({ reaction_count: 2, comment_count: 1, reacted: true });
  });
});

