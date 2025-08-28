# Development Commands

## Essential Commands

### Development Server
```bash
npm start              # Start Expo development server
npm run android        # Run on Android device/emulator
npm run ios           # Run on iOS device/simulator
npm run web           # Run web version
```

### Code Quality
```bash
npm run lint          # Run ESLint with auto-fix
npm run lint:check    # Check linting without fixing
npm run format        # Format code with Prettier
npm run format:check  # Check formatting without fixing
```

### Testing
```bash
npm test              # Run Jest tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run test:integration # Run integration tests
npm run test:e2e      # Run end-to-end tests with Detox
npm run test:security # Run security tests
npm run test:performance # Run performance tests
```

### E2E Testing (Detox)
```bash
npm run detox:build   # Build iOS simulator for testing
npm run detox:test    # Run Detox E2E tests
```

## Task Completion Workflow

### Before Committing
1. **Lint and Format**: `npm run lint && npm run format`
2. **Run Tests**: `npm run test`
3. **Check Coverage**: `npm run test:coverage`
4. **Security Check**: `npm run test:security` (if applicable)

### Git Commands (macOS/Darwin specific)
```bash
git status            # Check repository status
git add .             # Stage all changes
git commit -m "message" # Commit with message
git push              # Push to remote
git pull              # Pull latest changes
```

### System Utilities (Darwin/macOS)
```bash
ls -la                # List files with details
find . -name "*.tsx"  # Find TypeScript React files
grep -r "pattern" src/ # Search for patterns in source
cat file.txt          # Display file contents
which node            # Find Node.js location
ps aux | grep expo    # Find running Expo processes
```

## Project-Specific Commands

### Database Operations
- Supabase migrations are handled through the Supabase CLI or dashboard
- Local development uses `.env` configuration
- Database schema changes require proper migration files

### Bundle Analysis
- Use Expo CLI tools for bundle size analysis
- Metro bundler configuration in `metro.config.js`
- Check bundle size before production builds

### Environment Management
- Copy `.env.example` to `.env` for local development
- Configure Supabase URL and anon key
- Ensure proper environment variable setup for different stages