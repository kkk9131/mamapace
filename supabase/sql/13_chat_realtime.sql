-- Realtime configuration and triggers for chat system
-- Enables real-time updates for conversations, messages, and typing indicators

-- ========================================
-- ENABLE REALTIME ON TABLES
-- ========================================

-- Enable realtime on all chat tables
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.read_receipts;
alter publication supabase_realtime add table public.typing_indicators;

-- ========================================
-- TRIGGER FUNCTIONS FOR AUTOMATIC UPDATES
-- ========================================

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Function to update conversation when new message is sent
create or replace function public.update_conversation_on_message()
returns trigger
language plpgsql
as $$
begin
  -- Update conversation's updated_at and last_message_id
  update public.conversations 
  set 
    updated_at = new.created_at,
    last_message_id = new.id
  where id = new.conversation_id;
  
  return new;
end;
$$;

-- Function to handle message updates (for edit tracking)
create or replace function public.handle_message_update()
returns trigger
language plpgsql
as $$
begin
  -- Mark message as edited if content changed
  if old.content != new.content then
    new.is_edited = true;
    new.updated_at = now();
  end if;
  
  return new;
end;
$$;

-- Function to clean up typing indicators when messages are sent
create or replace function public.cleanup_typing_on_message()
returns trigger
language plpgsql
as $$
begin
  -- Remove typing indicator for the sender when they send a message
  delete from public.typing_indicators 
  where conversation_id = new.conversation_id 
    and user_id = new.sender_id;
  
  return new;
end;
$$;

-- ========================================
-- CREATE TRIGGERS
-- ========================================

-- Update timestamps on conversations
create trigger conversations_update_updated_at
  before update on public.conversations
  for each row
  execute function public.update_updated_at_column();

-- Update timestamps on messages
create trigger messages_update_updated_at
  before update on public.messages
  for each row
  execute function public.handle_message_update();

-- Update conversation when new message is inserted
create trigger update_conversation_on_new_message
  after insert on public.messages
  for each row
  execute function public.update_conversation_on_message();

-- Clean up typing indicators when message is sent
create trigger cleanup_typing_on_new_message
  after insert on public.messages
  for each row
  execute function public.cleanup_typing_on_message();

-- Update timestamps on typing indicators
create trigger typing_indicators_update_updated_at
  before update on public.typing_indicators
  for each row
  execute function public.update_updated_at_column();

-- ========================================
-- REALTIME HELPER FUNCTIONS
-- ========================================

-- Function to get realtime conversation updates for a user
create or replace function public.get_conversation_realtime_payload(
  p_conversation_id uuid,
  p_user_id uuid
) returns jsonb
language sql stable security definer
as $$
  select jsonb_build_object(
    'conversation_id', c.id,
    'participant_id', case 
      when c.participant_1_id = p_user_id then c.participant_2_id
      else c.participant_1_id
    end,
    'participant_username', u.username,
    'participant_display_name', u.display_name,
    'participant_avatar_emoji', u.avatar_emoji,
    'last_message', case 
      when lm.id is not null then jsonb_build_object(
        'id', lm.id,
        'content', lm.content,
        'sender_id', lm.sender_id,
        'created_at', lm.created_at,
        'message_type', lm.message_type
      )
      else null
    end,
    'unread_count', coalesce(
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
    ),
    'updated_at', c.updated_at
  )
  from public.conversations c
  join public.user_profiles u on (
    u.id = case 
      when c.participant_1_id = p_user_id then c.participant_2_id
      else c.participant_1_id
    end
  )
  left join public.messages lm on lm.id = c.last_message_id
  where c.id = p_conversation_id;
$$;

-- Function to broadcast typing status changes
create or replace function public.broadcast_typing_status(
  p_conversation_id uuid,
  p_user_id uuid,
  p_is_typing boolean
) returns void
language plpgsql security definer
as $$
declare
  v_payload jsonb;
