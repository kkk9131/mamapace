AI compassionate comment feature

Overview
- When composing a post, users can toggle "ママの味方のコメント" ON.
- After posting, a Supabase Edge Function `ai-compassionate-comment` calls Gemini to generate a short, empathetic comment and posts it as a system user on that post.

Server setup
- Create a user in `user_profiles` to represent the AI system (e.g., display_name: "ママの味方"), and note its `id`.
- Deploy the function folder `supabase/functions/ai-compassionate-comment`.
- Configure Edge Function environment variables:
  - `GEMINI_API_KEY`: Gemini API key
  - `SYSTEM_USER_ID`: UUID of the system user (user_profiles.id)
  - `DAILY_LIMIT` (optional): default 3 per day per author

Deployment
- Using the Supabase CLI:
  - supabase functions deploy ai-compassionate-comment --project-ref <your-project-ref>
  - supabase functions secrets set GEMINI_API_KEY=... SYSTEM_USER_ID=... DAILY_LIMIT=3 --project-ref <your-project-ref> --env-file <(printenv)

Client behavior
- Toggle is already present in `src/screens/ComposeScreen.tsx`.
- After creating a post, the app triggers `functions.invoke('ai-compassionate-comment', { postId, body })`.
- The UI does not wait for the AI reply; the comment appears in the thread when ready.

Safety and tone
- Prompt instructs the model to be kind, validating, non-judgmental, and avoid medical/legal advice.
- Output length is kept below the 300-character DB limit (target ~200, hard cap ~280).

Notes
- Language: The function asks Gemini to reply in the same language as the post.
- Rate limit: 3 AI comments per author per day (adjustable by DAILY_LIMIT).
