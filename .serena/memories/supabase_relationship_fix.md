# Supabase Relationship Error Fix

## Problem
The RoomService was using Supabase's relationship syntax (e.g., `user_profiles!sender_id`) which requires proper foreign key relationships to be set up in the database schema. This was causing errors like:

```
ERROR: Could not find a relationship between 'room_messages' and 'user_profiles' in the schema cache
```

## Solution
Replaced all JOIN operations with separate queries and application-side data combination to eliminate dependency on database relationship schema.

## Functions Modified

### 1. `getChannelMessages()`
- **Before**: Used `sender:user_profiles!sender_id` JOIN
- **After**: Separate queries for messages and user profiles, combined in application layer
- **Benefits**: No relationship dependency, graceful degradation if profile fetch fails

### 2. `searchPublicSpaces()`
- **Before**: Used `owner:user_profiles!owner_id` JOIN  
- **After**: Separate queries for spaces and owner profiles, combined in application layer
- **Benefits**: Search works even if owner profiles are unavailable

### 3. `getChatListWithNew()`
- **Before**: Used `sender:user_profiles!sender_id` JOIN for latest messages
- **After**: Separate queries for chat list and individual sender profiles
- **Benefits**: Chat list loads even if sender information is unavailable

## Technical Implementation
- Used `Array.from(new Set(...))` for unique ID extraction (TypeScript compatibility)
- Created Maps for efficient profile lookup
- Implemented graceful error handling - continues operation if profile fetch fails
- Maintained same return types and API contracts

## Files Changed
- `/Users/kazuto/newsns-app/src/services/roomService.ts`

## Testing
- TypeScript compilation verified
- Code formatting applied with Prettier
- No breaking changes to existing API contracts

## Result
The RoomService now works without requiring foreign key relationships in the Supabase schema, making it more resilient and easier to deploy.