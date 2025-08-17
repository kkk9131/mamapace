/**
 * ROOM SYSTEM TYPES
 * 
 * Types for the Discord-like space/channel system with anonymous rooms
 * Following the requirements in room-feature-requirements-v1.md
 * 
 * SECURITY RULES:
 * 1. NEVER log message content or user information
 * 2. Use appropriate privacy protection for sensitive data
 * 3. Follow existing privacy protection patterns
 */

import { PublicUserProfile } from './auth';

// =====================================================
// CORE SPACE TYPES
// =====================================================

/**
 * Space (Discord-like server/community)
 */
export interface Space {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  is_public: boolean;
  owner_id: string;
  max_members: number;
  member_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Space with owner information
 */
export interface SpaceWithOwner extends Space {
  owner: PublicUserProfile;
  can_join: boolean;
}

/**
 * Space creation request
 */
export interface CreateSpaceRequest {
  name: string;
  description?: string;
  tags?: string[];
  is_public?: boolean;
  max_members?: number;
}

/**
 * Space search parameters
 */
export interface SpaceSearchParams {
  query?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// =====================================================
// CHANNEL TYPES
// =====================================================

/**
 * Channel within a space
 */
export interface Channel {
  id: string;
  space_id: string;
  name: string;
  description: string | null;
  channel_type: 'text' | 'voice' | 'announcement';
  is_active: boolean;
  created_at: string;
}

/**
 * Channel member with role and status
 */
export interface ChannelMember {
  channel_id: string;
  user_id: string;
  role: 'owner' | 'moderator' | 'member';
  last_seen_at: string;
  joined_at: string;
  is_active: boolean;
}

/**
 * Channel member with user profile
 */
export interface ChannelMemberWithUser extends ChannelMember {
  user: PublicUserProfile;
}

/**
 * Channel with space information
 */
export interface ChannelWithSpace extends Channel {
  space: Space;
  member_role?: 'owner' | 'moderator' | 'member';
  has_new: boolean;
  unread_count: number;
}

// =====================================================
// MESSAGE TYPES
// =====================================================

/**
 * Room message (channel or anonymous)
 */
export interface RoomMessage {
  id: string;
  channel_id: string | null;
  anonymous_room_id: string | null;
  sender_id: string;
  display_name: string | null; // For anonymous rooms
  message_type: 'text' | 'image' | 'file' | 'system';
  content: string;
  attachments: any[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  expires_at: string | null; // For anonymous rooms
  is_edited: boolean;
  report_count: number;
  is_masked: boolean;
}

/**
 * Room message with sender information
 */
export interface RoomMessageWithSender extends RoomMessage {
  sender?: PublicUserProfile; // Not available for anonymous messages
  sender_username?: string;
  sender_display_name?: string;
  sender_avatar_emoji?: string;
}

/**
 * Send message request
 */
export interface SendMessageRequest {
  content: string;
  message_type?: 'text' | 'image' | 'file';
  attachments?: any[];
}

/**
 * Send channel message request
 */
export interface SendChannelMessageRequest extends SendMessageRequest {
  channel_id: string;
}

/**
 * Send anonymous message request
 */
export interface SendAnonymousMessageRequest extends SendMessageRequest {
  room_id: string;
  display_name: string;
}

// =====================================================
// ANONYMOUS ROOM TYPES
// =====================================================

/**
 * Anonymous room slot
 */
export interface AnonymousSlot {
  id: string; // Format: 'anon_YYYYMMDD_HH'
  opened_at: string;
  closed_at: string;
  participant_count: number;
  message_count: number;
  created_at: string;
}

/**
 * Anonymous room info
 */
export interface AnonymousRoom {
  room_id: string;
  ephemeral_name: string;
  expires_at: string;
}

/**
 * Anonymous message (simplified for display)
 */
export interface AnonymousMessage {
  id: string;
  display_name: string;
  content: string;
  created_at: string;
  is_masked: boolean;
  report_count: number;
}

// =====================================================
// CHAT LIST TYPES
// =====================================================

/**
 * Chat list item with NEW badge info
 */
export interface ChatListItem {
  channel_id: string;
  space_id: string;
  space_name: string;
  space_is_public: boolean;
  channel_name: string;
  member_role: 'owner' | 'moderator' | 'member';
  last_seen_at: string;
  latest_message_at: string | null;
  latest_message_content: string | null;
  latest_message_sender_id: string | null;
  latest_message_sender_username: string | null;
  has_new: boolean;
  unread_count: number;
}

// =====================================================
// MODERATION TYPES
// =====================================================

/**
 * Message report
 */
export interface MessageReport {
  id: string;
  message_id: string;
  reporter_id: string;
  reason: 'spam' | 'harassment' | 'inappropriate' | 'violence' | 'other';
  description: string | null;
  created_at: string;
}

/**
 * Report message request
 */
export interface ReportMessageRequest {
  message_id: string;
  reason: 'spam' | 'harassment' | 'inappropriate' | 'violence' | 'other';
  description?: string;
}

// =====================================================
// RATE LIMITING TYPES
// =====================================================

/**
 * Rate limit info
 */
export interface RateLimit {
  user_id: string;
  room_type: 'anonymous' | 'channel';
  room_id: string;
  last_message_at: string;
  message_count_1min: number;
  message_count_10sec: number;
  created_at: string;
}

/**
 * Rate limit error response
 */
export interface RateLimitError {
  error: string;
  retry_after_seconds: number;
}

// =====================================================
// SUBSCRIPTION TYPES
// =====================================================

/**
 * User subscription for space creation permission
 */
export interface Subscription {
  user_id: string;
  plan: 'free' | 'pro' | 'premium';
  status: 'active' | 'paused' | 'canceled' | 'expired';
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

/**
 * Generic API success response
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
  [key: string]: any;
}

/**
 * Generic API error response
 */
export interface ApiErrorResponse {
  success?: false;
  error: string;
  [key: string]: any;
}

/**
 * API response union type
 */
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// =====================================================
// REALTIME EVENT TYPES
// =====================================================

/**
 * Room realtime event types
 */
export enum RoomEventType {
  // Space events
  SPACE_CREATED = 'space_created',
  SPACE_UPDATED = 'space_updated',
  SPACE_DELETED = 'space_deleted',
  
