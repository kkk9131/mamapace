import { triggerCompassionateAiComment } from '../../services/aiCommentService';

jest.mock('../../services/supabaseClient', () => {
  const invoke = jest.fn();
  const client = { functions: { invoke } } as any;
  return {
    getSupabaseClient: () => client,
    __client: client,
  };
});

describe('aiCommentService.triggerCompassionateAiComment', () => {
  const { __client } = jest.requireMock('../../services/supabaseClient');

  beforeEach(() => {
    __client.functions.invoke.mockReset();
  });

  it('returns data on success', async () => {
    __client.functions.invoke.mockResolvedValue({
      data: { ok: true },
      error: null,
    });
    const res = await triggerCompassionateAiComment({
      postId: 'p1',
      body: 'hello',
    });
    expect(res).toEqual({ ok: true });
    expect(__client.functions.invoke).toHaveBeenCalledWith(
      'ai-compassionate-comment',
      expect.objectContaining({ body: { postId: 'p1', body: 'hello' } }),
    );
  });

  it('swallows errors but does not throw', async () => {
    __client.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: '500' },
    });
    await expect(
      triggerCompassionateAiComment({ postId: 'p', body: 'x' }),
    ).resolves.toBeUndefined();
  });
});
