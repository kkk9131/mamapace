import { getSupabaseClient } from './supabaseClient';

export async function triggerCompassionateAiComment(options: {
  postId: string;
  body: string;
}): Promise<{ ok: boolean; skipped?: boolean } | void> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.functions.invoke('ai-compassionate-comment', {
      body: {
        postId: options.postId,
        body: options.body,
      },
    });
    if (error) {
      // Non-fatal: just log
      const anyErr = error as any;
      console.warn('AI comment function error', error);
      try {
        if (anyErr?.context) {
          console.warn('AI comment function error context', JSON.stringify(anyErr.context));
          // Attempt to read response body for detailed message
          const resp = anyErr.context as Response & { json?: () => Promise<any>; text?: () => Promise<string> };
          if (resp && typeof resp.json === 'function') {
            const body = await resp.json().catch(async () => {
              if (typeof resp.text === 'function') return await resp.text();
              return null;
            });
            if (body) console.warn('AI comment function error body', body);
          }
        }
      } catch {}
      return;
    }
    return data as any;
  } catch (e) {
    console.warn('AI comment trigger failed', e);
  }
}