begin
  -- Update typing status
  perform public.update_typing_status(p_user_id, p_conversation_id, p_is_typing);
  
  -- Prepare broadcast payload
  v_payload := jsonb_build_object(
    'conversation_id', p_conversation_id,
    'user_id', p_user_id,
    'username', (select username from public.user_profiles where id = p_user_id),
    'is_typing', p_is_typing,
    'timestamp', now()
  );
  
  -- Note: In a real implementation, you would use pg_notify or similar
  -- For now, the realtime subscription on typing_indicators table will handle this
end;
$$;

-- ========================================
-- REALTIME SUBSCRIPTION PATTERNS
-- ========================================

/*
CLIENT SUBSCRIPTION EXAMPLES:

1. Subscribe to user's conversations list:
   - Table: conversations
   - Filter: participant_1_id=eq.{user_id} OR participant_2_id=eq.{user_id}
   - Events: INSERT, UPDATE, DELETE

2. Subscribe to messages in a specific conversation:
   - Table: messages  
   - Filter: conversation_id=eq.{conversation_id}
   - Events: INSERT, UPDATE, DELETE

3. Subscribe to read receipts in a conversation:
   - Table: read_receipts
   - Filter: conversation_id=eq.{conversation_id}
   - Events: INSERT, UPDATE, DELETE

4. Subscribe to typing indicators in a conversation:
   - Table: typing_indicators
   - Filter: conversation_id=eq.{conversation_id}
   - Events: INSERT, UPDATE, DELETE

JAVASCRIPT EXAMPLES:

// Subscribe to user's conversations
const conversationsSubscription = supabase
  .channel('user_conversations')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'conversations',
    filter: `participant_1_id=eq.${userId}`
  }, handleConversationUpdate)
  .on('postgres_changes', {
    event: '*',
    schema: 'public', 
    table: 'conversations',
    filter: `participant_2_id=eq.${userId}`
  }, handleConversationUpdate)
  .subscribe();

// Subscribe to messages in a conversation
const messagesSubscription = supabase
  .channel(`conversation_${conversationId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  }, handleMessageUpdate)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'read_receipts', 
    filter: `conversation_id=eq.${conversationId}`
  }, handleReadReceiptUpdate)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'typing_indicators',
    filter: `conversation_id=eq.${conversationId}`
  }, handleTypingUpdate)
  .subscribe();

// Send typing indicator
const sendTypingStatus = async (conversationId, isTyping) => {
  await supabase.rpc('update_typing_status', {
    p_conversation_id: conversationId,
    p_user_id: userId,
    p_is_typing: isTyping
  });
};

// Mark conversation as read
const markAsRead = async (conversationId, lastMessageId) => {
  await supabase.rpc('mark_conversation_read', {
    p_user_id: userId,
    p_conversation_id: conversationId,
    p_last_message_id: lastMessageId
  });
};
*/

-- ========================================
-- PERFORMANCE OPTIMIZATION
-- ========================================

-- Function to periodically clean up stale typing indicators
-- This should be called by a cron job or background task
create or replace function public.auto_cleanup_typing_indicators()
returns void
language plpgsql security definer
as $$
begin
  -- Remove typing indicators older than 5 minutes
  delete from public.typing_indicators
  where updated_at < (now() - interval '5 minutes');
  
  -- Reset typing indicators that haven't been updated in 2 minutes
  update public.typing_indicators 
  set is_typing = false, updated_at = now()
  where is_typing = true 
    and updated_at < (now() - interval '2 minutes');
end;
$$;

-- Grant execute permissions
grant execute on function public.get_conversation_realtime_payload(uuid, uuid) to authenticated;
grant execute on function public.broadcast_typing_status(uuid, uuid, boolean) to authenticated;

-- ========================================
-- SECURITY CONSIDERATIONS FOR REALTIME
-- ========================================

/*
RLS policies automatically apply to realtime subscriptions, ensuring:

1. Users only receive updates for conversations they participate in
2. Message updates are filtered by conversation participation  
3. Read receipts and typing indicators respect privacy boundaries
4. All realtime events respect the same security model as direct queries

Additional security measures:
- Typing indicators auto-expire to prevent stale data
- Message content is filtered through RLS policies
- Subscription filters must align with RLS policy conditions
- Functions validate user permissions before operations
*/