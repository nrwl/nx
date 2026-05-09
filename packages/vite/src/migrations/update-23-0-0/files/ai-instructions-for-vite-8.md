# Vite 8 Migration Instructions for LLM

## Overview

These instructions guide you through migrating an Nx workspace from Vite 7 to Vite 8. Vite 8 swaps Rollup for Rolldown as its bundler and updates a number of plugin APIs. Work through each section in order and run tests after each change.

## Pre-Migration Checklist

1. **Identify all Vite-using projects**:

   ```bash
   nx show projects --with-target build
   nx show projects --with-target serve
   ```

2. **Locate all Vite configuration files**:
   - Search for `vite.config.{ts,js,mts,mjs,cts,cjs}`
   - Check `project.json` files for inline Vite-related options

3. **Cypress Component Testing**: Cypress >= 15.14.0 supports Vite 8. The `nx migrate` step bumps Cypress automatically. If you have explicitly pinned Cypress below 15.14.0, upgrade it before bumping Vite.

## Migration Steps by Category

### 1. Rename `rollupOptions` to `rolldownOptions`

The `nx migrate` codemod handles this automatically for `vite.config.{ts,js,mts,mjs,cts,cjs}` files. If you have `rollupOptions` declared elsewhere (e.g., in helper modules imported by your config), rename them by hand.

**Search Pattern**: `rollupOptions` in any TypeScript/JavaScript file

```typescript
// ❌ BEFORE (Vite 7)
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['react'],
      output: { manualChunks: { vendor: ['react', 'react-dom'] } },
    },
  },
});

// ✅ AFTER (Vite 8)
export default defineConfig({
  build: {
    rolldownOptions: {
      external: ['react'],
      output: { manualChunks: { vendor: ['react', 'react-dom'] } },
    },
  },
});
```

**Action Items**:

- [ ] Verify the codemod picked up every config file (`rg "rollupOptions"` should return zero hits inside vite configs)
- [ ] Rename any `rollupOptions` in helper modules or shared config builders
- [ ] Update CI scripts that parse `build.rollupOptions` (e.g., custom bundle-size assertions)

### 2. `@vitejs/plugin-react` v6 (Oxc Replaces Babel)

