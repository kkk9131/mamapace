export function createBatchUpdater<T extends Record<string, any>>(
  flush: (patch: Partial<T>) => Promise<any> | any,
  delayMs = 300
) {
  let pending: Partial<T> = {};
  let timer: any = null;

  const flushNow = async () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const patch = pending;
    pending = {};
    if (Object.keys(patch).length > 0) {
      return await flush(patch);
    }
  };

  const schedule = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(flushNow, delayMs);
  };

  const set = (key: keyof T, value: any) => {
    pending = { ...(pending as any), [key]: value };
    schedule();
  };

  return { set, flushNow };
}
