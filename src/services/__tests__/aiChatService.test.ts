import { sendAIChat } from '../../services/aiChatService';

jest.mock('../../services/supabaseClient', () => {
  const invoke = jest.fn();
  return {
    getSupabaseClient: () => ({ functions: { invoke } }),
    __invoke: invoke,
  };
});

describe('aiChatService', () => {
  test('maps success response', async () => {
    const { __invoke } = jest.requireMock('../../services/supabaseClient');
    __invoke.mockResolvedValueOnce({ data: { ok: true, text: 'ok', session_id: 'sid' } });
    const res = await sendAIChat([{ role: 'user', content: 'hi' }], undefined);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.text).toBe('ok');
      expect(res.session_id).toBe('sid');
    }
  });

  test('maps error response', async () => {
    const { __invoke } = jest.requireMock('../../services/supabaseClient');
    __invoke.mockResolvedValueOnce({ data: { ok: false, error: 'bad' } });
    const res = await sendAIChat([{ role: 'user', content: 'hi' }], undefined);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('bad');
  });
});

