import { getSupabaseClient } from './supabaseClient';

export type AICommentResponse = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

export async function triggerCompassionateAiComment(options: {
  postId: string;
  body: string;
}): Promise<AICommentResponse | undefined> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.functions.invoke(
      'ai-compassionate-comment',
      {
        body: {
          postId: options.postId,
          body: options.body,
        },
      },
    );
    if (error) {
      const anyErr = error as any;
      console.warn('AI comment function error', error);
      try {
        if (anyErr?.context) {
          console.warn('AI comment function error context', JSON.stringify(anyErr.context));
          const resp = anyErr.context as Response & {
            json?: () => Promise<any>;
            text?: () => Promise<string>;
          };
          if (resp && typeof resp.json === 'function') {
            const body = await resp
              .json()
              .catch(async () => (typeof resp.text === 'function' ? await resp.text() : null));
            if (body) {
              console.warn('AI comment function error body', body);
            }
          }
        }
      } catch {}
      return { ok: false, error: 'invoke_error' };
    }
    return (data as AICommentResponse) || { ok: false, error: 'unknown' };
  } catch (e) {
    console.warn('AI comment trigger failed', e);
    return { ok: false, error: String((e as any)?.message || e) };
  }
}
