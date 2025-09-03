import { createBatchUpdater } from '../batchUpdate';

jest.useFakeTimers();

describe('createBatchUpdater', () => {
  it('バッチで更新をまとめて1回だけflushする', async () => {
    const calls: any[] = [];
    const updater = createBatchUpdater<{ a: boolean; b: boolean; c: boolean }>(async (patch) => {
      calls.push(patch);
      return true;
    }, 300);

    updater.set('a', false);
    updater.set('b', false);
    jest.advanceTimersByTime(250);
    updater.set('c', false);

    await jest.runOnlyPendingTimersAsync();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ a: false, b: false, c: false });
  });

  it('flushNowで即時反映され、ペンディングはクリアされる', async () => {
    const calls: any[] = [];
    const updater = createBatchUpdater<{ x: boolean }>(async (patch) => {
      calls.push(patch);
      return true;
    }, 300);

    updater.set('x', true);
    await updater.flushNow();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ x: true });

    // もう一度タイマーを進めても追加flushは走らない
    await jest.runOnlyPendingTimersAsync();
    expect(calls).toHaveLength(1);
  });
});

