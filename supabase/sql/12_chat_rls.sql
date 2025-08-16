-- Row Level Security (RLS) policies for chat system
-- Ensures users can only access conversations they are part of

-- Enable RLS on all chat tables
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.read_receipts enable row level security;
alter table public.typing_indicators enable row level security;

-- ========================================
-- CONVERSATIONS TABLE POLICIES
-- ========================================

-- Users can view conversations they are participants in
create policy conversations_select_participants on public.conversations
  for select using (
    auth.role() = 'authenticated' and (
      participant_1_id = auth.uid() or 
      participant_2_id = auth.uid()
    )
  );

-- Users can create conversations where they are one of the participants
create policy conversations_insert_participant on public.conversations
  for insert with check (
    auth.role() = 'authenticated' and (
      participant_1_id = auth.uid() or 
      participant_2_id = auth.uid()
    )
  );

-- Users can update conversations they are part of (mainly for last_message_id)
create policy conversations_update_participants on public.conversations
  for update using (
    auth.role() = 'authenticated' and (
      participant_1_id = auth.uid() or 
      participant_2_id = auth.uid()
    )
  );

-- Users can delete conversations they are part of
create policy conversations_delete_participants on public.conversations
  for delete using (
    auth.role() = 'authenticated' and (
      participant_1_id = auth.uid() or 
      participant_2_id = auth.uid()
    )
  );

-- ========================================
-- MESSAGES TABLE POLICIES
-- ========================================

-- Users can view messages in conversations they are part of
create policy messages_select_conversation_participants on public.messages
  for select using (
    auth.role() = 'authenticated' and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (
        c.participant_1_id = auth.uid() or 
        c.participant_2_id = auth.uid()
      )
    )
  );

-- Users can insert messages they are sending in conversations they are part of
create policy messages_insert_own_in_conversation on public.messages
  for insert with check (
    auth.role() = 'authenticated' and
    sender_id = auth.uid() and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (
        c.participant_1_id = auth.uid() or 
        c.participant_2_id = auth.uid()
      )
    )
  );

-- Users can update their own messages
create policy messages_update_own on public.messages
  for update using (
    auth.role() = 'authenticated' and 
    sender_id = auth.uid()
  );

-- Users can soft delete their own messages (set deleted_at)
create policy messages_delete_own on public.messages
  for delete using (
    auth.role() = 'authenticated' and 
    sender_id = auth.uid()
  );

-- ========================================
-- READ RECEIPTS TABLE POLICIES
-- ========================================

-- Users can view read receipts for conversations they are part of
create policy read_receipts_select_conversation_participants on public.read_receipts
  for select using (
    auth.role() = 'authenticated' and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (
        c.participant_1_id = auth.uid() or 
        c.participant_2_id = auth.uid()
      )
    )
  );

-- Users can insert/update their own read receipts
create policy read_receipts_insert_own on public.read_receipts
  for insert with check (
    auth.role() = 'authenticated' and
    user_id = auth.uid() and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (
        c.participant_1_id = auth.uid() or 
        c.participant_2_id = auth.uid()
      )
    )
  );

-- Users can update their own read receipts
create policy read_receipts_update_own on public.read_receipts
  for update using (
    auth.role() = 'authenticated' and 
    user_id = auth.uid()
  );

-- Users can delete their own read receipts
create policy read_receipts_delete_own on public.read_receipts
  for delete using (
    auth.role() = 'authenticated' and 
    user_id = auth.uid()
  );

-- ========================================
-- TYPING INDICATORS TABLE POLICIES
-- ========================================

-- Users can view typing indicators for conversations they are part of
create policy typing_indicators_select_conversation_participants on public.typing_indicators
  for select using (
    auth.role() = 'authenticated' and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (
        c.participant_1_id = auth.uid() or 
        c.participant_2_id = auth.uid()
      )
    )
  );

-- Users can insert their own typing indicators
create policy typing_indicators_insert_own on public.typing_indicators
  for insert with check (
    auth.role() = 'authenticated' and
    user_id = auth.uid() and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (
        c.participant_1_id = auth.uid() or 
        c.participant_2_id = auth.uid()
      )
    )
  );

-- Users can update their own typing indicators
create policy typing_indicators_update_own on public.typing_indicators
  for update using (
    auth.role() = 'authenticated' and 
    user_id = auth.uid()
  );

-- Users can delete their own typing indicators
create policy typing_indicators_delete_own on public.typing_indicators
  for delete using (
    auth.role() = 'authenticated' and 
    user_id = auth.uid()
  );

-- ========================================
-- FUNCTION PERMISSIONS
-- ========================================

-- Grant execute permissions on chat functions to authenticated users
grant execute on function public.get_or_create_conversation(uuid, uuid) to authenticated;
grant execute on function public.send_message(uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function public.mark_conversation_read(uuid, uuid, uuid) to authenticated;
grant execute on function public.update_typing_status(uuid, uuid, boolean) to authenticated;
grant execute on function public.get_conversation_messages(uuid, int, timestamptz) to authenticated;
grant execute on function public.get_user_conversations(uuid, int) to authenticated;
grant execute on function public.cleanup_typing_indicators(int) to authenticated;

-- ========================================
-- SECURITY NOTES
-- ========================================

/*
Security considerations implemented:

1. Conversation Access Control:
   - Users can only access conversations they are participants in
   - Prevents unauthorized access to private conversations
   - Enforced at both table and function level

2. Message Security:
   - Users can only view messages in their conversations
   - Users can only send messages as themselves
   - Users can only edit/delete their own messages
   - Soft delete approach preserves conversation integrity

3. Read Receipt Privacy:
   - Users can only see read receipts for their own conversations
   - Users can only manage their own read status
   - Prevents stalking behavior through read status

4. Typing Indicator Control:
   - Users can only see typing indicators in their conversations
   - Users can only update their own typing status
   - Automatic cleanup prevents stale indicators

5. Function-Level Security:
   - All functions use security definer with proper user checks
   - Functions validate user participation before operations
   - Consistent with existing codebase patterns

6. Performance Considerations:
   - Policies use efficient existence checks
   - Indexes support policy filtering
   - Functions include reasonable limits and bounds checking
*/