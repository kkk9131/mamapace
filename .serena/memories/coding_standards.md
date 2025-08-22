# Coding Standards and Conventions

## Code Style
- **Language**: TypeScript with strict typing
- **Formatting**: Prettier with 2-space indentation
- **Linting**: ESLint with React Native and TypeScript rules
- **Import Order**: External libraries → Internal modules → Relative imports

## TypeScript Standards
- Use explicit function return types (`@typescript-eslint/explicit-function-return-type: 'warn'`)
- Avoid `any` type (`@typescript-eslint/no-explicit-any: 'warn'`)
- Prefer `const` over `let` (`@typescript-eslint/prefer-const: 'error'`)
- Use underscore prefix for unused parameters (`argsIgnorePattern: '^_'`)

## React/React Native Standards
- Functional components with hooks (no class components)
- Custom hooks for reusable logic
- Context API for state management
- No inline styles (`react-native/no-inline-styles: 'warn'`)
- Split platform components when needed
- Use TypeScript for prop validation (no PropTypes)

## Component Structure
```typescript
// Import order: external → internal → relative
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/theme';

// Props interface
interface ComponentProps {
  title: string;
  onPress?: () => void;
}

// Main component with explicit return type
export default function Component({ title, onPress }: ComponentProps): JSX.Element {
  const { colors } = useTheme();
  
  return (
    <View style={{ backgroundColor: colors.surface }}>
      <Text>{title}</Text>
    </View>
  );
}
```

## File Naming
- Components: PascalCase (e.g., `PostCard.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useChat.ts`)
- Services: camelCase with `Service` suffix (e.g., `authService.ts`)
- Types: camelCase (e.g., `auth.ts`, `post.ts`)
- Tests: Same as source file with `.test.ts` suffix

## Security Standards
- No console usage in production (`no-console: 'error'`)
- No eval or function constructors
- Secure imports and exports
- Input validation and sanitization
- Proper error handling with user-friendly messages

## Performance Standards
- Avoid inline styles
- Use React.memo for expensive components
- Optimize image loading
- Implement proper list virtualization for large datasets