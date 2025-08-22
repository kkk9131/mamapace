/**
 * ROOM SERVICE
 *
 * Service layer for room system operations including spaces, channels, and anonymous rooms
 * Implements the requirements from room-feature-requirements-v1.md
 *
 * SECURITY RULES:
 * 1. NEVER log message content or user information
 * 2. Use appropriate error handling and validation
 * 3. Follow existing security patterns from authService and chatService
 */

import { getSupabaseClient } from './supabaseClient';
import {
  Space,
  SpaceWithOwner,
  CreateSpaceRequest,
  SpaceSearchParams,
  Channel,
  ChannelMember,
  ChannelMemberWithUser,
  ChannelWithSpace,
  RoomMessage,
  RoomMessageWithSender,
  SendChannelMessageRequest,
  SendAnonymousMessageRequest,
  AnonymousRoom,
  AnonymousMessage,
  ChatListItem,
  ReportMessageRequest,
  ApiResponse,
  MessagePaginationParams,
  PaginatedMessages,
  sanitizeRoomMessageForLogging,
  sanitizeSpaceForLogging,
  getCurrentAnonymousSlotId,
} from '../types/room';
import { PublicUserProfile } from '../types/auth';

/**
 * Room Service Class
 * Handles all room-related API operations
 */
export class RoomService {
  // =====================================================
  // SPACE MANAGEMENT
  // =====================================================

  /**
   * Create a new space using direct table operations
   */
  static async createSpace(
    request: CreateSpaceRequest
  ): Promise<ApiResponse<{ space_id: string; channel_id: string }>> {
    try {
      const supabase = getSupabaseClient();
      const { data: user } = await supabase.auth.getUser();

      if (!user.user) {
        return { error: 'Not authenticated' };
      }

      // Insert new space
      const { data: space, error: spaceError } = await supabase
        .from('spaces')
        .insert({
          name: request.name,
          description: request.description || null,
          tags: request.tags || [],
          is_public: request.is_public ?? true,
          owner_id: user.user.id,
          max_members: request.max_members || (request.is_public ? 500 : 50),
        })
        .select('id')
        .single();

      if (spaceError) {
        console.error('[RoomService] Create space error:', spaceError.message);
        return { error: spaceError.message };
      }

      // Create default channel for the space
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .insert({
          space_id: space.id,
          name: 'general',
          description: null,
          channel_type: 'text',
        })
        .select('id')
        .single();

      if (channelError) {
        console.error(
          '[RoomService] Create channel error:',
          channelError.message
        );
        // Try to cleanup space if channel creation failed
        await supabase.from('spaces').delete().eq('id', space.id);
        return { error: channelError.message };
      }

      // Add owner as member of the channel
      const { error: memberError } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channel.id,
          user_id: user.user.id,
          role: 'owner',
        });

      if (memberError) {
        console.error('[RoomService] Add member error:', memberError.message);
        // Continue even if member add fails - space and channel are created
      }

