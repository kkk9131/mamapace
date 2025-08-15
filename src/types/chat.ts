/**
 * SECURE CHAT TYPES
 * 
 * CRITICAL SECURITY RULES:
 * 1. NEVER log message content or participant information
 * 2. Use SecureString for sensitive data handling
 * 3. Always validate input data before processing
 * 4. Implement proper message encryption for sensitive content
 * 5. Follow existing privacy protection patterns
 */

import { PublicUserProfile, SensitiveData } from './auth';

// =====================================================
// SECURITY ANNOTATIONS
// =====================================================

/**
 * Marks message content as potentially sensitive
 */
type MessageContent = string & { readonly __messageContent: unique symbol };

/**
 * Marks encrypted message data
 */
type EncryptedMessage = string & { readonly __encrypted: unique symbol };

// =====================================================
// CORE CHAT TYPES
// =====================================================

/**
 * User online status
 */
export enum OnlineStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline',
  INVISIBLE = 'invisible'
}

/**
 * User presence information
 */
export interface UserPresence {
  user_id: string;
  status: OnlineStatus;
  last_seen_at: string;
  updated_at: string;
}

/**
 * Message read receipt with visual indicators
 */
export enum ReadReceiptStatus {
  UNREAD = 'unread',
  DELIVERED = 'delivered',
  READ = 'read',
  SEEN = 'seen'
}

/**
 * Message delivery status
 */
export interface MessageDeliveryStatus {
  message_id: string;
  user_id: string;
  status: ReadReceiptStatus;
  timestamp: string;
}

/**
 * Chat conversation between users
 */
export interface Chat {
  id: string;
  participant_ids: string[];
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  is_active: boolean;
  chat_type: 'direct' | 'group'; // For future expansion
  metadata: ChatMetadata | null;
}

/**
 * Chat metadata for additional information
 */
export interface ChatMetadata {
  title?: string; // For group chats
  description?: string;
  archived_at?: string;
  muted_until?: string;
  custom_settings?: Record<string, any>;
}

/**
 * Individual message in a chat
 */
export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  message_type: MessageType;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_message_id: string | null;
  metadata: MessageMetadata | null;
}

/**
 * Message type enumeration
 */
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system', // For system notifications
  DELETED = 'deleted' // For deleted message placeholders
}

/**
 * Message metadata for additional information
 */
export interface MessageMetadata {
  file_url?: string;
  file_name?: string;
  file_size?: number;
  image_width?: number;
  image_height?: number;
  system_event?: SystemEventType;
  mentions?: string[]; // User IDs mentioned in message
}

/**
 * System event types for system messages
 */
export enum SystemEventType {
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  CHAT_CREATED = 'chat_created',
  SETTINGS_CHANGED = 'settings_changed'
}

// =====================================================
// MESSAGE STATUS TYPES
// =====================================================

/**
 * Message read status for a specific user
 */
export interface MessageReadStatus {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
  created_at: string;
}

/**
 * Typing indicator status
 */
export interface TypingStatus {
  chat_id: string;
  user_id: string;
  is_typing: boolean;
  last_typed_at: string;
}

// =====================================================
// PARTICIPANT TYPES
// =====================================================

/**
 * Chat participant information
 */
export interface ChatParticipant {
  id: string;
  chat_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  role: ParticipantRole;
  muted_until: string | null;
  last_read_message_id: string | null;
  last_read_at: string | null;
}

/**
 * Participant role in chat
 */
export enum ParticipantRole {
  MEMBER = 'member',
  ADMIN = 'admin', // For future group chat features
  OWNER = 'owner'  // For future group chat features
}

// =====================================================
// ENRICHED TYPES (WITH USER DATA)
// =====================================================

/**
 * Chat with participant user profiles
 */
export interface ChatWithParticipants extends Chat {
  participants: PublicUserProfile[];
  unread_count: number;
  last_message?: MessageWithSender;
  participants_presence: UserPresence[];
  typing_users: string[]; // Currently typing user IDs
}

/**
 * Message with sender user profile
 */
export interface MessageWithSender extends Message {
  sender: PublicUserProfile;
  read_by?: MessageReadStatus[];
  is_read: boolean; // For current user
  delivery_status: MessageDeliveryStatus[];
  read_receipt_status: ReadReceiptStatus;
}

/**
 * Optimistic message for UI updates before server confirmation
 */
export interface OptimisticMessage extends MessageWithSender {
  isOptimistic?: boolean;
  tempId?: string;
  error?: string;
}

