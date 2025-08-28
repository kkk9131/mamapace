# Tech Stack and Code Conventions

## TypeScript Configuration
- **Strict Mode**: Enabled with comprehensive type checking
- **Path Mapping**: Uses `@/*` aliases for clean imports
- **Target**: ES2020 with React JSX
- **Null Checks**: Strict null checks enabled
- **Unused Code Detection**: Warns about unused locals/parameters

## Code Style Conventions
1. **File Naming**: 
   - Screens: PascalCase with "Screen" suffix (e.g., `ChannelScreen.tsx`)
   - Components: PascalCase (e.g., `AuthGuard.tsx`)
   - Hooks: camelCase with "use" prefix (e.g., `useChat.ts`)
   - Services: camelCase with "Service" suffix (e.g., `authService.ts`)

2. **Import Organization**:
   - React imports first
   - React Native imports second
   - Third-party libraries third
   - Local imports last (using @ aliases)

3. **Component Structure**:
   - Props interface defined above component
   - JSDoc comments for complex components
   - State and refs declared early
   - Effects grouped together
   - Handler functions before render
   - Return JSX at bottom

4. **Styling**:
   - Inline styles with theme system
   - BlurView for glass-morphism effects
   - Animated.View for transitions
   - Pressable for interactive elements
   - Theme spacing and colors consistently

## React Native Patterns
- **Navigation**: React Navigation with proper TypeScript typing
- **State Management**: useState + useEffect, custom hooks for data fetching
- **Animation**: Animated API with useNativeDriver when possible
- **Platform Differences**: Platform.OS checks for iOS/Android specifics
- **Performance**: FlatList for lists, optimized re-renders

## Error Handling
- Try/catch blocks for async operations
- User-friendly error messages in Japanese
- Alert.alert for user notifications
- Error state in UI components
- Graceful degradation for network issues