import { jest } from '@jest/globals';

const mockClient: any = {
  auth: {
    getUser: jest
      .fn()
      .mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
  },
  rpc: jest.fn(),
  from: jest.fn(),
};

jest.mock('../supabaseClient', () => ({
  getSupabaseClient: () => mockClient,
}));

import { roomService } from '../roomService';

describe('roomService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createSpace: RPC returns null channel -> ensure_default_channel_if_missing is used', async () => {
    mockClient.rpc
      .mockResolvedValueOnce({
        data: { space_id: 's1', channel_id: null },
        error: null,
      }) // create_space
      .mockResolvedValueOnce({ data: 'c1', error: null }); // ensure_default_channel_if_missing

    mockClient.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            maybeSingle: jest
              .fn()
              .mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const res = await roomService.createSpace({
      name: 'Test',
      is_public: true,
    });
    expect(res.success).toBe(true);
    expect(res.data?.space_id).toBe('s1');
    expect(res.data?.channel_id).toBe('c1');
    expect(mockClient.rpc).toHaveBeenCalledWith(
      'ensure_default_channel_if_missing',
      { p_space_id: 's1' },
    );
  });

  test('getChatListWithNew: uses RPC and returns data', async () => {
    mockClient.rpc.mockResolvedValueOnce({
      data: [
        {
          channel_id: 'c1',
          space_id: 's1',
          space_name: 'X',
          space_is_public: true,
          channel_name: 'general',
          member_role: 'member',
          last_seen_at: new Date().toISOString(),
          latest_message_at: null,
          latest_message_content: null,
          latest_message_sender_id: null,
          latest_message_sender_username: null,
          has_new: false,
          unread_count: 0,
        },
      ],
      error: null,
    });
    const res = await roomService.getChatListWithNew();
    expect(res.success).toBe(true);
    expect((res as any).data.length).toBe(1);
  });

  test('sendAnonymousMessage: normalizes room id and sanitizes content', async () => {
    const rpcSpy = mockClient.rpc.mockResolvedValueOnce({
      data: { success: true, message_id: 'm1' },
      error: null,
    });
    const res = await roomService.sendAnonymousMessage({
      room_id: 'bad',
      content: '\\x00hello',
      display_name: 'name',
    });
    expect(res.success).toBe(true);
    const callArgs = rpcSpy.mock.calls[0][1];
    expect(callArgs.p_room_id).toMatch(/^anon_\d{8}_\d{2}$/);
    expect(callArgs.p_content).toBe('hello');
  });

  test('deleteSpace: deletes owner space', async () => {
    mockClient.from.mockReturnValueOnce({
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({ eq: jest.fn(() => ({ error: null })) })),
      })),
    });
    const res = await roomService.deleteSpace('s1');
    expect(res.success).toBe(true);
  });

  test('joinPublicSpace: ensures channel if missing then joins', async () => {
    // spaces.single
    mockClient.from
      .mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 's1',
                is_public: true,
                max_members: 500,
                member_count: 0,
              },
              error: null,
            }),
          })),
        })),
      })
      // channels.maybeSingle (no channel)
      .mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            limit: jest.fn(() => ({
              maybeSingle: jest
                .fn()
                .mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      })
      // channels.find after ensure
      .mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            limit: jest.fn(() => ({
              maybeSingle: jest
                .fn()
                .mockResolvedValue({ data: { id: 'c1' }, error: null }),
            })),
          })),
        })),
      })
      // channel_members.insert
      .mockReturnValueOnce({ insert: jest.fn(() => ({ error: null })) });

    // ensure_default_channel_if_missing
    mockClient.rpc.mockResolvedValueOnce({ data: 'c1', error: null });

    const res = await roomService.joinPublicSpace('s1');
    expect(res.success).toBe(true);
    expect(res.data?.channel_id).toBe('c1');
  });
});
