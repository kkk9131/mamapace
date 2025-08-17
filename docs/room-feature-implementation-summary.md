# Room Feature Implementation Summary

This document summarizes the comprehensive implementation of the room feature for the Mamapace SNS app according to the requirements in `room-feature-requirements-v1.md`.

## Overview

The room feature implements a Discord-like space/channel system with the following key components:
- **Spaces**: Discord-like servers/communities (public/private)
- **Channels**: Chat timelines within spaces (V1: 1 channel per space)
- **Anonymous Rooms**: 1-hour ephemeral chat rooms with random display names
- **NEW Badge System**: Unread message indicators
- **Rate Limiting**: 10-second intervals for anonymous rooms
- **Auto-Moderation**: 3 reports = auto-mask messages

## Implementation Details

### 1. Database Schema (`/supabase/sql/14_rooms_schema.sql`)

**Core Tables:**
- `spaces` - Discord-like servers with public/private settings
- `channels` - Chat timelines (1 per space in V1)
- `channel_members` - User membership with roles (owner/moderator/member)
- `room_messages` - Messages for both channels and anonymous rooms
- `subscriptions` - Paid user validation for space creation
- `anonymous_slots` - Time-based anonymous room management
- `rate_limits` - Anonymous room slow mode enforcement
- `message_reports` - Auto-moderation system

**Key Features:**
- Automatic member count tracking
- TTL support for anonymous messages
- Auto-masking when report_count >= 3
- Ephemeral name generation for anonymous users
- Rate limiting with 10-second and 1-minute windows

### 2. Row Level Security (`/supabase/sql/15_rooms_rls.sql`)

**Access Control:**
- **Public Spaces**: Viewable by all authenticated users, instant join
- **Private Spaces**: Members only, requires approval (V1.1 feature)
- **Space Creation**: Paid users only (`is_paid_user()` function)
- **Message Visibility**: Based on membership for channels, open for anonymous
- **Moderation**: Owner/moderator permissions for content management

### 3. API Functions (`/supabase/sql/16_rooms_rpcs.sql`)

**Space Management:**
- `create_space()` - Creates space with paid user validation
- `search_public_spaces()` - Search by name and tags
- `join_public_space()` - Instant join for public spaces
- `get_chat_list_with_new()` - Chat list with NEW badge info
- `mark_seen()` - Update last_seen_at for NEW badge system

**Messaging:**
- `send_channel_message()` - Send messages to channels
- `get_channel_messages()` - Retrieve with pagination
- `send_anonymous_message()` - Rate-limited anonymous posting
- `get_anonymous_messages()` - Retrieve anonymous room messages

**Anonymous Rooms:**
- `get_or_create_current_anon_room()` - Lazy slot creation
- `generate_ephemeral_name()` - Random display names
- Automatic TTL cleanup functions

**Moderation:**
- `report_message()` - Report system with auto-masking
- Auto-cleanup functions for expired data

### 4. Real-time System (`/supabase/sql/17_rooms_realtime.sql`)

**Real-time Features:**
- Message broadcasting for channels and anonymous rooms
- Member join/leave events
- Typing indicators
- Space and channel updates
- Security checks for subscription permissions

### 5. Frontend Implementation

#### Types (`/src/types/room.ts`)
- Complete TypeScript definitions for all room system entities
- API request/response types
- Real-time event types
- Utility functions for validation and formatting

#### Service Layer (`/src/services/roomService.ts`)
- Comprehensive API wrapper with error handling
- Rate limiting response handling
- Input validation
- Privacy protection (sanitization functions)

#### React Hooks (`/src/hooks/useRooms.ts`)
- `useUserSpaces()` - User's joined spaces
- `useSpaceSearch()` - Public space discovery
- `useSpaceOperations()` - Create, join, leave spaces
- `useChannelMessages()` - Channel messaging with real-time
- `useAnonymousRoom()` - Anonymous room functionality
- `useChatList()` - Chat list with NEW badges
- `useSubscription()` - Paid user status
- `useModeration()` - Message reporting

