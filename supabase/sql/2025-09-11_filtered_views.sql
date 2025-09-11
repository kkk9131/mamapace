-- Filtered views and guarded RPCs for phased rollout
-- Note: additive only; does not modify existing objects. Apply post-PR.

-- View: posts_filtered — excludes posts from users blocked by the current user
create or replace view public.posts_filtered as
select p.*
from public.posts p
where not exists (
  select 1 from public.block_relationships br
  where br.blocker_id = auth.uid()
    and br.blocked_id = p.user_id
);

-- Ensure invoker's rights for RLS to take effect via caller
alter view public.posts_filtered set (security_invoker = true);
grant select on public.posts_filtered to authenticated;

-- View: user_profiles_public_filtered — excludes profiles the current user has blocked
create or replace view public.user_profiles_public_filtered as
select up.*
from public.user_profiles_public up
where not exists (
  select 1 from public.block_relationships br
  where br.blocker_id = auth.uid()
    and br.blocked_id = up.id
);

alter view public.user_profiles_public_filtered set (security_invoker = true);
grant select on public.user_profiles_public_filtered to authenticated;

-- View: conversations_filtered — excludes conversations with a blocked participant
create or replace view public.conversations_filtered as
select c.*
from public.conversations c
where not exists (
  select 1 from public.block_relationships br
  where br.blocker_id = auth.uid()
    and br.blocked_id = (case when c.participant_1_id = auth.uid() then c.participant_2_id else c.participant_1_id end)
);

alter view public.conversations_filtered set (security_invoker = true);
grant select on public.conversations_filtered to authenticated;

-- RPC: get_home_feed_v2_filtered — same shape as v2, but reads from posts_filtered
create or replace function public.get_home_feed_v2_filtered(
  p_limit int default 20,
  p_offset_time timestamptz default null
)
returns table (
  id uuid,
  user_id uuid,
  body text,
  attachments jsonb,
  created_at timestamptz,
  display_name text,
  avatar_emoji text,
  is_liked boolean,
  reaction_count bigint,
  comment_count bigint
) language plpgsql security definer as $$
begin
  return query
  select
    p.id,
    p.user_id,
    p.body,
    p.attachments,
    p.created_at,
    u.display_name,
    u.avatar_emoji,
    exists(select 1 from public.post_reactions r where r.post_id = p.id and r.user_id = auth.uid()) as is_liked,
    (select count(*) from public.post_reactions r where r.post_id = p.id) as reaction_count,
    (select count(*) from public.post_comments c where c.post_id = p.id) as comment_count
  from public.posts_filtered p
  join public.user_profiles u on p.user_id = u.id
  where (p_offset_time is null or p.created_at < p_offset_time)
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
end; $$;

grant execute on function public.get_home_feed_v2_filtered(int, timestamptz) to authenticated;

-- DM guard: prevent sending messages when either party has blocked the other
-- Helper function returning boolean eligibility
create or replace function public.can_send_dm(p_sender_id uuid, p_recipient_id uuid)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1 from public.block_relationships br
    where (br.blocker_id = p_sender_id and br.blocked_id = p_recipient_id)
       or (br.blocker_id = p_recipient_id and br.blocked_id = p_sender_id)
  );
$$;

grant execute on function public.can_send_dm(uuid, uuid) to authenticated;

-- Guarded wrapper for send_message that enforces block checks
create or replace function public.send_message_guarded(
  p_sender_id uuid,
  p_recipient_id uuid,
  p_content text,
  p_message_type text default 'text',
  p_metadata jsonb default '{}'
) returns public.messages
language plpgsql security definer as $$
declare
  v_msg public.messages%rowtype;
begin
  if not public.can_send_dm(p_sender_id, p_recipient_id) then
    raise exception 'DM is not allowed between these users' using errcode = 'P0001';
  end if;

  -- delegate to existing implementation
  v_msg := public.send_message(p_sender_id, p_recipient_id, p_content, p_message_type, p_metadata);
  return v_msg;
end; $$;

grant execute on function public.send_message_guarded(uuid, uuid, text, text, jsonb) to authenticated;

-- Optional: draft policy to enforce at table level (to be applied post-PR if desired)
-- This policy complements the function guard and protects direct inserts.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages' and policyname = 'messages_insert_block_guard'
  ) then
    create policy messages_insert_block_guard on public.messages
      for insert
      with check (
        public.can_send_dm(auth.uid(), (select case when c.participant_1_id = auth.uid() then c.participant_2_id else c.participant_1_id end
                                      from public.conversations c where c.id = messages.conversation_id))
      );
  end if;
end $$;
