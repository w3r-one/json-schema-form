# Repository Guidelines

## Project Structure & Module Organization

This package renders React forms from JSON Schema definitions. Source files live
in `src/`: `Form.tsx` contains the main component, `types.ts` defines the public
types, and `index.ts` exports the package API. Keep unit tests next to the code
they cover (for example, `src/Form.test.tsx`) and Storybook examples in
`*.stories.tsx` files. TypeScript build output is generated in `lib/` and must
not be edited manually.

## Build, Test, and Development Commands

- `npm install` installs dependencies.
- `npm run build` compiles TypeScript declarations and JavaScript to `lib/`.
- `npm run typecheck` runs the production TypeScript configuration without
  emitting output.
- `npm test` runs the Vitest unit project once in jsdom.
- `npm run test:watch` runs unit tests interactively.
- `npm run storybook` starts Storybook on port 6006; `npm run test-storybook`
  runs Storybook tests in headless Chromium.
- `npm run lint` lints `src/` with ESLint.

Run `npm run lint`, `npm run typecheck`, and the relevant tests before opening a
pull request.

## Coding Style & Naming Conventions

Use TypeScript and React function components. The codebase uses tabs for
indentation, double-quoted strings, and semicolons; follow the surrounding file
and let Prettier-compatible formatting preserve that style. Use PascalCase for
React components and their filenames (`Form.tsx`), camelCase for values and
functions, and descriptive `*.test.tsx` / `*.stories.tsx` suffixes. The
TypeScript configuration is strict, including unused-code and unchecked-index
checks: avoid `any`, account for absent values, and keep public types explicit.

## Testing Guidelines

Write behavior-focused Vitest tests with Testing Library. Unit tests are matched
by `src/**/*.test.ts` and `src/**/*.test.tsx`; use jsdom and the shared
`vitest.setup.ts` assertions. Add or update a Storybook story when a UI state is
useful for review, then verify it with `npm run test-storybook` when browser
coverage applies.

## Commit & Pull Request Guidelines

Use Conventional Commit-style subjects, as in `fix: ensure built files are
published` or `chore(publish): update publish config`. Keep commits focused;
use a scope where it clarifies the affected area. Pull requests should explain
the behavior change, link the relevant issue when available, list validation
commands run, and include screenshots for visible UI changes. Do not commit
generated `lib/` output unless a release workflow specifically requires it.