/**
 * Chat participant with user profile
 */
export interface ChatParticipantWithUser extends ChatParticipant {
  user: PublicUserProfile;
}

// =====================================================
// REQUEST/RESPONSE TYPES
// =====================================================

/**
 * Request to create a new chat
 */
export interface CreateChatRequest {
  participant_id: string; // Other user's ID for direct chat
  initial_message?: string;
  chat_type?: 'direct' | 'group';
  metadata?: Partial<ChatMetadata>;
}

/**
 * Request to send a new message
 */
export interface SendMessageRequest {
  chat_id: string;
  content: string;
  message_type?: MessageType;
  reply_to_message_id?: string;
  metadata?: Partial<MessageMetadata>;
}

/**
 * Request to edit an existing message
 */
export interface EditMessageRequest {
  message_id: string;
  content: string;
}

/**
 * Request to delete a message
 */
export interface DeleteMessageRequest {
  message_id: string;
  delete_for_everyone?: boolean; // If false, only hide for current user
}

/**
 * Request to mark messages as read
 */
export interface MarkAsReadRequest {
  chat_id: string;
  message_ids?: string[]; // If not provided, marks all unread messages
}

/**
 * Request to update typing status
 */
export interface UpdateTypingRequest {
  chat_id: string;
  is_typing: boolean;
}

// =====================================================
// RESPONSE TYPES
// =====================================================

/**
 * Chat operation success response
 */
export interface ChatSuccessResponse<T = any> {
  success: true;
  data: T;
}

/**
 * Chat operation error response
 */
export interface ChatErrorResponse {
  success: false;
  error: string;
  error_code?: ChatErrorCode;
}

/**
 * Chat response union type
 */
export type ChatResponse<T = any> = ChatSuccessResponse<T> | ChatErrorResponse;

/**
 * Chat error codes
 */
export enum ChatErrorCode {
  CHAT_NOT_FOUND = 'CHAT_NOT_FOUND',
  MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',
  ACCESS_DENIED = 'ACCESS_DENIED',
  PARTICIPANT_NOT_FOUND = 'PARTICIPANT_NOT_FOUND',
  INVALID_MESSAGE_TYPE = 'INVALID_MESSAGE_TYPE',
  MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  SUPABASE_ERROR = 'SUPABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

// =====================================================
// PAGINATION TYPES
// =====================================================

/**
 * Pagination parameters for chat queries
 */
export interface ChatPaginationParams {
  limit?: number;
  offset?: number;
  cursor?: string; // For cursor-based pagination
  order?: 'asc' | 'desc';
}

/**
 * Paginated chat list response
 */
export interface PaginatedChats {
  chats: ChatWithParticipants[];
  total_count: number;
  has_more: boolean;
  next_cursor?: string;
}

/**
 * Paginated message list response
 */
export interface PaginatedMessages {
  messages: MessageWithSender[];
  total_count: number;
  has_more: boolean;
  next_cursor?: string;
}

// =====================================================
// REAL-TIME EVENT TYPES
// =====================================================

/**
 * Real-time chat event types
 */
export enum ChatEventType {
  NEW_MESSAGE = 'new_message',
  MESSAGE_UPDATED = 'message_updated',
  MESSAGE_DELETED = 'message_deleted',
  MESSAGE_READ = 'message_read',
  MESSAGE_DELIVERED = 'message_delivered',
  TYPING_STARTED = 'typing_started',
  TYPING_STOPPED = 'typing_stopped',
  CHAT_UPDATED = 'chat_updated',
  PARTICIPANT_JOINED = 'participant_joined',
  PARTICIPANT_LEFT = 'participant_left',
  USER_ONLINE = 'user_online',
  USER_OFFLINE = 'user_offline',
  USER_STATUS_CHANGED = 'user_status_changed'
}

/**
 * Real-time chat event payload
 */
export interface ChatEvent {
  type: ChatEventType;
  chat_id: string;
  user_id: string; // User who triggered the event
  timestamp: string;
  data: any; // Event-specific data
}

/**
 * Real-time message event
 */
export interface MessageEvent extends ChatEvent {
  type: ChatEventType.NEW_MESSAGE | ChatEventType.MESSAGE_UPDATED | ChatEventType.MESSAGE_DELETED;
  data: MessageWithSender;
}

/**
 * Real-time typing event
 */
export interface TypingEvent extends ChatEvent {
  type: ChatEventType.TYPING_STARTED | ChatEventType.TYPING_STOPPED;
  data: {
    user: PublicUserProfile;
    is_typing: boolean;
  };
}

/**
 * Real-time read status event
 */
export interface ReadStatusEvent extends ChatEvent {
  type: ChatEventType.MESSAGE_READ;
  data: {
    message_id: string;
    reader: PublicUserProfile;
    read_at: string;
    status: ReadReceiptStatus;
  };
}

/**
 * Real-time presence event
 */
export interface PresenceEvent extends ChatEvent {
  type: ChatEventType.USER_ONLINE | ChatEventType.USER_OFFLINE | ChatEventType.USER_STATUS_CHANGED;
  data: {
    user: PublicUserProfile;
    presence: UserPresence;
  };
}

// =====================================================
// VALIDATION TYPES
// =====================================================

/**
 * Message validation result
 */
export interface MessageValidation {
  isValid: boolean;
  error?: string;
  checks: {
    length: boolean;
    content_type: boolean;
    mentions: boolean;
    profanity: boolean;
  };
}

/**
 * Chat validation result
 */
export interface ChatValidation {
  isValid: boolean;
  error?: string;
  checks: {
    participants: boolean;
    permissions: boolean;
    rate_limit: boolean;
  };
}

// =====================================================
// CONSTANTS
// =====================================================

/**
 * Chat validation constraints
 */
export const ChatConstraints = {
  message: {
    maxLength: 2000,
    minLength: 1
  },
  chat: {
    maxParticipants: 100, // For future group chat features
    maxChatsPerUser: 500
  },
  file: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']
  },
  rateLimit: {
    messagesPerMinute: 30,
    chatsPerHour: 10
  }
} as const;

