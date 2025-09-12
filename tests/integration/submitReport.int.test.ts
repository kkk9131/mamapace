/**
 * @jest-environment node
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const accessToken = process.env.TEST_USER_ACCESS_TOKEN;
const targetUserId = process.env.TEST_TARGET_USER_ID; // UUID of an existing user (not the same as reporter)

const shouldRun = !!(url && anon && accessToken && targetUserId);

const client = shouldRun
  ? createClient(url!, anon!, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
  : null;

const maybe = (name: string) => (shouldRun ? test : test.skip).bind(null, name);

describe('Edge submit-report minimal integration', () => {
  maybe('returns ok:true on first report', async () => {
    const { data, error } = await (client as any).functions.invoke('submit-report', {
      body: { target_type: 'user', target_id: targetUserId, reason_code: 'spam' },
    });
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
  });

  maybe('returns 409 on duplicate report', async () => {
    const { error } = await (client as any).functions.invoke('submit-report', {
      body: { target_type: 'user', target_id: targetUserId, reason_code: 'spam' },
    });
    // supabase-js wraps errors; status may be in error.context.status or error.status
    const status = (error as any)?.context?.status || (error as any)?.status;
    expect(status).toBe(409);
  });

  // Optional: stress the rate limit when explicitly enabled
  const runRateLimit = process.env.TEST_RUN_RATE_LIMIT === '1';
  (shouldRun && runRateLimit ? test : test.skip)('returns 429 on rate limit exceeded', async () => {
    // send 11 quick reports against synthetic targets to avoid duplicate guard
    let hit429 = false;
    for (let i = 0; i < 11; i++) {
      const tid = targetUserId; // reusing is fine; duplicate may trip earlier but we only assert 429 occurs
      const { error } = await (client as any).functions.invoke('submit-report', {
        body: { target_type: 'user', target_id: tid, reason_code: `spam-${i}` },
      });
      const status = (error as any)?.context?.status || (error as any)?.status;
      if (status === 429) {
        hit429 = true;
        break;
      }
    }
    expect(hit429).toBe(true);
  });
});

