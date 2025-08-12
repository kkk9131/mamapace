# CRUSH.md

Project: React Native (Expo) app using TypeScript + React Navigation

Commands
- Start dev: npm run start | ios: npm run ios | android: npm run android | web: npm run web
- Typecheck: npx tsc -p tsconfig.json --noEmit
- Lint: npx eslint .
- Format: npx prettier --check . | write: npx prettier --write .
- Tests: No test runner configured. If adding Jest: npx jest; single test: npx jest path/to/file.test.tsx -t "test name"

Code style
- Language: TypeScript for new files; keep .tsx for React components, .ts for modules; avoid any; use explicit types and React.FC<Props> only when children typing needed
- Imports: absolute from src/ when configured; otherwise relative; order = react/external -> src modules -> local; styles last; no default export unless component; prefer named exports for utilities
- Formatting: Prettier defaults (2 spaces, semicolons, single quotes); keep lines <= 100 chars; one component per file
- Naming: PascalCase for components/screens (e.g., HomeScreen), camelCase for variables/functions, SCREAMING_SNAKE for constants; files match exported component name
- State: prefer React hooks; keep components pure; extract reusable UI to src/components when created
- Theming: import colors and theme from src/theme; do not hardcode colors
- Navigation: screens live in src/screens; configure in src/navigation; type routes with React Navigation types when added
- Error handling: fail fast on programmer errors; wrap async calls with try/catch; show user-friendly messages; never swallow errors; do not log secrets
- Async: use async/await; cancel effects on unmount; avoid memory leaks in useEffect
- Accessibility: add accessibilityLabel, role, and testID where applicable; support SafeAreaView
- Assets: keep in assets/; do not inline large base64
- Environment: secrets via env and Expo config; never commit keys

Notes
- Add Jest + ESLint/Prettier configs as needed. If you share exact commands, I can pin them here for quick use.