// =====================================================
// UTILITY TYPES
// =====================================================

/**
 * Chat search parameters
 */
export interface ChatSearchParams {
  query?: string;
  chat_type?: 'direct' | 'group';
  has_unread?: boolean;
  participant_id?: string;
  created_after?: string;
  created_before?: string;
}

/**
 * Message search parameters
 */
export interface MessageSearchParams {
  query?: string;
  chat_id?: string;
  sender_id?: string;
  message_type?: MessageType;
  created_after?: string;
  created_before?: string;
}

// =====================================================
// PRIVACY PROTECTION UTILITIES
// =====================================================

/**
 * Sanitizes chat objects by removing sensitive fields before logging
 */
export function sanitizeChatForLogging(chat: any): any {
  if (!chat || typeof chat !== 'object') {
    return chat;
  }

  const sanitized = { ...chat };
  
  // Remove sensitive fields that shouldn't be logged
  const sensitiveFields = [
    'content', // Message content
    'metadata', // May contain sensitive information
    'participants', // User information
    'sender' // User profile data
  ];

  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      if (field === 'content') {
        sanitized[field] = '[MESSAGE_CONTENT_REDACTED]';
      } else if (field === 'participants' || field === 'sender') {
        sanitized[field] = '[USER_DATA_REDACTED]';
      } else {
        sanitized[field] = '[REDACTED]';
      }
    }
  });

  return sanitized;
}

/**
 * Sanitizes message objects for logging
 */
export function sanitizeMessageForLogging(message: any): any {
  if (!message || typeof message !== 'object') {
    return message;
  }

  return {
    ...message,
    content: '[MESSAGE_CONTENT_REDACTED]',
    sender: message.sender ? { id: message.sender.id, username: '[REDACTED]' } : null,
    metadata: message.metadata ? '[METADATA_REDACTED]' : null
  };
}

/**
 * Type-safe way to create send message request
 */
export function createSendMessageRequest(data: {
  chat_id: string;
  content: string;
  message_type?: MessageType;
  reply_to_message_id?: string;
  metadata?: Partial<MessageMetadata>;
}): SendMessageRequest {
  return {
    chat_id: data.chat_id,
    content: data.content,
    message_type: data.message_type || MessageType.TEXT,
    reply_to_message_id: data.reply_to_message_id,
    metadata: data.metadata
  };
}

/**
 * Type-safe way to create create chat request
 */
export function createChatRequest(data: {
  participant_id: string;
  initial_message?: string;
  chat_type?: 'direct' | 'group';
  metadata?: Partial<ChatMetadata>;
}): CreateChatRequest {
  return {
    participant_id: data.participant_id,
    initial_message: data.initial_message,
    chat_type: data.chat_type || 'direct',
    metadata: data.metadata
  };
}

// =====================================================
// EXPORT STATEMENT
// =====================================================

export type {
  MessageContent,
  EncryptedMessage
};