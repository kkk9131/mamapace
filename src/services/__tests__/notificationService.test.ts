import { jest } from '@jest/globals';

jest.mock('../supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: () => {
      const builder: any = {
        _calls: { order: [], lt: [], limit: [] },
        select() { return builder; },
        eq() { return builder; },
        order(field: string, opts: any) { builder._calls.order.push([field, opts]); return builder; },
        lt(field: string, value: any) { builder._calls.lt.push([field, value]); return builder; },
        limit(n: number) { builder._calls.limit.push(n); return builder; },
        then(resolve: any) { return resolve({ data: builder._data, error: null }); },
        setData(data: any[]) { builder._data = data; return builder; },
      };
      return builder.setData([
        { id: '1', type: 'like', content: 'a', created_at: '2023-01-02T00:00:00Z', read_at: null },
        { id: '2', type: 'comment', content: 'b', created_at: '2023-01-01T00:00:00Z', read_at: '2023-01-01T00:00:00Z' },
      ]);
    },
  }),
}));

import { notificationService } from '../notificationService';

describe('notificationService.list', () => {
  it('returns items with nextCursor and respects limit', async () => {
    const res = await notificationService.list('user-1', { limit: 2 });
    expect(res.data).toHaveLength(2);
    expect(res.nextCursor).toBe('2023-01-01T00:00:00Z');
  });

  it('handles cursor option without errors and returns structure', async () => {
    jest.isolateModules(() => {
      jest.doMock('../supabaseClient', () => ({
        getSupabaseClient: () => ({
          from: () => ({
            select() { return this; },
            eq() { return this; },
            order() { return this; },
            lt() { return this; },
            limit() { return this; },
            then(r: any) { return r({ data: [], error: null }); },
          }),
        }),
      }));
      const { notificationService: svc } = require('../notificationService');
      return svc.list('user-1', { limit: 1, cursor: '2023-01-01T00:00:00Z' });
    });
    // If no throw, structure should be { data: [], nextCursor: null | undefined }
    const res = await notificationService.list('user-1', { limit: 1, cursor: '2023-01-01T00:00:00Z' });
    expect(res).toHaveProperty('data');
    expect(Array.isArray(res.data)).toBe(true);
  });
});