`@vitejs/plugin-react@^6` is required for Vite 8 and uses [Oxc](https://oxc.rs/) instead of Babel for JSX transformation. The plugin's `babel` option is gone.

```typescript
// ❌ BEFORE (Vite 7, plugin-react v4)
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-styled-components'],
      },
    }),
  ],
});

// ✅ AFTER (Vite 8, plugin-react v6)
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

**Action Items**:

- [ ] Remove `babel` options from `react()` plugin invocations
- [ ] If you depended on a Babel plugin (e.g., styled-components, emotion, relay), find an Oxc-compatible replacement or switch to `@vitejs/plugin-react-swc` (still Babel-free). There is no drop-in for arbitrary Babel plugins.
- [ ] If you cannot drop your Babel plugin, stay on Vite 7 + plugin-react v4 for now (see "Project-Level Vite 7 Pinning")
- [ ] Run `pnpm install` (or your package manager equivalent) so the new plugin-react version resolves

### 3. Angular + Vitest: Add `@oxc-project/runtime`

`@angular/build` depends on `rolldown`, which injects `@oxc-project/runtime` helpers at transform time but does not declare it as a dependency. Angular projects using Vitest will fail at runtime unless `@oxc-project/runtime` is installed explicitly.

**Search Pattern**: Projects using both `@angular/build` and Vitest

```bash
rg "@angular/build" package.json
rg "@nx/vitest:test|@nx/vite:test" --type json
```

**Action Items**:

- [ ] For each Angular project with Vitest, add `@oxc-project/runtime` to root `devDependencies`
- [ ] Run `pnpm install` (or equivalent)
- [ ] Run the project's tests to confirm the helper resolves at runtime

### 4. Type Resolution Under `moduleResolution: "node"`

Vite 8 ships its types as `.d.mts` files, which TypeScript cannot resolve under `moduleResolution: "node"`. Symptoms include type errors on `defineConfig`, `UserConfig`, or plugin return types.

**Action Items**:

- [ ] Update affected `tsconfig*.json` files: `"moduleResolution": "bundler"` (recommended) or `"node16"`/`"nodenext"`
- [ ] If you cannot change `moduleResolution`, narrow the impact with explicit `as any` casts at vite imports. The Nx-generated configs already do this in a handful of places.
- [ ] Run `tsc --noEmit` after the change to confirm types resolve cleanly

### 5. Bundle Validation Scripts

Rolldown produces different chunk and module counts than Rollup for the same input. Custom build validation (e.g., "bundle has exactly N chunks") will need to be re-baselined.

**Action Items**:

- [ ] Identify scripts that assert chunk/module counts or names
- [ ] Re-run the build and update expected values
- [ ] Prefer asserting on size budgets over exact counts going forward

### 6. Project-Level Vite 7 Pinning (Custom Babel Plugins)

If a project depends on a Babel plugin that has no Oxc equivalent, pin that project to Vite 7.

```jsonc
// package.json (workspace root)
{
  "devDependencies": {
    "vite": "^7.1.0",
    "@vitejs/plugin-react": "^4.3.0",
  },
}
```

If only some projects need to stay on 7 while the rest move to 8, use your package manager's overrides feature:

- pnpm: `pnpm.overrides` in root `package.json`
- npm/yarn: `overrides`/`resolutions`

**Action Items**:

- [ ] Document which projects are pinned to Vite 7 and why
- [ ] Track Oxc plugin equivalents so you can unpin later

## Post-Migration Validation

### 1. Run Tests Per Project

```bash
nx run-many -t test -p PROJECT_NAME
```

### 2. Build All Affected Projects

```bash
nx affected -t build
```

### 3. Validate Dev Server

```bash
nx serve PROJECT_NAME
```

Open the app and verify HMR still works for changes in source files.

### 4. Validate CI Pipeline

```bash
nx prepush
```

### 5. Review Migration Checklist

- [ ] All `rollupOptions` references renamed to `rolldownOptions`
- [ ] `@vitejs/plugin-react` upgraded to v6 (or pinned to v4 with a documented reason)
- [ ] No `babel: { ... }` options remain in `react()` calls (or those projects are pinned to Vite 7)
- [ ] Angular + Vitest projects have `@oxc-project/runtime` installed
- [ ] Cypress upgraded by `nx migrate` (>= 15.14.0 for Vite 8 support)
- [ ] `tsc --noEmit` passes on all affected projects
- [ ] Build, test, and dev-server commands all succeed

## Common Issues and Solutions

### Issue: `Cannot find name 'rollupOptions'` or build options ignored

**Solution**: Rename to `rolldownOptions`. Vite 8 ignores `rollupOptions` silently in some paths.

### Issue: Babel plugin no longer applied (e.g., styled-components classNames missing)

**Solution**: `@vitejs/plugin-react@6` removed Babel. Find an Oxc-compatible alternative, switch to `@vitejs/plugin-react-swc`, or pin to Vite 7 + plugin-react v4.

### Issue: Angular + Vitest fails with `Cannot find module '@oxc-project/runtime/...'`

**Solution**: Add `@oxc-project/runtime` to root `devDependencies` and reinstall.

### Issue: Type errors on `defineConfig`, `UserConfig`, or `Plugin` imports from vite

**Solution**: Set `moduleResolution: "bundler"` in your tsconfig (or `nodenext` if you need Node-style resolution).

### Issue: Cypress CT fails to start under Vite 8

**Solution**: Confirm `cypress >= 15.14.0` is installed (Vite 8 support landed in that release). `nx migrate` bumps Cypress automatically; if you pinned it lower in `package.json`, remove the pin and reinstall.

### Issue: Bundle-size or chunk-count assertions fail after upgrade

**Solution**: Rolldown chunks differently than Rollup. Re-baseline expected values.

## Files to Review

```bash
# Vite config files
find . -name "vite.config.*" -not -path "*/node_modules/*"

# Cypress component testing setup
rg "@nx/(angular|react|next|remix)/plugins/component-testing"

# Babel plugin usage in plugin-react
rg "@vitejs/plugin-react.*babel|babel:\s*\{" --type ts --type js

# Angular projects with Vitest
rg "@angular/build" -l package.json
```

## Guard Rails

DO NOT

- Force tests to pass by removing assertions or replacing them with `expect(true).toBe(true)`
- Strip `react()` plugin options without finding an equivalent for what they did
- Roll Cypress back below 15.14.0 after the migrate. Older Cypress fails to start under Vite 8.

---

## Notes for LLM Execution

When executing this migration:

1. **Work systematically**: Complete one category before moving to the next
2. **Test after each change**: Build and test affected projects after each step
3. **Keep user informed**: Report which categories applied and which were skipped
4. **Use TodoWrite tool**: Track migration progress for visibility
5. **Stop and ask** if a project depends on a Babel plugin with no Oxc equivalent. Pinning to Vite 7 is a workspace decision.