      return {
        success: true,
        data: {
          space_id: space.id,
          channel_id: channel.id,
        },
        message: 'Space created successfully',
      };
    } catch (error: any) {
      console.error('[RoomService] Create space exception:', error.message);
      return { error: 'Failed to create space' };
    }
  }

  /**
   * Search public spaces using direct table operations
   */
  static async searchPublicSpaces(
    params: SpaceSearchParams = {}
  ): Promise<ApiResponse<SpaceWithOwner[]>> {
    try {
      const supabase = getSupabaseClient();
      let query = supabase
        .from('spaces')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      // Apply search filters
      if (params.query) {
        query = query.ilike('name', `%${params.query}%`);
      }

      if (params.tags && params.tags.length > 0) {
        query = query.overlaps('tags', params.tags);
      }

      // Apply pagination
      const limit = params.limit || 20;
      const offset = params.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data: spaces, error } = await query;

      if (error) {
        console.error('[RoomService] Search spaces error:', error.message);
        return { error: 'Failed to search spaces' };
      }

      if (!spaces || spaces.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // Get unique owner IDs
      const ownerIds = Array.from(
        new Set(spaces.map(space => space.owner_id).filter(Boolean))
      );

      // Fetch owner profiles separately
      const { data: ownerProfiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_emoji')
        .in('id', ownerIds);

      if (profileError) {
        console.error(
          '[RoomService] Get owner profiles error:',
          profileError.message
        );
        // Continue without owner info rather than failing completely
      }

      // Create a map of owner profiles for easy lookup
      const ownerMap = new Map(
        (ownerProfiles || []).map(profile => [profile.id, profile])
      );

      // Transform data to include can_join flag and owner information
      const spacesWithOwner: SpaceWithOwner[] = spaces.map((space: any) => {
        const owner = ownerMap.get(space.owner_id);
        return {
          ...space,
          owner: owner || null,
          can_join: space.member_count < space.max_members,
        };
      });

      return {
        success: true,
        data: spacesWithOwner,
      };
    } catch (error: any) {
      console.error('[RoomService] Search spaces exception:', error.message);
      return { error: 'Failed to search spaces' };
    }
  }

  /**
   * Join a public space using direct table operations
   */
  static async joinPublicSpace(
    spaceId: string
  ): Promise<ApiResponse<{ channel_id: string }>> {
    try {
      const supabase = getSupabaseClient();
      const { data: user } = await supabase.auth.getUser();

      if (!user.user) {
        return { error: 'Not authenticated' };
      }

      // Check if space exists and is public
      const { data: space, error: spaceError } = await supabase
        .from('spaces')
        .select('id, is_public, max_members, member_count')
        .eq('id', spaceId)
        .single();

      if (spaceError || !space) {
        console.error('[RoomService] Space not found:', spaceError?.message);
        return { error: 'Space not found' };
      }

      if (!space.is_public) {
        return { error: 'Space is not public' };
      }

      if (space.member_count >= space.max_members) {
        return { error: 'Space is at capacity' };
      }

      // Get the channel for this space
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .select('id')
        .eq('space_id', spaceId)
        .single();

      if (channelError || !channel) {
        console.error(
          '[RoomService] Channel not found:',
          channelError?.message
        );
        return { error: 'Channel not found' };
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('channel_id', channel.id)
        .eq('user_id', user.user.id)
        .single();

      if (existingMember) {
        return {
          success: true,
          data: { channel_id: channel.id },
          message: 'Already a member of this space',
        };
      }

      // Add user as member
      const { error: memberError } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channel.id,
          user_id: user.user.id,
          role: 'member',
        });

      if (memberError) {
        console.error('[RoomService] Join space error:', memberError.message);
        return { error: memberError.message };
      }

      return {
        success: true,
        data: { channel_id: channel.id },
        message: 'Successfully joined space',
      };
    } catch (error: any) {
      console.error('[RoomService] Join space exception:', error.message);
      return { error: 'Failed to join space' };
    }
  }

  /**
   * Leave a space using direct table operations
   */
  static async leaveSpace(spaceId: string): Promise<ApiResponse<void>> {
    try {
      const supabase = getSupabaseClient();
      const { data: user } = await supabase.auth.getUser();

      if (!user.user) {
        return { error: 'Not authenticated' };
      }

      // Get channel ID for the space
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .select('id')
        .eq('space_id', spaceId)
        .single();

      if (channelError || !channel) {
        return { error: 'Space not found' };
      }

      // Remove user from channel members
      const { error } = await supabase
        .from('channel_members')
        .delete()
        .eq('channel_id', channel.id)
        .eq('user_id', user.user.id);

      if (error) {
        console.error('[RoomService] Leave space error:', error.message);
        return { error: 'Failed to leave space' };
      }

      return {
        success: true,
        message: 'Successfully left space',
      };
    } catch (error: any) {
      console.error('[RoomService] Leave space exception:', error.message);
      return { error: 'Failed to leave space' };
    }
  }

  /**
   * Get user's spaces (spaces they are members of) using direct table operations
   */
  static async getUserSpaces(): Promise<ApiResponse<ChannelWithSpace[]>> {
    try {
      const supabase = getSupabaseClient();
      const { data: user } = await supabase.auth.getUser();

      if (!user.user) {
        return { error: 'Not authenticated' };
      }

      // Get channels and spaces where user is a member
      const { data, error } = await supabase
        .from('channel_members')
        .select(
          `
          channel_id,
          role,
          last_seen_at,
          channels (
            id,
            space_id,
            name,
            description,
            channel_type,
            is_active,
            created_at,
            spaces (
              id,
              name,
              description,
              tags,
              is_public,
              owner_id,
              max_members,
              member_count,
              created_at,
              updated_at
            )
          )
        `
        )
        .eq('user_id', user.user.id)
        .eq('is_active', true);

      if (error) {
        console.error('[RoomService] Get user spaces error:', error.message);
        return { error: 'Failed to get user spaces' };
      }

      // Transform data to match ChannelWithSpace type
      const spaces: ChannelWithSpace[] = (data || []).map((item: any) => ({
        id: item.channels.id,
        space_id: item.channels.space_id,
        name: item.channels.name,
        description: item.channels.description,
        channel_type: item.channels.channel_type,
        is_active: item.channels.is_active,
        created_at: item.channels.created_at,
        space: item.channels.spaces,
        member_role: item.role,
        has_new: false, // TODO: Calculate based on last_seen_at vs latest message
        unread_count: 0, // TODO: Calculate unread messages
      }));

      return {
        success: true,
        data: spaces,
      };
    } catch (error: any) {
      console.error('[RoomService] Get user spaces exception:', error.message);
      return { error: 'Failed to get user spaces' };
    }
  }

  // =====================================================
  // MESSAGING
  // =====================================================

  /**
   * Send a message to a channel using direct table operations
   */
  static async sendChannelMessage(
    request: SendChannelMessageRequest
  ): Promise<ApiResponse<{ message_id: string }>> {
    try {
      const supabase = getSupabaseClient();
      const { data: user } = await supabase.auth.getUser();

      if (!user.user) {
        return { error: 'Not authenticated' };
      }

      // Validate message content
      const validation = this.validateMessageContent(request.content);
      if (!validation.isValid) {
        return { error: validation.error || 'Invalid message content' };
      }

      // Insert the message with sender_id
      const { data: message, error } = await supabase
        .from('room_messages')
        .insert({
          channel_id: request.channel_id,
          anonymous_room_id: null, // 明示的にNULLを設定
          sender_id: user.user.id,
          message_type: request.message_type || 'text',
          content: request.content,
          attachments: request.attachments || [],
        })
        .select('id')
        .single();

      if (error) {
        console.error(
          '[RoomService] Send channel message error:',
          error.message
        );
        return { error: error.message };
      }

      return {
        success: true,
        data: { message_id: message.id },
        message: 'Message sent successfully',
      };
    } catch (error: any) {
      console.error(
        '[RoomService] Send channel message exception:',
        error.message
      );
      return { error: 'Failed to send message' };
    }
  }

  /**
   * Get channel messages with pagination using direct table operations
   */
  static async getChannelMessages(
    channelId: string,
    params: MessagePaginationParams = {}
  ): Promise<ApiResponse<RoomMessageWithSender[]>> {
    try {
      const supabase = getSupabaseClient();

      let query = supabase
        .from('room_messages')
        .select('*')
        .eq('channel_id', channelId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }); // Latest messages at the end

      // Apply pagination
      if (params.before_message_id) {
        // Get messages before this message ID (for loading older messages)
        const { data: beforeMessage } = await supabase
          .from('room_messages')
          .select('created_at')
          .eq('id', params.before_message_id)
          .single();

        if (beforeMessage) {
          query = query.lt('created_at', beforeMessage.created_at);
        }
      }

      query = query.limit(params.limit || 50);

      const { data: messages, error } = await query;

      if (error) {
        console.error(
          '[RoomService] Get channel messages error:',
          error.message
        );
        return { error: 'Failed to get messages' };
      }

      if (!messages || messages.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // Get unique sender IDs
      const senderIds = Array.from(
        new Set(messages.map(msg => msg.sender_id).filter(Boolean))
      );

      // Fetch sender profiles separately
      const { data: senderProfiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_emoji')
        .in('id', senderIds);

      if (profileError) {
        console.error(
          '[RoomService] Get sender profiles error:',
          profileError.message
        );
        // Continue without sender info rather than failing completely
      }

      // Create a map of sender profiles for easy lookup
      const senderMap = new Map(
        (senderProfiles || []).map(profile => [profile.id, profile])
      );

      // Transform data to include sender information
      const messagesWithSender: RoomMessageWithSender[] = messages.map(
        (msg: any) => {
          const sender = senderMap.get(msg.sender_id);
          return {
            ...msg,
            sender: sender || null,
            sender_username: sender?.username || null,
            sender_display_name: sender?.display_name || null,
            sender_avatar_emoji: sender?.avatar_emoji || null,
          };
        }
      );

      return {
        success: true,
        data: messagesWithSender,
      };
    } catch (error: any) {
      console.error(
        '[RoomService] Get channel messages exception:',
        error.message
      );
      return { error: 'Failed to get messages' };
    }
  }

  /**
   * Mark a channel as seen (update last_seen_at) using direct table operations
   */
  static async markChannelSeen(channelId: string): Promise<ApiResponse<void>> {
    try {
      const supabase = getSupabaseClient();
      const { data: user } = await supabase.auth.getUser();

      if (!user.user) {
        return { error: 'Not authenticated' };
      }

      // Update last_seen_at for this user and channel
      const { error } = await supabase
        .from('channel_members')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('channel_id', channelId)
        .eq('user_id', user.user.id);

      if (error) {
        console.error('[RoomService] Mark channel seen error:', error.message);
        return { error: error.message };
      }

      return {
        success: true,
        message: 'Channel marked as seen',
      };
    } catch (error: any) {
      console.error(
        '[RoomService] Mark channel seen exception:',
        error.message
      );
      return { error: 'Failed to mark channel as seen' };
    }
  }

  /**
   * Get chat list with NEW badge information using direct table operations
   */
  static async getChatListWithNew(): Promise<ApiResponse<ChatListItem[]>> {
    try {
      const supabase = getSupabaseClient();
      const { data: user } = await supabase.auth.getUser();

      if (!user.user) {
        return { error: 'Not authenticated' };
      }

      // Get channels and spaces where user is a member, with latest message info
      const { data, error } = await supabase
        .from('channel_members')
        .select(
          `
          channel_id,
          role,
          last_seen_at,
          channels (
            id,
            space_id,
            name,
            spaces (
              id,
              name,
              is_public
            )
          )
        `
        )
        .eq('user_id', user.user.id)
        .eq('is_active', true);

      if (error) {
        console.error('[RoomService] Get chat list error:', error.message);
        return { error: 'Failed to get chat list' };
      }

      if (!data || data.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // Transform data to ChatListItem format
      const chatList: ChatListItem[] = await Promise.all(
        (data || []).map(async (item: any) => {
          // Get latest message for this channel
          const { data: latestMessage } = await supabase
            .from('room_messages')
            .select('created_at, content, sender_id')
            .eq('channel_id', item.channel_id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Get sender username separately if there's a latest message
          let senderUsername = null;
          if (latestMessage?.sender_id) {
            const { data: senderProfile } = await supabase
              .from('user_profiles')
              .select('username')
              .eq('id', latestMessage.sender_id)
              .single();

            senderUsername = senderProfile?.username || null;
          }

          // Calculate if there are new messages
          const hasNew =
            latestMessage &&
            new Date(latestMessage.created_at) > new Date(item.last_seen_at);

          return {
            channel_id: item.channels.id,
            space_id: item.channels.spaces.id,
            space_name: item.channels.spaces.name,
            space_is_public: item.channels.spaces.is_public,
            channel_name: item.channels.name,
            member_role: item.role,
            last_seen_at: item.last_seen_at,
            latest_message_at: latestMessage?.created_at || null,
            latest_message_content: latestMessage?.content || null,
            latest_message_sender_id: latestMessage?.sender_id || null,
            latest_message_sender_username: senderUsername,
            has_new: hasNew || false,
            unread_count: 0, // TODO: Calculate actual unread count
          };
        })
      );

      return {
        success: true,
        data: chatList,
      };
    } catch (error: any) {
      console.error('[RoomService] Get chat list exception:', error.message);
      return { error: 'Failed to get chat list' };
    }
  }

  // =====================================================
  // ANONYMOUS ROOMS
  // =====================================================

  /**
   * Get or create current anonymous room using direct table operations
   */
  static async getCurrentAnonymousRoom(): Promise<ApiResponse<AnonymousRoom>> {
    try {
      const currentSlotId = getCurrentAnonymousSlotId();
      const supabase = getSupabaseClient();

      // Try to get existing slot
      let { data: slot, error } = await supabase
        .from('anonymous_slots')
        .select('*')
        .eq('id', currentSlotId)
        .single();

      // If slot doesn't exist, create it
      if (error && error.code === 'PGRST116') {
        // No rows found
        const now = new Date();
        const closedAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

        const { data: newSlot, error: createError } = await supabase
          .from('anonymous_slots')
          .insert({
            id: currentSlotId,
            opened_at: now.toISOString(),
            closed_at: closedAt.toISOString(),
          })
          .select('*')
          .single();

        if (createError) {
          console.error(
            '[RoomService] Create anonymous slot error:',
            createError.message
          );
          return { error: 'Failed to create anonymous room' };
        }

        slot = newSlot;
      } else if (error) {
        console.error('[RoomService] Get anonymous slot error:', error.message);
        return { error: 'Failed to get anonymous room' };
      }

      return {
        success: true,
        data: {
          room_id: slot!.id,
          ephemeral_name: 'Anonymous Chat',
          expires_at: slot!.closed_at,
        },
      };
    } catch (error: any) {
      console.error(
        '[RoomService] Get anonymous room exception:',
        error.message
      );
      return { error: 'Failed to get anonymous room' };
    }
  }

  /**
   * Send a message to anonymous room using direct table operations
   */
  static async sendAnonymousMessage(
    request: SendAnonymousMessageRequest
  ): Promise<ApiResponse<{ message_id: string }>> {
    try {
      const supabase = getSupabaseClient();
      const { data: user } = await supabase.auth.getUser();

      if (!user.user) {
        return { error: 'Not authenticated' };
      }

      // Validate message content
      const validation = this.validateMessageContent(request.content);
      if (!validation.isValid) {
        return { error: validation.error || 'Invalid message content' };
      }

      // Insert anonymous message with expiry
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      const { data: message, error } = await supabase
        .from('room_messages')
        .insert({
          channel_id: null, // 明示的にNULLを設定
          anonymous_room_id: request.room_id,
          sender_id: user.user.id,
          display_name: request.display_name,
          message_type: 'text',
          content: request.content,
          expires_at: expiresAt.toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error(
          '[RoomService] Send anonymous message error:',
          error.message
        );
        return { error: error.message };
      }

      return {
        success: true,
        data: { message_id: message.id },
        message: 'Message sent successfully',
      };
    } catch (error: any) {
      console.error(
        '[RoomService] Send anonymous message exception:',
        error.message
      );
      return { error: 'Failed to send anonymous message' };
    }
  }

  /**
   * Get anonymous room messages using direct table operations
   */
  static async getAnonymousMessages(
    roomId: string
  ): Promise<ApiResponse<AnonymousMessage[]>> {
    try {
      const supabase = getSupabaseClient();

      // Get messages for this anonymous room that haven't expired
      const { data, error } = await supabase
        .from('room_messages')
        .select(
          'id, display_name, content, created_at, is_masked, report_count'
        )
        .eq('anonymous_room_id', roomId)
        .is('deleted_at', null)
        .gt('expires_at', new Date().toISOString()) // Only non-expired messages
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) {
        console.error(
          '[RoomService] Get anonymous messages error:',
          error.message
        );
        return { error: 'Failed to get messages' };
      }

      // Transform to AnonymousMessage format
      const messages: AnonymousMessage[] = (data || []).map((msg: any) => ({
        id: msg.id,
        display_name: msg.display_name || 'Anonymous',
        content: msg.content,
        created_at: msg.created_at,
        is_masked: msg.is_masked,
        report_count: msg.report_count,
      }));

      return {
        success: true,
        data: messages,
      };
    } catch (error: any) {
      console.error(
        '[RoomService] Get anonymous messages exception:',
        error.message
      );
      return { error: 'Failed to get messages' };
    }
  }

  // =====================================================
  // MODERATION
  // =====================================================

  /**
   * Report a message
   */
  static async reportMessage(
    request: ReportMessageRequest
  ): Promise<ApiResponse<void>> {
    try {
      const { data, error } = await getSupabaseClient().rpc('report_message', {
        p_message_id: request.message_id,
        p_reason: request.reason,
        p_description: request.description || null,
      });

      if (error) {
        console.error('[RoomService] Report message error:', error.message);
        return { error: error.message };
      }

      if (data?.error) {
        return { error: data.error };
      }

      return {
        success: true,
        message: data.message || 'Message reported successfully',
      };
    } catch (error: any) {
      console.error('[RoomService] Report message exception:', error.message);
      return { error: 'Failed to report message' };
    }
  }

  // =====================================================
  // SUBSCRIPTION MANAGEMENT - REMOVED
  // All users can now create spaces and use all features
  // =====================================================

  /**
   * Check if user can create spaces - now always returns true
   */
  static async canCreateSpaces(): Promise<boolean> {
    return true; // All users can create spaces now
  }

  // =====================================================
  // REALTIME HELPERS
  // =====================================================

  /**
   * Get realtime channel names for user's subscriptions
   */
  static async getRealtimeChannels(): Promise<
    ApiResponse<{ channel_name: string; channel_type: string }[]>
  > {
    try {
      const { data, error } = await getSupabaseClient().rpc(
        'get_user_realtime_channels'
      );

      if (error) {
        console.error(
          '[RoomService] Get realtime channels error:',
          error.message
        );
        return { error: 'Failed to get realtime channels' };
      }

      return {
        success: true,
        data: data || [],
      };
    } catch (error: any) {
      console.error(
        '[RoomService] Get realtime channels exception:',
        error.message
      );
      return { error: 'Failed to get realtime channels' };
    }
  }

  /**
   * Check if user can subscribe to a channel
   */
  static async canSubscribeToChannel(channelId: string): Promise<boolean> {
    try {
      const { data, error } = await getSupabaseClient().rpc(
        'can_subscribe_to_channel',
        {
          p_channel_id: channelId,
        }
      );

      if (error) {
        console.error(
          '[RoomService] Check subscription permission error:',
          error.message
        );
        return false;
      }

      return data === true;
    } catch (error: any) {
      console.error(
        '[RoomService] Check subscription permission exception:',
        error.message
      );
      return false;
    }
  }

  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================

  /**
   * Get current anonymous slot ID
   */
  static getCurrentAnonymousSlotId(): string {
    return getCurrentAnonymousSlotId();
  }

  /**
   * Validate message content
   */
  static validateMessageContent(content: string): {
    isValid: boolean;
    error?: string;
  } {
    if (!content || content.trim().length === 0) {
      return { isValid: false, error: 'Message cannot be empty' };
    }

    if (content.length > 2000) {
      return {
        isValid: false,
        error: 'Message too long (max 2000 characters)',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate space name
   */
  static validateSpaceName(name: string): { isValid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { isValid: false, error: 'Space name cannot be empty' };
    }

    if (name.length > 100) {
      return {
        isValid: false,
        error: 'Space name too long (max 100 characters)',
      };
    }

    return { isValid: true };
  }
}

// Export singleton instance
export const roomService = RoomService;
