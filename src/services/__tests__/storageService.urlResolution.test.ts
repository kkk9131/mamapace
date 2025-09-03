import { jest } from '@jest/globals';

// Helpers to create mocks per test
function mockSupabaseClient() {
  const getSession = jest.fn(async () => ({ data: { session: { access_token: 'token' } } }));
  const getPublicUrl = jest.fn((path: string) => ({ data: { publicUrl: `https://public.cdn/${path}` } }));
  jest.doMock('../supabaseClient', () => ({
    getSupabaseClient: () => ({
      auth: { getSession },
      storage: { from: () => ({ getPublicUrl }) },
    }),
  }));
  return { getSession, getPublicUrl };
}

function mockFileSystem(captor: { urls: string[] }) {
  jest.doMock('expo-file-system', () => ({
    uploadAsync: jest.fn(async (url: string) => { captor.urls.push(url); return { status: 200, body: '' }; }),
    FileSystemUploadType: { BINARY_CONTENT: 'binary' },
  }));
}

describe('storageService upload URL resolution', () => {
  beforeEach(() => {
    jest.resetModules();
  });
  it('uses env EXPO_PUBLIC_SUPABASE_URL when set', async () => {
    const captor = { urls: [] as string[] };
    mockSupabaseClient();
    mockFileSystem(captor);
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://from-env.example.com';
    let p: Promise<any> | undefined;
    jest.isolateModules(() => {
      const { uploadAvatarImage } = require('../storageService');
      p = uploadAvatarImage('user3', 'file:///avatar.webp');
    });
    await p;
    expect(captor.urls[0]).toMatch(/^https:\/\/from-env\.example\.com\//);
  });

  it('falls back to env SUPABASE_URL when EXPO_PUBLIC_SUPABASE_URL missing', async () => {
    const captor = { urls: [] as string[] };
    mockSupabaseClient();
    mockFileSystem(captor);
    delete (process.env as any).EXPO_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_URL = 'https://from-supabase-url.example.com';
    let p: Promise<any> | undefined;
    jest.isolateModules(() => {
      const { uploadAvatarImage } = require('../storageService');
      p = uploadAvatarImage('user4', 'file:///avatar.jpg');
    });
    await p;
    expect(captor.urls[0]).toMatch(/^https:\/\/from-supabase-url\.example\.com\//);
  });
});
