# Codebase Structure

## Directory Organization

```
src/
├── __tests__/         # Global test setup and utilities
├── components/        # Reusable UI components
├── contexts/          # React context providers for global state
├── hooks/             # Custom React hooks for business logic
├── navigation/        # Navigation setup and routing
├── screens/           # Screen components (main app views)
├── services/          # API services and business logic
├── theme/             # Theme configuration and styling
├── types/             # TypeScript type definitions
├── utils/             # Utility functions and helpers
└── config/           # App configuration files
```

## Key Files
- `App.js` - Root application component with gradient background
- `package.json` - Dependencies and scripts configuration
- `tsconfig.json` - TypeScript configuration with path mapping

## Path Mapping
The project uses TypeScript path mapping for clean imports:
- `@/*` → `src/*`
- `@/components/*` → `src/components/*`
- `@/screens/*` → `src/screens/*`
- `@/services/*` → `src/services/*`
- `@/utils/*` → `src/utils/*`
- `@/types/*` → `src/types/*`
- `@/contexts/*` → `src/contexts/*`
- `@/navigation/*` → `src/navigation/*`
- `@/theme/*` → `src/theme/*`
- `@/config/*` → `src/config/*`

## Architecture Patterns
- **Screens**: Full-page components that handle navigation and layout
- **Components**: Reusable UI elements with consistent styling
- **Hooks**: Business logic abstraction with React hooks pattern
- **Services**: API interaction and data transformation layer
- **Types**: Comprehensive TypeScript interfaces for type safety
- **Contexts**: Global state management using React Context API

## File Naming Conventions
- React components: PascalCase (e.g., `ChannelScreen.tsx`)
- Hooks: camelCase starting with 'use' (e.g., `useRooms.ts`)
- Services: camelCase with 'Service' suffix (e.g., `authService.ts`)
- Types: camelCase with descriptive names (e.g., `room.ts`)
- Utilities: camelCase (e.g., `formValidation.ts`)

## Import Organization
The project follows organized import structure:
1. React and React Native imports
2. Third-party library imports
3. Internal imports (contexts, hooks, services)
4. Type imports
5. Relative imports