  // Channel events
  CHANNEL_CREATED = 'channel_created',
  CHANNEL_UPDATED = 'channel_updated',
  CHANNEL_DELETED = 'channel_deleted',
  
  // Member events
  MEMBER_JOINED = 'member_joined',
  MEMBER_LEFT = 'member_left',
  MEMBER_ROLE_CHANGED = 'member_role_changed',
  MEMBER_SEEN_UPDATED = 'member_seen_updated',
  MEMBER_REMOVED = 'member_removed',
  
  // Message events
  MESSAGE_SENT = 'message_sent',
  MESSAGE_EDITED = 'message_edited',
  MESSAGE_MASKED = 'message_masked',
  MESSAGE_DELETED = 'message_deleted',
  
  // Typing events
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop'
}

/**
 * Base realtime event
 */
export interface RoomEvent {
  event_type: RoomEventType;
  timestamp: number;
  data: any;
}

/**
 * Message realtime event
 */
export interface MessageEvent extends RoomEvent {
  event_type: RoomEventType.MESSAGE_SENT | RoomEventType.MESSAGE_EDITED | RoomEventType.MESSAGE_MASKED | RoomEventType.MESSAGE_DELETED;
  message_id: string;
  channel_id?: string;
  anonymous_room_id?: string;
  space_id?: string;
  sender_id: string;
  data: RoomMessageWithSender;
}

/**
 * Member event
 */
export interface MemberEvent extends RoomEvent {
  event_type: RoomEventType.MEMBER_JOINED | RoomEventType.MEMBER_LEFT | RoomEventType.MEMBER_ROLE_CHANGED | RoomEventType.MEMBER_REMOVED;
  channel_id: string;
  space_id: string;
  user_id: string;
  data: ChannelMember;
}

/**
 * Typing event
 */
export interface TypingEvent extends RoomEvent {
  event_type: RoomEventType.TYPING_START | RoomEventType.TYPING_STOP;
  channel_id: string;
  space_id?: string;
  user_id: string;
  data: {
    is_typing: boolean;
    user: PublicUserProfile;
  };
}

// =====================================================
// UI STATE TYPES
// =====================================================

/**
 * Room navigation state
 */
export interface RoomNavState {
  currentSpaceId?: string;
  currentChannelId?: string;
  currentAnonymousRoomId?: string;
}

/**
 * Message input state
 */
export interface MessageInputState {
  content: string;
  isTyping: boolean;
  attachments: any[];
  replyToMessage?: RoomMessageWithSender;
}

/**
 * Space list filter state
 */
export interface SpaceListFilter {
  query: string;
  tags: string[];
  showOnlyJoined: boolean;
}

// =====================================================
// UTILITY TYPES
// =====================================================

/**
 * Optimistic message for UI updates
 */
export interface OptimisticRoomMessage extends RoomMessageWithSender {
  isOptimistic?: boolean;
  tempId?: string;
  error?: string;
}

/**
 * Message pagination params
 */
export interface MessagePaginationParams {
  limit?: number;
  before_message_id?: string;
}

/**
 * Paginated messages response
 */
export interface PaginatedMessages {
  messages: RoomMessageWithSender[];
  has_more: boolean;
  next_cursor?: string;
}

// =====================================================
// CONSTANTS
// =====================================================

/**
 * Room system constraints
 */
export const RoomConstraints = {
  space: {
    name: { minLength: 1, maxLength: 100 },
    description: { maxLength: 500 },
    maxTags: 20,
    maxMembersPublic: 500,
    maxMembersPrivate: 50
  },
  channel: {
    name: { minLength: 1, maxLength: 50 },
    description: { maxLength: 200 }
  },
  message: {
    content: { minLength: 1, maxLength: 2000 }
  },
  anonymous: {
    rateLimitSeconds: 10,
    maxMessagesPerMinute: 6,
    slotDurationHours: 1
  }
} as const;

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Check if user can create spaces
 */
export function canCreateSpaces(subscription?: Subscription): boolean {
  return subscription?.plan !== 'free' && 
         subscription?.status === 'active' && 
         new Date(subscription.current_period_end) > new Date();
}

/**
 * Check if space is at capacity
 */
export function isSpaceAtCapacity(space: Space): boolean {
  return space.member_count >= space.max_members;
}

/**
 * Get anonymous room slot ID for current hour
 */
export function getCurrentAnonymousSlotId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  return `anon_${year}${month}${day}_${hour}`;
}

/**
 * Check if anonymous message is expired
 */
export function isAnonymousMessageExpired(message: RoomMessage): boolean {
  return message.expires_at ? new Date(message.expires_at) <= new Date() : false;
}

/**
 * Format ephemeral name for display
 */
export function formatEphemeralName(name: string): string {
  return name || 'Anonymous';
}

/**
 * Sanitize room message for logging
 */
export function sanitizeRoomMessageForLogging(message: any): any {
  if (!message || typeof message !== 'object') {
    return message;
  }

  return {
    ...message,
    content: '[MESSAGE_CONTENT_REDACTED]',
    display_name: message.anonymous_room_id ? '[ANONYMOUS_NAME_REDACTED]' : message.display_name,
    sender: message.sender ? { id: message.sender.id, username: '[REDACTED]' } : null,
    attachments: message.attachments ? '[ATTACHMENTS_REDACTED]' : null
  };
}

/**
 * Sanitize space for logging
 */
export function sanitizeSpaceForLogging(space: any): any {
  if (!space || typeof space !== 'object') {
    return space;
  }

  return {
    ...space,
    owner: space.owner ? { id: space.owner.id, username: '[REDACTED]' } : null
  };
}