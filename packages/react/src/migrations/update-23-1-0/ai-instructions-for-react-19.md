# React 18 -> 19 Migration Instructions for LLM

Migrate the Nx workspace's React projects from 18 to 19. Run the codemods first, fix the rest by hand, build after each project.

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

`@types/react@19`: `useRef` needs an initial arg, implicit `children` removed (declare it on props), `JSX` global moved. The types codemod handles most.

## Validate

```bash
nx run PROJECT:build
nx affected -t build,lint,test
```

## Notes for LLM

- Codemods first (API + types), then manual.
- One project at a time, build after each.
- Confirm third-party libs support React 19 before bumping.
