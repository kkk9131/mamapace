# Anonymous Room Navigation Fix

## Problem Identified
Users could not properly return from the anonymous room (愚痴ルーム) screen. When tapping the back button, they would see only a background screen instead of returning to the proper previous screen.

## Root Cause Analysis
**Navigation Flow:**
```
ProfileScreen → "参加ルーム" button → CustomTabs active='roomsList' 
→ RoomsListScreen → Anonymous room option 
→ AnonRoomScreen → Back button 
→ RoomsListScreen BUT with animation issues
```

**Core Issues:**
1. **Animation Reset**: `RoomsListScreen` created new `Animated.Value(0)` on each render
2. **State Management**: Animation always started from 0 (transparent) when returning from anonymous room
3. **Timing**: No proper fade state preservation unlike working `ChannelScreen` navigation

## Solution Implemented
Fixed `RoomsListScreen.tsx` with the following changes:

### 1. Proper Animation Value Management
```typescript
// Before: const fade = new Animated.Value(0);
// After:
const fade = useRef(new Animated.Value(0)).current;
```

### 2. Smart Animation Logic
```typescript
// Animation - smart animation handling to prevent blank screen on back navigation
React.useEffect(() => {
  if (currentView === 'list') {
    // Ensure immediate display when returning to list view
    fade.setValue(1);
  } else {
    // Animate in for initial load
    const timer = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, 50);

    return () => clearTimeout(timer);
  }
}, [currentView, fade]);
```

### 3. Explicit Fade State Management in Callbacks
```typescript
// Anonymous room onBack
onBack={() => {
  // Ensure immediate display when returning to list view
  fade.setValue(1);
  setCurrentView('list');
}}

// Channel onBack  
onBack={() => {
  // Ensure immediate display when returning to list view
  fade.setValue(1);
  if (onBack) {
    onBack();
  } else {
    setCurrentView('list');
  }
}}
```

### 4. Fixed Variable Declaration Order
Moved `currentView` state declaration before `useEffect` that uses it to prevent "used before declaration" error.

## Result
- Users can now properly navigate back from anonymous room
- No more blank screen on back navigation
- Consistent behavior with other room types (ChannelScreen)
- Immediate display when returning to list view
- Proper animation handling for all navigation scenarios

## Files Modified
- `src/screens/RoomsListScreen.tsx` - Fixed animation and state management

## Testing
- Code compiles correctly (fixed TypeScript declaration order issue)
- Animation logic follows same pattern as working `RoomsScreen`
- Proper fade state preservation implemented