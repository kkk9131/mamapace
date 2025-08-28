# Commands & Scripts Reference

## Development Commands
```bash
# Start development server
npm start              # Expo dev server
npm run android        # Start Android dev server
npm run ios           # Start iOS dev server
npm run web           # Start web dev server
```

## Testing Commands
```bash
# Unit tests
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report

# Specialized tests
npm run test:integration  # Integration tests
npm run test:security     # Security tests
npm run test:performance  # Performance tests

# E2E tests (Detox)
npm run test:e2e          # Run E2E tests
npm run detox:build       # Build E2E test app
npm run detox:test        # Run Detox tests
```

## Code Quality Commands
```bash
# Linting
npm run lint          # Fix linting issues
npm run lint:check    # Check without fixing

# Formatting
npm run format        # Format code with Prettier
npm run format:check  # Check formatting
```

## Task Completion Workflow
After completing any development task:

1. **Lint & Format**:
   ```bash
   npm run lint
   npm run format
   ```

2. **Run Tests**:
   ```bash
   npm test
   ```

3. **Check Coverage** (if applicable):
   ```bash
   npm run test:coverage
   ```

4. **Manual Testing**:
   - Test on both iOS and Android if UI changes
   - Verify real-time functionality works
   - Check error states and edge cases

## System Commands (macOS)
```bash
# File operations
ls -la               # List files with details
find . -name "*.tsx" # Find TypeScript files
grep -r "pattern"    # Search in files
cd /path/to/dir      # Change directory

# Process management
ps aux | grep node   # Find Node processes
kill -9 [PID]        # Kill process

# Git operations
git status           # Check status
git add .            # Stage changes
git commit -m "msg"  # Commit changes
git push origin main # Push to remote
```

## Development Workflow
1. Create feature branch
2. Implement changes following conventions
3. Run linting and formatting
4. Write/update tests
5. Run full test suite
6. Manual testing on devices
7. Commit with descriptive message
8. Push and create pull request