# Repository Guidelines

## Project Structure & Modules
- App core: `src/` with feature folders: `components/`, `screens/`, `services/`, `hooks/`, `utils/`, `navigation/`, `theme/`, `types/`, `contexts/`, `config/`.
- Tests: co-located `__tests__/` in each area (e.g., `src/services/__tests__/...`, `src/screens/__tests__/...`).
- Mobile runtime: Expo/React Native entry (`App.js`, `index.js`). Native iOS files live under `ios/`.
- Backend schema: Supabase SQL in `supabase/sql/*.sql`; Edge Functions in `supabase/functions/*`.
- Assets and docs: `assets/`, `docs/`.

## Build, Test, and Dev Commands
- `npm start` — run Expo bundler locally (QR preview, web via `--web`).
- `npm run ios` / `npm run android` — build & run on simulator/emulator.
- `npm test` — run Jest unit tests. Variants: `test:watch`, `test:coverage`.
- `npm run test:integration` / `test:security` / `test:performance` — scoped suites if present.
- `npm run lint` / `lint:check` — ESLint (auto-fix or check).
- `npm run format` / `format:check` — Prettier format or verify.

## Coding Style & Naming
- Language: TypeScript + React Native.
- Formatting (Prettier): 2 spaces, width 80, single quotes, semicolons, trailing commas (es5), LF EOL, `arrowParens: avoid`.
- Lint (ESLint): no console in app code, enforce `prefer-const`, strict hooks rules, ordered imports with blank lines.
- Naming: components `PascalCase.tsx`, hooks `useThing.ts`, tests `*.test.ts(x)`, service modules `somethingService.ts`.

## Testing Guidelines
- Framework: `jest-expo` + `@testing-library/react-native`.
- Location: place tests under nearest `__tests__/` or `*.test.ts(x)` beside code.
- Coverage: configured via Jest; run `npm run test:coverage` to generate lcov/html.
- CI runs unit/integration/security/performance; keep tests deterministic and RN-safe.

## Commit & PR Guidelines
- Conventional prefixes from history: `feat:`, `fix:`, `chore:`, `refactor:`, `sec:`; scope in parentheses when useful, e.g., `fix(anon-v2): ...`.
- Commits should be small and focused. Reference issues like `#123`.
- PRs: clear description, rationale, screenshots for UI changes, steps to test, and linked issues. Ensure `npm run lint` and `npm test` pass locally.

## Security & Configuration
- Do not commit secrets. Use `.env` based on `.env.example`; Expo SecureStore for sensitive runtime values.
- Supabase: apply schema changes under `supabase/sql/` and keep Edge Functions in `supabase/functions/` versioned.
