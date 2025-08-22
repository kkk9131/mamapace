# Navigation Animation Fix Pattern

## Issue Description
When navigating back from sub-screens (anonymous room, channel screen) to parent screens, users experience a blank screen flash due to animation state management issues. The fadeAnim value needs to be properly managed during navigation transitions.

## Working Solution Pattern
The successful fix pattern used in RoomsScreen.tsx and RoomsListScreen.tsx:

### 1. Smart Animation Handling
```typescript
useEffect(() => {
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

### 2. Proper Back Navigation Handler
```typescript
onBack={() => {
  fade.setValue(1);  // Immediate fade to prevent blank screen
  setCurrentView('list');
}}
```

### 3. Conditional Animation Reset
- When returning to main view: `fade.setValue(1)` for immediate display
- When switching to search: Proper animation with timeout
- When navigating to sub-screens: Standard fade animation

## Key Principles
1. **Immediate Display**: Set fadeAnim to 1 when returning from sub-screens
2. **Prevent Flash**: No animation delay when user expects immediate response
3. **Smooth Transitions**: Use animations for forward navigation only
4. **State Consistency**: Ensure animation value matches expected UI state

## Implementation Requirements
- Apply to all screen components that use fade animations
- Maintain consistent back navigation behavior
- Test navigation flows: main → sub → main
- Verify no blank screen flashes during rapid navigation