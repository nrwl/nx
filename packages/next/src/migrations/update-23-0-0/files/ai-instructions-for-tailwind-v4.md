# Migration Instructions for LLM: Remove `@nx/next/tailwind` usage

## Context

In Nx 23, `@nx/next/tailwind` has been removed. The `createGlobPatternsForDependencies` function it exported is no longer needed with Tailwind CSS v4, which uses `@source` directives in CSS instead of JavaScript-based glob configuration.

## Pre-Migration Checklist

Run these commands to identify affected files:

```bash
# Find files importing from @nx/next/tailwind
grep -r "@nx/next/tailwind" --include="*.js" --include="*.ts" --include="*.mjs" --include="*.cjs" .

# Find tailwind config files that might use createGlobPatternsForDependencies
grep -r "createGlobPatternsForDependencies" --include="*.js" --include="*.ts" --include="*.mjs" --include="*.cjs" .
```

## Migration Steps

### Step 1: Remove `@nx/next/tailwind` imports

For each file that imports from `@nx/next/tailwind` (typically `tailwind.config.js` or `tailwind.config.ts`):

**Before:**

```js
const { createGlobPatternsForDependencies } = require('@nx/next/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, 'src/**/*.{js,ts,jsx,tsx,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: { extend: {} },
  plugins: [],
};
```

**After (Tailwind CSS v4):**

Replace the entire `tailwind.config.js` with `@source` directives in your main CSS file (the one containing `@import 'tailwindcss'`):

```css
@import 'tailwindcss';

/* Add @source directives for each dependency's source directory */
@source '../../libs/shared/ui/src';
@source '../../libs/feature/components/src';
```

### Step 2: Remove tailwind config files (if migrating to Tailwind v4)

If you are migrating to Tailwind CSS v4:

1. Delete `tailwind.config.js` / `tailwind.config.ts` files
2. Delete `postcss.config.js` files (Tailwind v4 uses `@tailwindcss/postcss` or `@tailwindcss/vite` instead)
3. Ensure your CSS entry point uses `@import 'tailwindcss'` instead of `@tailwind base; @tailwind components; @tailwind utilities;`

### Step 3: Also check for `@nx/react/tailwind` and `@nx/angular/tailwind`

These barrel exports have also been removed in Nx 23. Apply the same migration pattern.

```bash
grep -r "@nx/react/tailwind\|@nx/angular/tailwind\|@nx/vue/tailwind" --include="*.js" --include="*.ts" --include="*.mjs" --include="*.cjs" .
```

## Validation

After migration, verify:

1. No imports from `@nx/next/tailwind`, `@nx/react/tailwind`, `@nx/angular/tailwind`, or `@nx/vue/tailwind` remain
2. Tailwind styles are still applied correctly (run your dev server and visually check)
3. All `@source` directives point to valid directories

## Reference

- [Configuring Tailwind CSS sources for monorepos](https://nx.dev/docs/technologies/react/guides/using-tailwind-css-in-react#configuring-sources-for-monorepos)
- [Tailwind CSS v4 documentation](https://tailwindcss.com/docs)
