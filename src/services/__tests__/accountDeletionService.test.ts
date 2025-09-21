import { deleteMyAccount } from '../accountDeletionService';

jest.mock('../../services/supabaseClient', () => {
  const auth = {
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'me', email: 'me@example.com' } }, error: null }),
    signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: null }),
  };
  const functions = {
    invoke: jest.fn().mockResolvedValue({ data: { ok: true }, error: null }),
  };
  return {
    getSupabaseClient: () => ({ auth, functions }),
  };
});

describe('accountDeletionService', () => {
  it('reauthenticates and invokes delete-account function', async () => {
    await expect(deleteMyAccount('pw123')).resolves.toBeUndefined();

    const { getSupabaseClient } = jest.requireMock('../../services/supabaseClient');
    const client = getSupabaseClient();
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'me@example.com',
      password: 'pw123',
    });
    expect(client.functions.invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
  });

  it('throws on bad password', async () => {
    const { getSupabaseClient } = jest.requireMock('../../services/supabaseClient');
    const client = getSupabaseClient();
    (client.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: 'Invalid login' } });
    await expect(deleteMyAccount('bad')).rejects.toThrow('Invalid login');
  });
});

