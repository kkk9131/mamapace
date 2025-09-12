import { fillMissingAvatarUrls, fillMaternalVerified } from '../profileCompletion';

const mockClient = {
  from: (name: string) => {
    const b: any = {
      select: (_: string) => b,
      in: (_: string, __: string[]) => b,
      then: (resolve: any) => {
        if (name === 'user_profiles') {
          return resolve({ data: [{ id: 'u1', avatar_url: 'http://a/u1.png' }] });
        }
        if (name === 'user_profiles_public') {
          return resolve({ data: [{ id: 'u1', maternal_verified: true }] });
        }
        return resolve({ data: [] });
      },
    };
    return b;
  },
} as any;

describe('profileCompletion utils', () => {
  it('fills missing avatar urls', async () => {
    const items = [
      { id: 'p1', user_id: 'u1', body: '', created_at: '', attachments: [], user: { id: 'u1', username: 'a', display_name: null, avatar_emoji: null, avatar_url: null } },
    ] as any;
    const out = await fillMissingAvatarUrls(mockClient, items);
    expect(out[0].user?.avatar_url).toBe('http://a/u1.png');
  });

  it('fills maternal_verified', async () => {
    const items = [
      { id: 'p1', user_id: 'u1', body: '', created_at: '', attachments: [], user: { id: 'u1', username: 'a', display_name: null, avatar_emoji: null, avatar_url: 'x' } },
    ] as any;
    const out = await fillMaternalVerified(mockClient, items);
    expect(out[0].user?.maternal_verified).toBe(true);
  });
});

