-- Phase: Chat System
-- Tables and indexes for 1-on-1 chat functionality
-- References: user_profiles table from 02_schema.sql

-- 1) Conversations table - manages 1-on-1 chat relationships
drop table if exists public.conversations cascade;
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_1_id uuid not null references public.user_profiles(id) on delete cascade,
  participant_2_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_id uuid,
  -- Ensure no duplicate conversations and no self-conversations
  constraint conversations_no_duplicates check (participant_1_id < participant_2_id),
  constraint conversations_no_self_chat check (participant_1_id != participant_2_id)
);

-- Indexes for conversations
create index idx_conversations_participant_1 on public.conversations(participant_1_id);
create index idx_conversations_participant_2 on public.conversations(participant_2_id);
create index idx_conversations_participants on public.conversations(participant_1_id, participant_2_id);
create index idx_conversations_updated_at on public.conversations(updated_at desc);

-- 2) Messages table - stores all chat messages
drop table if exists public.messages cascade;
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.user_profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  message_type text not null default 'text' check (message_type in ('text', 'image', 'file')),
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  is_edited boolean not null default false
);

-- Indexes for messages
create index idx_messages_conversation_id_created_at on public.messages(conversation_id, created_at desc);
create index idx_messages_sender_id on public.messages(sender_id);
create index idx_messages_created_at on public.messages(created_at desc);
create index idx_messages_deleted_at on public.messages(deleted_at) where deleted_at is not null;

-- Add foreign key constraint for last_message_id after messages table exists
alter table public.conversations 
add constraint fk_conversations_last_message 
foreign key (last_message_id) references public.messages(id) on delete set null;

-- 3) Read receipts table - tracks message read status
drop table if exists public.read_receipts cascade;
create table public.read_receipts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  last_read_message_id uuid not null references public.messages(id) on delete cascade,
  read_at timestamptz not null default now(),
  -- One read receipt per user per conversation
  unique(conversation_id, user_id)
);

-- Indexes for read receipts
create index idx_read_receipts_conversation_id on public.read_receipts(conversation_id);
create index idx_read_receipts_user_id on public.read_receipts(user_id);
create index idx_read_receipts_message_id on public.read_receipts(last_read_message_id);

-- 4) Typing indicators table - manages typing status
drop table if exists public.typing_indicators cascade;
create table public.typing_indicators (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  is_typing boolean not null default false,
  updated_at timestamptz not null default now(),
  -- One typing indicator per user per conversation
  unique(conversation_id, user_id)
);

-- Indexes for typing indicators
create index idx_typing_indicators_conversation_id on public.typing_indicators(conversation_id);
create index idx_typing_indicators_user_id on public.typing_indicators(user_id);
create index idx_typing_indicators_is_typing on public.typing_indicators(is_typing) where is_typing = true;

-- 5) Helper functions for conversation management

-- Function to get or create a conversation between two users
create or replace function public.get_or_create_conversation(
  p_user1_id uuid,
  p_user2_id uuid
) returns uuid
language plpgsql security definer
as $$
declare
  v_conversation_id uuid;
  v_participant_1_id uuid;
  v_participant_2_id uuid;
begin
  -- Ensure consistent ordering (smaller UUID first)
  if p_user1_id < p_user2_id then
    v_participant_1_id := p_user1_id;
    v_participant_2_id := p_user2_id;
  else
    v_participant_1_id := p_user2_id;
    v_participant_2_id := p_user1_id;
  end if;

  -- Try to find existing conversation
  select id into v_conversation_id
  from public.conversations
  where participant_1_id = v_participant_1_id 
    and participant_2_id = v_participant_2_id;

  -- If not found, create new conversation
  if v_conversation_id is null then
    insert into public.conversations (participant_1_id, participant_2_id)
    values (v_participant_1_id, v_participant_2_id)
    returning id into v_conversation_id;
  end if;

  return v_conversation_id;
end;
$$;

-- Function to send a message
create or replace function public.send_message(
  p_sender_id uuid,
  p_recipient_id uuid,
  p_content text,
  p_message_type text default 'text',
  p_metadata jsonb default '{}'
) returns public.messages
language plpgsql security definer
as $$
declare
  v_conversation_id uuid;
  v_message public.messages%rowtype;
begin
  -- Get or create conversation
  v_conversation_id := public.get_or_create_conversation(p_sender_id, p_recipient_id);
  
  -- Insert message
  insert into public.messages (
    conversation_id,
    sender_id,
    content,
    message_type,
    metadata
  ) values (
    v_conversation_id,
    p_sender_id,
    p_content,
    p_message_type,
    p_metadata
  ) returning * into v_message;

  -- Update conversation's last_message_id and updated_at
  update public.conversations 
  set 
    last_message_id = v_message.id,
    updated_at = v_message.created_at
  where id = v_conversation_id;

  return v_message;
