import {
  listAISessions,
  createAISession,
  deleteAISession,
  fetchAIMessages,
} from '../../services/aiChatSessionService';

jest.mock('../../services/supabaseClient', () => {
  const from = jest.fn();
  const auth = { getUser: jest.fn() };
  return {
    getSupabaseClient: () => ({ from, auth }),
    __from: from,
    __auth: auth,
  };
});

describe('aiChatSessionService', () => {
  beforeEach(() => {
    const { __from, __auth } = jest.requireMock('../../services/supabaseClient');
    __from.mockReset();
    __auth.getUser.mockReset();
  });

  test('list sessions', async () => {
    const { __from } = jest.requireMock('../../services/supabaseClient');
    __from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [{ id: 'a', title: 't' }], error: null }),
    });
    const list = await listAISessions();
    expect(list[0].id).toBe('a');
  });

  test('create session includes user_id', async () => {
    const { __from, __auth } = jest.requireMock('../../services/supabaseClient');
    __auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: { id: 's1', title: 'x' }, error: null });
    __from.mockReturnValue({ insert, select, single });
    const s = await createAISession('x');
    expect(s.id).toBe('s1');
    expect(insert.mock.calls[0][0]).toMatchObject({ user_id: 'u1' });
  });

  test('delete session', async () => {
    const { __from } = jest.requireMock('../../services/supabaseClient');
    const del = jest.fn().mockReturnThis();
    const eq = jest.fn().mockResolvedValue({ error: null });
    __from.mockReturnValue({ delete: del, eq });
    await expect(deleteAISession('id')).resolves.toBeUndefined();
  });

  test('fetch messages', async () => {
    const { __from } = jest.requireMock('../../services/supabaseClient');
    __from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [{ id: 'm1', role: 'user', content: 'hi' }], error: null }),
    });
    const m = await fetchAIMessages('sid');
    expect(m[0].id).toBe('m1');
  });
});

