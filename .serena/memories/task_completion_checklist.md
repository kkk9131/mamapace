# Task Completion Checklist

## After Making Code Changes

### 1. Code Quality
- [ ] Run `npm run lint` - Fix any ESLint errors
- [ ] Run `npm run format` - Ensure consistent formatting
- [ ] Check TypeScript compilation with VS Code or `npx tsc --noEmit`

### 2. Testing
- [ ] Run `npm test` - Ensure unit tests pass
- [ ] Run related component tests if applicable
- [ ] Manual testing on development server (`npm start`)

### 3. Functionality Testing
- [ ] Test on iOS simulator/device
- [ ] Test on Android simulator/device if cross-platform changes
- [ ] Test different screen sizes and orientations
- [ ] Verify accessibility with screen reader if UI changes

### 4. Performance Considerations
- [ ] Check for proper memoization in complex components
- [ ] Verify animations are smooth (60fps target)
- [ ] Test with React Native performance monitor

### 5. Code Review Readiness
- [ ] Ensure proper TypeScript types are used
- [ ] Verify component props are properly typed
- [ ] Check for proper error handling
- [ ] Ensure accessibility attributes are present for interactive elements

### 6. Documentation
- [ ] Update component documentation if interfaces changed
- [ ] Add comments for complex logic
- [ ] Update README if new features added

## Pre-Commit Checklist
- [ ] All tests passing
- [ ] No linting errors
- [ ] Code formatted
- [ ] TypeScript compilation successful
- [ ] Manual testing completed