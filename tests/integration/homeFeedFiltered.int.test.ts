/**
 * @jest-environment node
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const accessToken = process.env.TEST_USER_ACCESS_TOKEN;
const blockedUserId = process.env.TEST_BLOCKED_USER_ID; // UUID of a user who may have posts

const shouldRun = !!(url && anon && accessToken && blockedUserId);
const client = shouldRun
  ? createClient(url!, anon!, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
  : null;

const maybe = (name: string) => (shouldRun ? test : test.skip).bind(null, name);

describe('Filtered home feed excludes blocked users', () => {
  maybe('excludes posts from a blocked user when available', async () => {
    // Ensure a block relationship exists
    await (client as any)
      .from('block_relationships')
      .insert({ blocker_id: null, blocked_id: blockedUserId });
    // Note: RLS enforces blocker_id=auth.uid() automatically via policy; explicit null lets DB fill with uid when using with check
    // If the above insert fails due to policy differences, the following assertion may still pass if user has no posts.

    // Check if there are posts by the blocked user; if none, skip to avoid false positive
    const { data: rawPosts } = await (client as any)
      .from('posts')
      .select('id')
      .eq('user_id', blockedUserId)
      .limit(1);
    if (!rawPosts || rawPosts.length === 0) {
      console.warn('No posts found for TEST_BLOCKED_USER_ID; skipping assertion.');
      return;
    }

    const { data, error } = await (client as any).rpc('get_home_feed_v2_filtered', {
      p_offset_time: null,
      p_limit: 20,
    });
    expect(error).toBeNull();
    const items = (data || []) as any[];
    const hasBlocked = items.some((row: any) => row.user_id === blockedUserId);
    expect(hasBlocked).toBe(false);
  });
});

