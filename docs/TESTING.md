# 🧪 Mamapace Authentication Testing Documentation

This document provides comprehensive instructions for running and understanding the authentication system tests.

## 📋 Overview

The Mamapace authentication system includes a comprehensive testing suite designed to ensure security, reliability, and performance. Our tests specifically focus on protecting maternal health record numbers while maintaining excellent user experience.

### 🎯 Testing Categories

1. **Unit Tests** - Individual component and service testing
2. **Integration Tests** - Service-to-service and UI-to-service integration
3. **Security Tests** - Maternal health ID protection validation
4. **Performance Tests** - Response time and resource benchmarking
5. **E2E Tests** - Complete user journey validation
6. **Accessibility Tests** - Screen reader and keyboard navigation support

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# For E2E testing, install Detox CLI globally
npm install -g detox-cli
```

### Running All Tests

```bash
# Run all test categories
npm test

# Run with coverage
npm run test:coverage
```

### Running Specific Test Categories

```bash
# Unit tests only
npm test -- --testPathIgnorePatterns="integration|security|performance|e2e"

# Integration tests
npm run test:integration

# Security tests (critical for maternal health ID protection)
npm run test:security

# Performance tests
npm run test:performance

# E2E tests
npm run test:e2e
```

## 🔒 Security Testing

### Critical Security Requirements

Our security tests validate these essential requirements:

1. **No Maternal Health ID Exposure**
   - IDs never appear in console logs, error messages, or UI
   - All data is encrypted before storage or transmission
   - Test failures will show "SECURITY VIOLATION" errors

2. **Secure Data Handling**
   - Input sanitization and validation
   - Proper error message sanitization
   - Memory cleanup after operations

### Running Security Tests

```bash
# Run all security tests
npm run test:security

# Run with detailed output
npm run test:security -- --verbose

# Check for specific security violations
npm run test:security 2>&1 | grep "SECURITY VIOLATION" || echo "✅ No security violations detected"
```

### Security Test Coverage

- **Maternal Health ID Protection**: Validates no IDs are exposed in any system output
- **Input Validation**: Tests SQL injection, XSS, and other attack vectors
- **Session Security**: Ensures secure session management and cleanup
- **Error Message Sanitization**: Verifies no sensitive data in error responses
- **Memory Security**: Checks for sensitive data cleanup after operations

## ⚡ Performance Testing

### Performance Targets

| Operation | Target Time | Measurement |
|-----------|-------------|-------------|
| Login | < 2000ms | End-to-end authentication |
| Registration | < 5000ms | Complete user creation |
| Validation | < 300ms | Real-time form validation |
| Session Restore | < 1000ms | App startup with existing session |
| Token Refresh | < 500ms | Background session refresh |

### Running Performance Tests

```bash
# Run performance tests
npm run test:performance

# Run with detailed timing output
npm run test:performance -- --verbose

# Generate performance report
npm run test:performance > performance-results.log
```

### Performance Monitoring

Performance tests include:

- **Response Time Validation**: Each operation must complete within target times
- **Concurrent User Handling**: Tests with multiple simultaneous operations
- **Memory Usage Monitoring**: Detects memory leaks and excessive usage
- **Resource Optimization**: Validates efficient CPU and network usage

## 🧩 Integration Testing

Integration tests validate that all authentication components work together correctly:

### Service Layer Integration

- **AuthService ↔ EncryptionService**: Data encryption coordination
- **AuthService ↔ ValidationService**: Input validation workflows
- **AuthService ↔ SessionManager**: Session lifecycle management
- **AuthService ↔ SupabaseClient**: Database operations

### UI Integration

- **AuthContext ↔ Components**: State management and UI updates
- **Form Components ↔ Services**: Real-time validation and submission
- **Navigation ↔ Authentication**: Route protection and state-based navigation

### Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test files
npm test -- --testPathPattern="integration/authService"
npm test -- --testPathPattern="integration/authContext"
```

## 🌍 End-to-End Testing

E2E tests validate complete user journeys on real devices/simulators using Detox.

### Setup for E2E Testing

#### iOS Setup

```bash
# Install iOS dependencies
cd ios && pod install && cd ..

# Build for testing
npm run detox:build -- --configuration ios.sim.debug
```

#### Android Setup

```bash
# Ensure Android SDK and emulator are setup
# Create AVD named 'Pixel_3a_API_30_x86'

# Build for testing
npm run detox:build -- --configuration android.emu.debug
```

### Running E2E Tests

```bash
# Run E2E tests (iOS)
npm run detox:test -- --configuration ios.sim.debug

# Run E2E tests (Android)
npm run detox:test -- --configuration android.emu.debug

# Run with cleanup after tests
npm run detox:test -- --configuration ios.sim.debug --cleanup
```

### E2E Test Coverage

- **Complete Registration Flow**: From form input to successful account creation
- **Login Scenarios**: Success, failure, and account lockout handling
- **Session Management**: App restart, session expiry, and logout
- **Navigation Flows**: Screen transitions and state persistence
- **Error Handling**: Network failures and service errors
- **Security Validation**: No sensitive data exposure in real UI
- **Accessibility**: Screen reader and keyboard navigation support

