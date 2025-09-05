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

import { getSupabaseClient } from './supabaseClient';

/**
 * Room Service Class
 * Handles all room-related API operations
 */
export class RoomService {
  /**
   * Normalize unknown error into readable string
   */
  static normalizeError(error: unknown, fallback = 'Unexpected error'): string {
    if (!error) {
      return fallback;
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }
  // =====================================================
  // SPACE MANAGEMENT
  // =====================================================

  /**
   * Create a new space and its default channel.
   * - Uses SECURITY DEFINER RPC `create_space` on DB side
   * - DB側で `ensure_default_channel_if_missing` を呼び、default channel と owner membership を最終保証
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

      // Use SECURITY DEFINER RPC to create space + default channel atomically
      const { data, error } = await supabase.rpc('create_space', {
        p_name: request.name,
        p_description: request.description ?? null,
        p_tags: request.tags ?? [],
        p_is_public: request.is_public ?? true,
        p_max_members: request.max_members ?? null,
      });

      if (error) {
        console.error('[RoomService] Create space error:', error.message);
        return { error: error.message };
      }

      if (!data || data.error) {
        const errMsg = data?.error || 'Failed to create space';
        console.error('[RoomService] Create space error:', errMsg);
        return { error: errMsg };
      }

      const spaceId = data.space_id as string;
      let channelId = data.channel_id as string | null;

      // Fallback: ensure a default channel exists even if RPC returned null channel_id (edge cases)
      if (!channelId) {
        // Server-side ensure via RPC (owner only)
        const ensured = await supabase.rpc(
          'ensure_default_channel_if_missing',
          { p_space_id: spaceId },
        );
        if (!ensured.error && ensured.data) {
          channelId = String(ensured.data);
        } else {
          // Fallback: Try to find an existing channel then
          const found = await supabase
            .from('channels')
            .select('id')
            .eq('space_id', spaceId)
            .limit(1)
            .maybeSingle();
          if (found.data?.id) {
            channelId = found.data.id;
          }
        }
      }

      return {
        success: true,
        data: { space_id: spaceId, channel_id: channelId || '' },
        message: data.message || 'Space created successfully',
      };
    } catch (error: unknown) {
      const msg = RoomService.normalizeError(error, 'Failed to create space');
      console.error('[RoomService] Create space exception:', msg);
      return { error: msg };
    }
  }

  /**
   * Get channel members with attached user profiles.
   * Sort order: owner -> moderator -> member, then by display/username
   */
  static async getChannelMembers(
    channelId: string
  ): Promise<ApiResponse<ChannelMemberWithUser[]>> {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('channel_members')
        .select(
          `channel_id, user_id, role, last_seen_at, joined_at, is_active,
           user:user_profiles (id, username, display_name, avatar_emoji, avatar_url)`
        )
        .eq('channel_id', channelId);

      if (error) {
        console.error(
          '[RoomService] Get channel members error:',
          error.message,
        );
        return { error: 'Failed to get channel members' };
      }

      const members: ChannelMemberWithUser[] = (data || []).map(
        (m: {
          channel_id: string;
          user_id: string;
          role: 'owner' | 'moderator' | 'member';
          last_seen_at: string;
          joined_at: string;
          is_active: boolean;
          user: PublicUserProfile;
        }) => ({
          channel_id: m.channel_id,
          user_id: m.user_id,
          role: m.role,
          last_seen_at: m.last_seen_at,
          joined_at: m.joined_at,
          is_active: m.is_active,
          user: m.user,
        }),
      );

      // Sort: owner -> moderator -> member, then by display_name/username
      const roleOrder: Record<string, number> = {
        owner: 0,
        moderator: 1,
        member: 2,
      };
      members.sort((a, b) => {
        const r = (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
        if (r !== 0) {
          return r;
        }
        const an = a.user?.display_name || a.user?.username || '';
        const bn = b.user?.display_name || b.user?.username || '';
        return an.localeCompare(bn);
      });

      return { success: true, data: members };
    } catch (error: unknown) {
      const msg = RoomService.normalizeError(
        error,
        'Failed to get channel members',
      );
      console.error('[RoomService] Get channel members exception:', msg);
      return { error: msg };
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

      // Compute member counts from channel_members to avoid stale counts on spaces
      const spaceIds = (spaces as Space[]).map(s => s.id);
      const channelMap = new Map<string, string>(); // space_id -> channel_id
      const memberCountMap = new Map<string, number>(); // channel_id -> count

      // Fetch channels for spaces
      if (spaceIds.length) {
        const { data: channels } = await supabase
          .from('channels')
          .select('id, space_id')
          .in('space_id', spaceIds);
        (channels || []).forEach((c: { id: string; space_id: string }) =>
          channelMap.set(c.space_id, c.id),
        );

        const channelIds = (channels || []).map((c: { id: string }) => c.id);
        if (channelIds.length) {
          // Fetch members for these channels and count on client side
          const { data: members } = await supabase
            .from('channel_members')
            .select('channel_id')
            .in('channel_id', channelIds);
          (members || []).forEach((m: { channel_id: string }) => {
            const cur = memberCountMap.get(m.channel_id) || 0;
            memberCountMap.set(m.channel_id, cur + 1);
          });
        }
      }

      // Transform data to include can_join flag, owner information, and accurate member_count
      const spacesWithOwner: SpaceWithOwner[] = (spaces as Space[]).map(
        space => {
          const owner = ownerMap.get(space.owner_id);
          const channelId = channelMap.get(space.id);
          const computedCount = channelId
            ? memberCountMap.get(channelId) || 0
            : space.member_count || 0;
          const maxMembers = space.max_members ?? 500;
          return {
            ...space,
            member_count: computedCount,
            max_members: maxMembers,
            owner: owner || null,
            can_join: computedCount < maxMembers,
          } as SpaceWithOwner;
        },
      );

      return {
        success: true,
        data: spacesWithOwner,
      };
    } catch (error: unknown) {
      const msg = RoomService.normalizeError(error, 'Failed to search spaces');
      console.error('[RoomService] Search spaces exception:', msg);
      return { error: msg };
    }
  }

  /**
   * Join a public space.
   * - Ensures default channel exists (RPC)
   * - Adds current user to channel_members (role: member)
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
      const { data: channelRow, error: channelError } = await supabase
        .from('channels')
        .select('id')
        .eq('space_id', spaceId)
        .limit(1)
        .maybeSingle();

      if (channelError) {
        console.error('[RoomService] Get channel error:', channelError.message);
      }

      let channel: { id: string } | null = channelRow
        ? { id: channelRow.id }
        : null;

      if (!channel) {
        // Ensure default channel exists (owner only RPC, but safe if caller is not owner; it just errors silently here)
        const ensured = await supabase.rpc(
          'ensure_default_channel_if_missing',
          { p_space_id: spaceId },
        );
        if (!ensured.error && ensured.data) {
          channel = { id: ensured.data as string };
        } else {
          // Try again to find channel (maybe created by someone else)
          const found = await supabase
            .from('channels')
            .select('id')
            .eq('space_id', spaceId)
            .limit(1)
            .maybeSingle();
          if (found.data?.id) {
            channel = { id: found.data.id };
          }
        }
      }

      if (!channel) {
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
    } catch (error: unknown) {
      const msg = RoomService.normalizeError(error, 'Failed to join space');
      console.error('[RoomService] Join space exception:', msg);
      return { error: msg };
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

      // Get channel ID for the space (channels may be disabled)
      const { data: channel } = await supabase
        .from('channels')
        .select('id')
        .eq('space_id', spaceId)
        .limit(1)
        .maybeSingle();

      if (!channel) {
        // Channels disabled: remove membership from space_members if exists
        const { error: delErr } = await supabase
          .from('space_members')
          .delete()
          .eq('space_id', spaceId)
          .eq('user_id', user.user.id);
        if (delErr) {
          console.error(
            '[RoomService] Leave space (space_members) error:',
            delErr.message,
          );
          return { error: 'Failed to leave space' };
        }
        return { success: true, message: 'Left space' };
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
    } catch (error: unknown) {
      const msg = RoomService.normalizeError(error, 'Failed to leave space');
      console.error('[RoomService] Leave space exception:', msg);
      return { error: msg };
    }
  }

  /**
   * Get user's joined channels with their parent spaces.
   * Returns list suitable for chat list and room navigation.
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
      const spaces: ChannelWithSpace[] = (data || []).map(
        (item: {
          channel_id: string;
          role: 'owner' | 'moderator' | 'member';
          last_seen_at: string;
          channels: {
            id: string;
            space_id: string;
            name: string;
            description: string | null;
            channel_type: 'text' | 'voice' | 'announcement';
            is_active: boolean;
            created_at: string;
            spaces: Space;
          };
        }) => ({
          id: item.channels.id,
          space_id: item.channels.space_id,
          name: item.channels.name,
          description: item.channels.description,
          channel_type: item.channels.channel_type,
          is_active: item.channels.is_active,
          created_at: item.channels.created_at,
          space: item.channels.spaces,
          member_role: item.role,
          has_new: false, // TODO
          unread_count: 0, // TODO
        }),
      );

      return {
        success: true,
        data: spaces,
      };
    } catch (error: any) {
      console.error('[RoomService] Get user spaces exception:', error.message);
      return { error: 'Failed to get user spaces' };
    }
  }

  /**
   * Delete a space (owner only). Cascades will remove channels, members, messages.
   */
  static async deleteSpace(spaceId: string): Promise<ApiResponse<void>> {
    try {
      const supabase = getSupabaseClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return { error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('spaces')
        .delete()
        .eq('id', spaceId)
        .eq('owner_id', user.user.id);
      if (error) {
        console.error('[RoomService] Delete space error:', error.message);
        return { error: 'Failed to delete space' };
      }
      return { success: true };
    } catch (e: any) {
      console.error('[RoomService] Delete space exception:', e.message);
      return { error: 'Failed to delete space' };
    }
  }

  private static async getSpacesFromMembershipOrOwned(): Promise<
    ApiResponse<ChannelWithSpace[]>
  > {
    try {
      const supabase = getSupabaseClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return { error: 'Not authenticated' };
      }

      // Owned spaces
      const { data: owned } = await supabase
        .from('spaces')
        .select('*')
        .eq('owner_id', user.user.id);

      // space_members memberships
      const { data: sm } = await supabase
        .from('space_members')
        .select('space_id')
        .eq('user_id', user.user.id)
        .eq('is_active', true);

      let memberSpaces: Space[] = [];
      if (sm && sm.length > 0) {
        const ids = sm.map((r: { space_id: string }) => r.space_id);
        const { data: spaces } = await supabase
          .from('spaces')
          .select('*')
          .in('id', ids);
        memberSpaces = (spaces as Space[]) || [];
      }

      const combine: Space[] = [...(owned || []), ...memberSpaces] as Space[];
      const unique = new Map<string, Space>();
      for (const s of combine) {
        unique.set(s.id, s);
      }

      const result: ChannelWithSpace[] = Array.from(unique.values()).map(
        (s: Space) => ({
          // Channel is disabled; return placeholder channel object
          id: '',
          space_id: s.id,
          name: 'general',
          description: null,
          channel_type: 'text',
          is_active: true,
          created_at: s.created_at,
          space: s,
          member_role: s.owner_id === user.user.id ? 'owner' : 'member',
          has_new: false,
          unread_count: 0,
        })
      );

      return { success: true, data: result };
    } catch (e: any) {
      console.error('[RoomService] Fallback user spaces error:', e.message);
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

      // Validate message content or attachments
      if (!request.content || request.content.trim().length === 0) {
        if (!request.attachments || request.attachments.length === 0) {
          return { error: 'Invalid message content' };
        }
      } else {
        const validation = this.validateMessageContent(request.content);
        if (!validation.isValid) {
          return { error: validation.error || 'Invalid message content' };
        }
      }

      // Prepare content: ensure non-empty when attachments exist to satisfy DB constraint
      const sanitized = request.content
        ? RoomService.sanitizeContent(request.content)
        : '';
      const contentToInsert =
        sanitized && sanitized.length > 0
          ? sanitized
          : request.attachments && request.attachments.length > 0
            ? '[image]'
            : '';

      // Insert the message with sender_id
      const { data: message, error } = await supabase
        .from('room_messages')
        .insert({
          channel_id: request.channel_id,
          anonymous_room_id: null, // 明示的にNULLを設定
          sender_id: user.user.id,
          message_type: request.message_type || 'text',
          content: contentToInsert,
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
    } catch (error: unknown) {
      const msg = this.normalizeError(error, 'Failed to send message');
      console.error('[RoomService] Send channel message exception:', msg);
      return { error: msg };
    }
  }

  /**
   * Soft delete a channel message (own message only)
   */
  static async deleteChannelMessage(
    messageId: string,
  ): Promise<ApiResponse<boolean>> {
    try {
      const supabase = getSupabaseClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return { error: 'Not authenticated' };
      }
      // Try hard delete first (preferred if RLS allows deleting own rows)
      const del = await supabase
        .from('room_messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user.user.id)
        .select('id');

      if (del.error) {
        // Fallback to soft delete with placeholder content to satisfy constraints
        const upd = await supabase
          .from('room_messages')
          .update({
            deleted_at: new Date().toISOString(),
            content: 'このメッセージは削除されました',
            attachments: [],
          })
          .eq('id', messageId)
          .eq('sender_id', user.user.id)
          .is('deleted_at', null);

        if (upd.error) {
          console.error(
            '[RoomService] Delete message error:',
            upd.error.message,
          );
          return { error: 'Failed to delete message' };
        }
      }

      return { success: true, data: true };
    } catch (error: unknown) {
      const msg = this.normalizeError(error, 'Failed to delete message');
      console.error('[RoomService] Delete message exception:', msg);
      return { error: msg };
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
        .select('id, username, display_name, avatar_emoji, avatar_url')
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
    } catch (error: unknown) {
      const msg = this.normalizeError(error, 'Failed to get messages');
      console.error('[RoomService] Get channel messages exception:', msg);
      return { error: msg };
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
   * Get chat list with NEW badges computed on DB side.
   * - Uses SECURITY DEFINER RPC `get_chat_list_with_new`
   */
  static async getChatListWithNew(): Promise<ApiResponse<ChatListItem[]>> {
    try {
      const supabase = getSupabaseClient();
      const { data: user } = await supabase.auth.getUser();

      if (!user.user) {
        return { error: 'Not authenticated' };
      }

      // Use SECURITY DEFINER RPC to avoid N+1 queries and compute NEW flags in SQL
      const { data, error } = await supabase.rpc('get_chat_list_with_new', {
        p_limit: 50,
      });
      if (error) {
        console.error('[RoomService] Get chat list error:', error.message);
        return { error: 'Failed to get chat list' };
      }

      return { success: true, data: (data as ChatListItem[]) || [] };
    } catch (error: unknown) {
      const msg = this.normalizeError(error, 'Failed to get chat list');
      console.error('[RoomService] Get chat list exception:', msg);
      return { error: msg };
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
      const supabase = getSupabaseClient();
      // 明示的に認証チェック（未認証ならRPCも失敗するため）
      const { data: authInfo } = await supabase.auth.getUser();
      if (!authInfo?.user) {
        return { error: 'Not authenticated' };
      }

      // 1) Try SECURITY DEFINER RPC first (preferred)
      // Some Supabase setups require an explicit empty params object
      const rpc = await supabase.rpc(
        'get_or_create_current_anon_room',
        {} as any,
      );

      if (!rpc.error && rpc.data && !rpc.data.error) {
        return {
          success: true,
          data: {
            room_id: rpc.data.room_id,
            ephemeral_name: rpc.data.ephemeral_name,
            expires_at: rpc.data.expires_at,
          },
        };
      }

      // 明示的にRPCがエラーJSONを返している場合（認証エラーなど）
      if (!rpc.error && rpc.data?.error) {
        const msg =
          typeof rpc.data.error === 'string'
            ? rpc.data.error
            : 'Failed to get anonymous room';
        console.error('[RoomService] Get anonymous room error:', msg);
        return { error: msg };
      }

      // 2) Fallback: if RPC is missing (schema cache / function not found),
      // compute slot locally and avoid direct INSERT to satisfy RLS.
      const likelyMissing =
        rpc.error?.message?.includes('schema cache') ||
        rpc.error?.message?.includes('function') ||
        rpc.error?.message?.includes('not found');

      if (likelyMissing) {
        const slotId = getCurrentAnonymousSlotId();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

        // Best-effort: attempt to SELECT existing slot (RLS allows SELECT)
        // Do not INSERT here to avoid violating RLS.
        await supabase
          .from('anonymous_slots')
          .select('id')
          .eq('id', slotId)
          .maybeSingle();

        return {
          success: true,
          data: {
            room_id: slotId,
            ephemeral_name: RoomService.generateEphemeralName(),
            expires_at: expiresAt.toISOString(),
          },
          message: 'Using local fallback (RPC not found).',
        };
      }

      // Other errors（通信やサーバー例外）
      console.error(
        '[RoomService] Get anonymous room error:',
        rpc.error?.message || rpc.error,
      );
      return { error: rpc.error?.message || 'Failed to get anonymous room' };
    } catch (error: unknown) {
      const msg = this.normalizeError(error, 'Failed to get anonymous room');
      console.error('[RoomService] Get anonymous room exception:', msg);
      return { error: msg };
    }
  }

  private static generateEphemeralName(): string {
    const animals = [
      'たぬき',
      'うさぎ',
      'きつね',
      'ねこ',
      'いぬ',
      'くま',
      'ぱんだ',
      'こあら',
      'ぺんぎん',
      'ふくろう',
    ];
    const colors = [
      'あか',
      'あお',
      'きいろ',
      'みどり',
      'むらさき',
      'ぴんく',
      'おれんじ',
      'しろ',
      'くろ',
      'はいいろ',
    ];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const suffix =
      String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
      Math.floor(Math.random() * 10).toString();
    return `${animal}-${color}-${suffix}`;
  }

  /**
   * Send a message to anonymous room with rate limits enforced by RPC.
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

      // Validate message content (client-side guard)
      const validation = this.validateMessageContent(request.content);
      if (!validation.isValid) {
        return { error: validation.error || 'Invalid message content' };
      }

      const sanitized = RoomService.sanitizeContent(request.content);

      // 正規化: room_id が期待形式でない場合は現在スロットIDに置換
      const rawRoomId = (request.room_id || '').trim();
      const pattern = /^anon_\d{8}_\d{2}$/;
      const roomIdForRpc = pattern.test(rawRoomId)
        ? rawRoomId
        : getCurrentAnonymousSlotId();

      // Use SECURITY DEFINER RPC to enforce rate limiting and counters
      const { data, error } = await supabase.rpc('send_anonymous_message', {
        p_room_id: roomIdForRpc,
        p_content: sanitized,
        p_display_name: request.display_name,
      });

      if (error) {
        console.error(
          '[RoomService] Send anonymous message error:',
          error.message,
        );
        return { error: error.message };
      }

      if (!data || data.error) {
        const errMsg = data?.error || 'Failed to send anonymous message';
        console.error('[RoomService] Send anonymous message error:', errMsg);
        return { error: errMsg };
      }

      return {
        success: true,
        data: { message_id: data.message_id },
        message: 'Message sent successfully',
      };
    } catch (error: unknown) {
      const msg = this.normalizeError(
        error,
        'Failed to send anonymous message',
      );
      console.error('[RoomService] Send anonymous message exception:', msg);
      return { error: msg };
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
   * Sanitize message content to avoid control characters or unsafe strings
   */
  static sanitizeContent(input: string): string {
    const trimmed = (input || '').trim();
    // Remove null bytes and control chars except newline and tab
    const cleaned = trimmed.replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,
      '',
    );
    // Enforce length limit
    return cleaned.slice(0, 2000);
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