end;
$$;

-- Function to mark messages as read
create or replace function public.mark_conversation_read(
  p_user_id uuid,
  p_conversation_id uuid,
  p_last_message_id uuid default null
) returns void
language plpgsql security definer
as $$
declare
  v_last_message_id uuid;
begin
  -- If no specific message provided, use the latest message in conversation
  if p_last_message_id is null then
    select id into v_last_message_id
    from public.messages
    where conversation_id = p_conversation_id
      and deleted_at is null
    order by created_at desc
    limit 1;
  else
    v_last_message_id := p_last_message_id;
  end if;

  -- Skip if no messages found
  if v_last_message_id is null then
    return;
  end if;

  -- Insert or update read receipt
  insert into public.read_receipts (conversation_id, user_id, last_read_message_id)
  values (p_conversation_id, p_user_id, v_last_message_id)
  on conflict (conversation_id, user_id)
  do update set 
    last_read_message_id = excluded.last_read_message_id,
    read_at = now();
end;
$$;

-- Function to update typing status
create or replace function public.update_typing_status(
  p_user_id uuid,
  p_conversation_id uuid,
  p_is_typing boolean
) returns void
language plpgsql security definer
as $$
begin
  insert into public.typing_indicators (conversation_id, user_id, is_typing)
  values (p_conversation_id, p_user_id, p_is_typing)
  on conflict (conversation_id, user_id)
  do update set 
    is_typing = excluded.is_typing,
    updated_at = now();
end;
$$;

-- Function to get conversation messages with pagination
create or replace function public.get_conversation_messages(
  p_conversation_id uuid,
  p_limit int default 50,
  p_before timestamptz default null
) returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  content text,
  message_type text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  is_edited boolean,
  sender_username text,
  sender_display_name text,
  sender_avatar_emoji text
)
language sql stable security definer
as $$
  select 
    m.id,
    m.conversation_id,
    m.sender_id,
    m.content,
    m.message_type,
    m.metadata,
    m.created_at,
    m.updated_at,
    m.is_edited,
    u.username as sender_username,
    u.display_name as sender_display_name,
    u.avatar_emoji as sender_avatar_emoji
  from public.messages m
  join public.user_profiles u on u.id = m.sender_id
  where m.conversation_id = p_conversation_id
    and m.deleted_at is null
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

-- Function to get user's conversations list
create or replace function public.get_user_conversations(
  p_user_id uuid,
  p_limit int default 20
) returns table (
  id uuid,
  participant_id uuid,
  participant_username text,
  participant_display_name text,
  participant_avatar_emoji text,
  last_message_content text,
  last_message_created_at timestamptz,
  last_message_sender_id uuid,
  unread_count bigint,
  updated_at timestamptz
)
language sql stable security definer
as $$
  select 
    c.id,
    case 
      when c.participant_1_id = p_user_id then c.participant_2_id
      else c.participant_1_id
    end as participant_id,
    u.username as participant_username,
    u.display_name as participant_display_name,
    u.avatar_emoji as participant_avatar_emoji,
    lm.content as last_message_content,
    lm.created_at as last_message_created_at,
    lm.sender_id as last_message_sender_id,
    coalesce(
      (select count(*)::bigint
       from public.messages m
       left join public.read_receipts rr on (
         rr.conversation_id = c.id 
         and rr.user_id = p_user_id
       )
       where m.conversation_id = c.id
         and m.sender_id != p_user_id
         and m.deleted_at is null
         and (rr.last_read_message_id is null or m.created_at > (
           select created_at from public.messages 
           where id = rr.last_read_message_id
         ))
      ), 0
    ) as unread_count,
    c.updated_at
  from public.conversations c
  join public.user_profiles u on (
    u.id = case 
      when c.participant_1_id = p_user_id then c.participant_2_id
      else c.participant_1_id
    end
  )
  left join public.messages lm on lm.id = c.last_message_id
  where (c.participant_1_id = p_user_id or c.participant_2_id = p_user_id)
    and u.is_active = true
  order by c.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

-- Cleanup function to remove old typing indicators (run via cron or app logic)
create or replace function public.cleanup_typing_indicators(
  p_threshold_minutes int default 2
) returns int
language plpgsql security definer
as $$
declare
  v_deleted_count int;
begin
  delete from public.typing_indicators
  where updated_at < (now() - interval '1 minute' * p_threshold_minutes);
  
  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;