## 📊 Test Data Management

### Secure Test Fixtures

All test data is designed for security:

```typescript
// ✅ Correct - Uses encrypted test data
const ENCRYPTED_TEST_IDS = {
  VALID_ENCRYPTED_1: 'enc_hash_a1b2c3d4e5f6789012345678901234',
  VALID_ENCRYPTED_2: 'enc_hash_b2c3d4e5f6789012345678901234a1',
};

// ❌ Never do this - Real IDs in test data
const REAL_ID = '1234567890'; // SECURITY VIOLATION
```

### Test Utilities

```typescript
// Create safe test data
const user = TEST_UTILITIES.createSafeTestUser();
const request = TEST_UTILITIES.createSafeRegistrationRequest();

// Validate no sensitive data exposure
TEST_UTILITIES.validateNoSensitiveDataExposed(testResult);
```

## 🔧 Configuration

### Jest Configuration

Located in `package.json`:

```json
{
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEnv": ["<rootDir>/src/__tests__/setup.ts"],
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

### Detox Configuration

Located in `.detoxrc.js`:

- Supports iOS simulator and Android emulator testing
- Configures test timeouts and parallelization
- Sets up proper build configurations for testing

## 🚨 Troubleshooting

### Common Issues

#### Security Test Failures

```bash
# Error: SECURITY VIOLATION: Maternal health ID detected
# Solution: Check console.log statements and error messages
grep -r "console\." src/ --exclude-dir=__tests__
```

#### Performance Test Failures

```bash
# Error: Operation exceeded target time
# Solution: Check for network mocks and service delays
# Ensure test environment is optimized
```

#### E2E Test Failures

```bash
# Error: Element not found
# Solution: Check testID props on components
# Verify device/simulator is properly configured

# Reset simulator state
npm run detox:test -- --cleanup
```

#### Memory Issues

```bash
# Error: Out of memory during tests
# Solution: Run tests with less parallelization
npm test -- --maxWorkers=1

# Force garbage collection
node --expose-gc ./node_modules/.bin/jest
```

## 📈 Continuous Integration

### GitHub Actions Workflow

Our CI pipeline runs all test categories automatically:

1. **Unit & Integration Tests**: Runs on every PR and push
2. **Security Audit**: Validates maternal health ID protection
3. **Performance Tests**: Ensures response time targets are met
4. **E2E Tests**: Tests on both iOS and Android platforms
5. **Coverage Reports**: Uploads to Codecov for tracking

### Running CI Tests Locally

```bash
# Simulate CI environment
npm ci
npm run test:coverage
npm run test:security
npm run test:performance
```

## 📋 Test Checklist

### Before Committing

- [ ] All unit tests pass
- [ ] Integration tests validate service coordination
- [ ] Security tests show no violations
- [ ] Performance tests meet target times
- [ ] No console.log statements in production code
- [ ] Test coverage above 80%

### Before Deploying

- [ ] E2E tests pass on both platforms
- [ ] Security audit shows no vulnerabilities
- [ ] Performance regression tests pass
- [ ] Accessibility tests validate screen reader support
- [ ] All CI checks pass

## 🔍 Test Metrics and Reporting

### Coverage Reports

```bash
# Generate HTML coverage report
npm run test:coverage
open coverage/lcov-report/index.html
```

### Performance Metrics

```bash
# Generate performance report
npm run test:performance > performance-report.txt

# Key metrics to monitor:
# - Average response times
# - Memory usage patterns
# - Concurrent operation handling
# - Resource optimization
```

### Security Validation

```bash
# Security test summary
npm run test:security -- --verbose | grep -E "(✅|❌|SECURITY)"

# Expected output:
# ✅ No maternal health IDs in console output
# ✅ All data properly encrypted before storage
# ✅ Error messages sanitized
# ✅ Session security validated
```

## 📚 Additional Resources

### Testing Best Practices

1. **Test Isolation**: Each test should be independent and repeatable
2. **Security First**: Always validate sensitive data protection
3. **Performance Awareness**: Monitor resource usage in tests
4. **Real User Scenarios**: E2E tests should mirror actual user behavior
5. **Accessibility**: Include screen reader and keyboard navigation tests

### Documentation Links

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Detox E2E Testing](https://github.com/wix/Detox)
- [Expo Testing Guide](https://docs.expo.dev/guides/testing-with-jest/)

### Support

For testing issues or questions:

1. Check existing test examples in `src/__tests__/`
2. Review error messages for security violations
3. Use `--verbose` flag for detailed test output
4. Consult the troubleshooting section above

---

**🔐 Security Notice**: This testing suite is specifically designed to protect maternal health record numbers. Any test failure related to data exposure should be treated as a critical security issue and addressed immediately.

**📱 Platform Support**: Tests are designed to work across iOS and Android platforms. Platform-specific behavior is handled through conditional testing logic.

**⚡ Performance**: All tests include performance validation to ensure the authentication system remains fast and responsive under various conditions.