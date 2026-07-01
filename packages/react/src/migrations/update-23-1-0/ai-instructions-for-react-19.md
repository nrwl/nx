# React 18 -> 19 Migration Instructions for LLM

Migrate the Nx workspace's React projects from 18 to 19. Run the codemods first, fix the rest by hand, typecheck and build after each project.

## Step 1: Codemods

```bash
npx codemod@latest react/19/migration-recipe
npx types-react-codemod@latest preset-19 ./PROJECT_PATH
```

First handles API changes, second handles `@types/react` 19 types. Review the diffs.

`preset-19` is interactive (prompts per codemod). For a non-interactive run, the two that clear the most common type errors are:

```bash
npx types-react-codemod@latest useRef-required-initial ./PROJECT_PATH  # useRef() -> useRef(initialValue); 19 dropped the zero-arg overload
npx types-react-codemod@latest refobject-defaults ./PROJECT_PATH       # RefObject<T> -> RefObject<T | null>; covers both ref sites and helper param signatures
```

## Step 2: Removed APIs (fix by hand if codemod misses)

- `ReactDOM.render` / `hydrate` -> `createRoot` / `hydrateRoot` from `react-dom/client`. Note `hydrateRoot(container, element)` swaps the arg order vs `hydrate`.
- `ReactDOM.unmountComponentAtNode` -> keep the root from `createRoot` / `hydrateRoot` and call `root.unmount()`.
- `ReactDOM.findDOMNode` -> use refs.
- `propTypes` -> removed for ALL components (class and function); drop it, use TS types.
- `defaultProps` -> removed for FUNCTION components (use default params); still works on classes.
- Legacy string refs -> callback refs or `useRef`.
- Legacy Context: consumer `contextTypes` and provider `childContextTypes` / `getChildContext` -> `createContext`.
- `react-test-renderer` is deprecated -> migrate tests to `@testing-library/react`.

## Step 3: ref as prop

`forwardRef` is no longer needed; `ref` is a normal prop. Existing `forwardRef` calls still work (deprecated).

## Step 4: Types

`@types/react@19` moves the `JSX` namespace out of global scope into the `react` module (`React.JSX`); `useRef` needs an initial arg; implicit `children` is removed (declare it on props). The `scoped-jsx` codemod (part of `preset-19`) rewrites JSX type _usages_: it points `JSX.Element`, `JSX.IntrinsicElements`, and the like at the `react`-scoped namespace.

It does NOT rewrite global `JSX` _augmentations_. A custom element or web component typed with a global augmentation:

```ts
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'my-element': ...;
    }
  }
}
```

no longer merges into the JSX that React resolves under the automatic runtime (`jsx: "react-jsx"`), so the element becomes a `TS2339` unknown-property error in every consuming `.tsx`. Re-target the augmentation at the `react` module:

```ts
import type {} from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'my-element': ...;
    }
  }
}
```

The `import type {} from 'react'` is required when the file (or its tsconfig `types`) does not otherwise pull in `react`; without `react` in the program the augmentation fails with `TS2664: Invalid module name in augmentation`. Keep any `eslint-disable` comment already on the `namespace` line.

## Validate

Run build and typecheck across the affected projects, then lint and test:

```bash
nx run PROJECT:build
nx affected -t build,typecheck,lint,test
```

Most React 19 breakages are type-level (the `JSX` namespace move, implicit `children`, ref types) and surface only at `typecheck`, not at `build` or `test`. A type change in a shared library often errors only in its consumers, so re-run until every project that depends on what you changed is green, not just the project you edited.

## Notes for LLM

- Codemods first (API + types), then manual.
- One project at a time; typecheck and build after each.
- A custom element or JSX augmentation may live in a non-React library that React code pulls in through a bare side-effect import (`import '@scope/ui';`). Fix it there; `typecheck` on the consumers points you to it.
- Confirm third-party libs support React 19 before bumping.

## References

- React 19 upgrade guide (the TypeScript section covers the `JSX`, `useRef`, and `ref` changes): https://react.dev/blog/2024/04/25/react-19-upgrade-guide
- `types-react-codemod` (what each codemod does, including `scoped-jsx`): https://github.com/eps1lon/types-react-codemod
