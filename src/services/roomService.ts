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
  Subscription,
  ApiResponse,
  MessagePaginationParams,
  PaginatedMessages,
  sanitizeRoomMessageForLogging,
  sanitizeSpaceForLogging,
  getCurrentAnonymousSlotId
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
   * Create a new space
   */
  static async createSpace(request: CreateSpaceRequest): Promise<ApiResponse<{ space_id: string; channel_id: string }>> {
    try {
      const { data, error } = await getSupabaseClient().rpc('create_space', {
        p_name: request.name,
        p_description: request.description || null,
        p_tags: request.tags || [],
        p_is_public: request.is_public ?? true,
        p_max_members: request.max_members || null
      });

      if (error) {
        console.error('[RoomService] Create space error:', error.message);
        return { error: error.message };
      }

      if (data?.error) {
        return { error: data.error };
      }

      return {
        success: true,
        data: {
          space_id: data.space_id,
          channel_id: data.channel_id
        },
        message: data.message || 'Space created successfully'
      };

    } catch (error: any) {
      console.error('[RoomService] Create space exception:', error.message);
      return { error: 'Failed to create space' };
    }
  }

  /**
   * Search public spaces
   */
  static async searchPublicSpaces(params: SpaceSearchParams = {}): Promise<ApiResponse<SpaceWithOwner[]>> {
    try {
      const { data, error } = await getSupabaseClient().rpc('search_public_spaces', {
        p_query: params.query || null,
        p_tags: params.tags || null,
        p_limit: params.limit || 20,
        p_offset: params.offset || 0
      });

      if (error) {
        console.error('[RoomService] Search spaces error:', error.message);
        return { error: 'Failed to search spaces' };
      }

      return {
        success: true,
        data: data || []
      };

    } catch (error: any) {
      console.error('[RoomService] Search spaces exception:', error.message);
      return { error: 'Failed to search spaces' };
    }
  }

  /**
   * Join a public space
   */
  static async joinPublicSpace(spaceId: string): Promise<ApiResponse<{ channel_id: string }>> {
    try {
      const { data, error } = await getSupabaseClient().rpc('join_public_space', {
        p_space_id: spaceId
      });

      if (error) {
        console.error('[RoomService] Join space error:', error.message);
        return { error: error.message };
      }

      if (data?.error) {
        return { error: data.error };
      }

      return {
        success: true,
        data: { channel_id: data.channel_id },
        message: data.message || 'Successfully joined space'
      };

    } catch (error: any) {
      console.error('[RoomService] Join space exception:', error.message);
      return { error: 'Failed to join space' };
    }
  }

  /**
   * Leave a space
   */
  static async leaveSpace(spaceId: string): Promise<ApiResponse<void>> {
    try {
      // Get channel ID for the space
      const { data: channels, error: channelError } = await supabase
        .from('channels')
        .select('id')
        .eq('space_id', spaceId)
        .single();

      if (channelError || !channels) {
        return { error: 'Space not found' };
      }

      // Remove user from channel members
      const { error } = await getSupabaseClient()
        .from('channel_members')
        .delete()
        .eq('channel_id', channels.id)
        .eq('user_id', (await getSupabaseClient().auth.getUser()).data.user?.id);

      if (error) {
        console.error('[RoomService] Leave space error:', error.message);
        return { error: 'Failed to leave space' };
      }

      return {
        success: true,
        message: 'Successfully left space'
      };

    } catch (error: any) {
      console.error('[RoomService] Leave space exception:', error.message);
      return { error: 'Failed to leave space' };
    }
  }

  /**
   * Get user's spaces (spaces they are members of)
   */
  static async getUserSpaces(): Promise<ApiResponse<ChannelWithSpace[]>> {
    try {
      const { data, error } = await getSupabaseClient().rpc('get_chat_list_with_new');

      if (error) {
        console.error('[RoomService] Get user spaces error:', error.message);
        return { error: 'Failed to get user spaces' };
      }

      // Transform data to match ChannelWithSpace type
      const spaces: ChannelWithSpace[] = (data || []).map((item: ChatListItem) => ({
        id: item.channel_id,
        space_id: item.space_id,
        name: item.channel_name,
        description: null,
        channel_type: 'text' as const,
        is_active: true,
        created_at: '', // Not needed for this view
        space: {
          id: item.space_id,
          name: item.space_name,
          description: null,
          tags: [],
          is_public: item.space_is_public,
          owner_id: '',
          max_members: 0,
          member_count: 0,
          created_at: '',
          updated_at: ''
        },
        member_role: item.member_role,
        has_new: item.has_new,
        unread_count: item.unread_count
      }));

      return {
        success: true,
        data: spaces
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
   * Send a message to a channel
   */
  static async sendChannelMessage(request: SendChannelMessageRequest): Promise<ApiResponse<{ message_id: string }>> {
    try {
      const { data, error } = await getSupabaseClient().rpc('send_channel_message', {
        p_channel_id: request.channel_id,
        p_content: request.content,
        p_message_type: request.message_type || 'text',
        p_attachments: request.attachments || []
      });

      if (error) {
        console.error('[RoomService] Send channel message error:', error.message);
        return { error: error.message };
      }

      if (data?.error) {
        return { error: data.error };
      }

      return {
        success: true,
        data: { message_id: data.message_id },
        message: data.message || 'Message sent successfully'
      };

    } catch (error: any) {
      console.error('[RoomService] Send channel message exception:', error.message);
      return { error: 'Failed to send message' };
    }
  }

  /**
   * Get channel messages with pagination
   */
  static async getChannelMessages(
    channelId: string, 
    params: MessagePaginationParams = {}
  ): Promise<ApiResponse<RoomMessageWithSender[]>> {
    try {
      const { data, error } = await getSupabaseClient().rpc('get_channel_messages', {
        p_channel_id: channelId,
        p_limit: params.limit || 50,
        p_before_message_id: params.before_message_id || null
      });

      if (error) {
        console.error('[RoomService] Get channel messages error:', error.message);
        return { error: 'Failed to get messages' };
      }

      return {
        success: true,
        data: data || []
      };

    } catch (error: any) {
      console.error('[RoomService] Get channel messages exception:', error.message);
      return { error: 'Failed to get messages' };
    }
  }

  /**
   * Mark a channel as seen (update last_seen_at)
   */
  static async markChannelSeen(channelId: string): Promise<ApiResponse<void>> {
    try {
      const { data, error } = await getSupabaseClient().rpc('mark_seen', {
        p_channel_id: channelId
      });

      if (error) {
        console.error('[RoomService] Mark channel seen error:', error.message);
        return { error: error.message };
      }

      if (data?.error) {
        return { error: data.error };
      }

      return {
        success: true,
        message: data.message || 'Channel marked as seen'
      };

    } catch (error: any) {
      console.error('[RoomService] Mark channel seen exception:', error.message);
      return { error: 'Failed to mark channel as seen' };
    }
  }

  /**
   * Get chat list with NEW badge information
   */
  static async getChatListWithNew(): Promise<ApiResponse<ChatListItem[]>> {
    try {
      const { data, error } = await getSupabaseClient().rpc('get_chat_list_with_new');

      if (error) {
        console.error('[RoomService] Get chat list error:', error.message);
        // If function doesn't exist, return empty array
        if (error.message.includes('could not find') || error.message.includes('does not exist')) {
          return {
            success: true,
            data: []
          };
        }
        return { error: 'Failed to get chat list' };
      }

      return {
        success: true,
        data: data || []
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
   * Get or create current anonymous room
   */
  static async getCurrentAnonymousRoom(): Promise<ApiResponse<AnonymousRoom>> {
    try {
      const { data, error } = await getSupabaseClient().rpc('get_or_create_current_anon_room');

      if (error) {
        console.error('[RoomService] Get anonymous room error:', error.message);
        // If function doesn't exist, return default anonymous room
        if (error.message.includes('could not find') || error.message.includes('does not exist')) {
          const currentSlot = 'anon_' + new Date().toISOString().slice(0, 13).replace(/[-:T]/g, '_');
          return {
            success: true,
            data: {
              id: currentSlot,
              opened_at: new Date().toISOString(),
              closed_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              participant_count: 0,
              message_count: 0,
              created_at: new Date().toISOString()
            }
          };
        }
        return { error: error.message };
      }

      if (data?.error) {
        return { error: data.error };
      }

      return {
        success: true,
        data: {
          room_id: data.room_id,
          ephemeral_name: data.ephemeral_name,
          expires_at: data.expires_at
        }
      };

    } catch (error: any) {
      console.error('[RoomService] Get anonymous room exception:', error.message);
      return { error: 'Failed to get anonymous room' };
    }
  }

  /**
   * Send a message to anonymous room
   */
  static async sendAnonymousMessage(request: SendAnonymousMessageRequest): Promise<ApiResponse<{ message_id: string }>> {
    try {
      const { data, error } = await getSupabaseClient().rpc('send_anonymous_message', {
        p_room_id: request.room_id,
        p_content: request.content,
        p_display_name: request.display_name
      });

      if (error) {
        console.error('[RoomService] Send anonymous message error:', error.message);
        return { error: error.message };
      }

      if (data?.error) {
        return data; // Return the error response as-is (includes retry_after_seconds for rate limiting)
      }

      return {
        success: true,
        data: { message_id: data.message_id },
        message: data.message || 'Message sent successfully'
      };

    } catch (error: any) {
      console.error('[RoomService] Send anonymous message exception:', error.message);
      return { error: 'Failed to send anonymous message' };
    }
  }

  /**
   * Get anonymous room messages
   */
  static async getAnonymousMessages(roomId: string): Promise<ApiResponse<AnonymousMessage[]>> {
    try {
      const { data, error } = await getSupabaseClient().rpc('get_anonymous_messages', {
        p_room_id: roomId,
        p_limit: 50
      });

      if (error) {
        console.error('[RoomService] Get anonymous messages error:', error.message);
        return { error: 'Failed to get messages' };
      }

      return {
        success: true,
        data: data || []
      };

    } catch (error: any) {
      console.error('[RoomService] Get anonymous messages exception:', error.message);
      return { error: 'Failed to get messages' };
    }
  }

  // =====================================================
  // MODERATION
  // =====================================================

  /**
   * Report a message
   */
  static async reportMessage(request: ReportMessageRequest): Promise<ApiResponse<void>> {
    try {
      const { data, error } = await getSupabaseClient().rpc('report_message', {
        p_message_id: request.message_id,
        p_reason: request.reason,
        p_description: request.description || null
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
        message: data.message || 'Message reported successfully'
      };

    } catch (error: any) {
      console.error('[RoomService] Report message exception:', error.message);
      return { error: 'Failed to report message' };
    }
  }

  // =====================================================
  // SUBSCRIPTION MANAGEMENT
  // =====================================================

  /**
   * Get user's subscription info
   */
  static async getUserSubscription(): Promise<ApiResponse<Subscription | null>> {
    try {
      const { data: user } = await getSupabaseClient().auth.getUser();
      if (!user.user) {
        return { error: 'Not authenticated' };
      }

      const { data, error } = await getSupabaseClient()
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('[RoomService] Get subscription error:', error.message);
        // If table doesn't exist, return default free subscription
        if (error.message.includes('could not find') || error.message.includes('does not exist')) {
          return {
            success: true,
            data: {
              user_id: user.user.id,
              plan: 'free',
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          };
        }
        return { error: 'Failed to get subscription' };
      }

      return {
        success: true,
        data: data || null
      };

    } catch (error: any) {
      console.error('[RoomService] Get subscription exception:', error.message);
      return { error: 'Failed to get subscription' };
    }
  }

  /**
   * Check if user can create spaces
   */
  static async canCreateSpaces(): Promise<boolean> {
    try {
      const response = await this.getUserSubscription();
      if (!response.success || !response.data) {
        return false; // Free users or error
      }

      const subscription = response.data;
      return subscription.plan !== 'free' && 
             subscription.status === 'active' && 
             new Date(subscription.current_period_end) > new Date();

    } catch (error: any) {
      console.error('[RoomService] Check can create spaces exception:', error.message);
      return false;
    }
  }

  // =====================================================
  // REALTIME HELPERS
  // =====================================================

  /**
   * Get realtime channel names for user's subscriptions
   */
  static async getRealtimeChannels(): Promise<ApiResponse<{ channel_name: string; channel_type: string }[]>> {
    try {
      const { data, error } = await getSupabaseClient().rpc('get_user_realtime_channels');

      if (error) {
        console.error('[RoomService] Get realtime channels error:', error.message);
        return { error: 'Failed to get realtime channels' };
      }

      return {
        success: true,
        data: data || []
      };

    } catch (error: any) {
      console.error('[RoomService] Get realtime channels exception:', error.message);
      return { error: 'Failed to get realtime channels' };
    }
  }

  /**
   * Check if user can subscribe to a channel
   */
  static async canSubscribeToChannel(channelId: string): Promise<boolean> {
    try {
      const { data, error } = await getSupabaseClient().rpc('can_subscribe_to_channel', {
        p_channel_id: channelId
      });

      if (error) {
        console.error('[RoomService] Check subscription permission error:', error.message);
        return false;
      }

      return data === true;

    } catch (error: any) {
      console.error('[RoomService] Check subscription permission exception:', error.message);
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
  static validateMessageContent(content: string): { isValid: boolean; error?: string } {
    if (!content || content.trim().length === 0) {
      return { isValid: false, error: 'Message cannot be empty' };
    }

    if (content.length > 2000) {
      return { isValid: false, error: 'Message too long (max 2000 characters)' };
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
      return { isValid: false, error: 'Space name too long (max 100 characters)' };
    }

    return { isValid: true };
  }
}

// Export singleton instance
export const roomService = RoomService;