# Code Style and Conventions

## TypeScript Configuration
- Strict TypeScript with all strict checks enabled
- No implicit any, unused variables/parameters not allowed
- Explicit function return types preferred
- Path mapping with @ aliases for clean imports

## ESLint Rules
- No console statements in production code
- Import order enforced (builtin → external → internal → parent → sibling)
- Prefer const over let, no var allowed
- React hooks rules strictly enforced
- Security rules: no eval, no implied eval, no new Function

## Prettier Formatting
- 80 character line width
- 2 space indentation
- Single quotes for strings, double quotes for JSX
- Trailing commas (ES5 style)
- No semicolon insertion

## File Organization
- Components in src/components/
- Screens in src/screens/
- Services in src/services/
- Types in src/types/
- Hooks in src/hooks/
- Utils in src/utils/
- Navigation in src/navigation/
- Theme in src/theme/

## Naming Conventions
- PascalCase for components and types
- camelCase for variables, functions, and props
- SCREAMING_SNAKE_CASE for constants
- kebab-case for file names in some cases

## Component Structure
- Export default for main component
- TypeScript interfaces for props
- Proper accessibility labels
- Theme integration for styling
- Proper error handling