#### Screen Components

**RoomsScreen** (`/src/screens/RoomsScreen.tsx`):
- Space list with NEW badge indicators
- Search functionality for public spaces
- Filter categories
- Anonymous room access
- Create space button (paid users only)

**ChannelScreen** (`/src/screens/ChannelScreen.tsx`):
- Real-time message display
- Message sending with optimistic updates
- Message reporting (long press)
- Pagination support
- Auto-scroll to new messages

**CreateSpaceScreen** (`/src/screens/CreateSpaceScreen.tsx`):
- Space creation form with validation
- Public/private selection
- Tag management
- Paid user verification
- Character limits and constraints

**AnonRoomScreen** (`/src/screens/AnonRoomScreen.tsx`):
- Ephemeral name display
- 1-hour countdown timer
- Rate limiting feedback
- Auto-refresh for new room slots
- Message TTL indicators

## Key Features Implemented

### ✅ NEW Badge System
- Shows count of unread messages from others
- Updates in real-time
- Cleared when entering channel
- Excludes user's own messages

### ✅ Anonymous Rooms
- 1-hour time slots (`anon_YYYYMMDD_HH`)
- Random ephemeral names (e.g., "たぬき-あか-A7")
- Rate limiting: 10 seconds between posts, max 6/minute
- Auto-delete after 1 hour
- Real-time updates

### ✅ Paid User Gating
- `is_paid_user()` function checks subscription
- RLS policy enforcement
- UI shows create button only for paid users
- Subscription status display

### ✅ Auto-Moderation
- 3 reports trigger auto-masking
- Masked messages show placeholder text
- Report counting and tracking
- Moderation permissions for owners/moderators

### ✅ Search and Discovery
- Public space search by name and tags
- Filter categories
- Member count and capacity display
- Join/leave functionality

### ✅ Real-time Updates
- Message broadcasting
- Member presence
- Space/channel events
- Typing indicators
- Automatic reconnection

## Database Migrations Required

Execute the following SQL files in order:
1. `14_rooms_schema.sql` - Core schema and functions
2. `15_rooms_rls.sql` - Row Level Security policies
3. `16_rooms_rpcs.sql` - API functions and procedures
4. `17_rooms_realtime.sql` - Real-time setup

## Testing Checklist

### Basic Functionality
- [ ] Create space (paid users only)
- [ ] Search and join public spaces
- [ ] Send/receive channel messages
- [ ] Enter anonymous room
- [ ] Send anonymous messages with rate limiting
- [ ] NEW badge appears/disappears correctly

### Security
- [ ] Free users cannot create spaces
- [ ] Private space access restricted to members
- [ ] Anonymous users cannot access wrong time slots
- [ ] Message reporting works
- [ ] Auto-masking at 3 reports

### Real-time
- [ ] Messages appear instantly
- [ ] NEW badges update in real-time
- [ ] Anonymous room messages sync
- [ ] Member join/leave events

### Edge Cases
- [ ] Anonymous room expiry and transition
- [ ] Rate limiting enforcement
- [ ] Message TTL cleanup
- [ ] Network disconnection recovery
- [ ] Large message volumes

### Performance
- [ ] Message pagination works smoothly
- [ ] Search results load quickly
- [ ] Real-time doesn't impact performance
- [ ] Background cleanup runs properly

## Next Steps (V1.1)

- Multiple channels per space
- Private space join requests/approval
- Invite links and codes
- Enhanced moderation tools
- Image attachments
- Push notifications
- Full-text search

## Notes

- All message sorting follows `created_at ASC, id ASC` for consistency
- Anonymous room messages auto-delete via TTL
- Rate limiting includes both 10-second and 1-minute windows
- NEW badge only shows for messages from other users
- Subscription status is cached and checked on space creation
- Error handling includes rate limit retry information