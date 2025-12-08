# Nuxt 3 to Nuxt 4 Migration Instructions

This document provides instructions for an AI Agent to assist with migrating Nuxt 3 projects to Nuxt 4.

## Pre-Migration Checklist

Before starting the migration, run these commands to understand the scope:

```bash
# List all Nuxt projects in the workspace
nx show projects --with-target build | xargs -I {} sh -c 'cat {}/nuxt.config.ts 2>/dev/null && echo "Project: {}"' | grep -B1 "Project:"

# Find all files that may need updates
find . -name "*.vue" -o -name "*.ts" | head -50
```

---

## Section 1: Configuration Updates

### 1.1 Directory Structure (Optional but Recommended)

**Search Pattern**: Check `nuxt.config.ts` for `srcDir` configuration

Nuxt 4 introduces a new default directory structure using `app/` instead of `src/`.

**If adopting new structure:**

```typescript
// Before (Nuxt 3 with srcDir)
export default defineNuxtConfig({
  srcDir: 'src',
});

// After (Nuxt 4 - remove srcDir, move files to app/)
export default defineNuxtConfig({
  // srcDir removed - app/ is now the default
});
```

**Action Items:**

- [ ] Move `src/` contents to `app/` directory
- [ ] Keep `server/`, `public/`, `layers/`, `modules/` at project root
- [ ] Remove `srcDir` from `nuxt.config.ts`

**OR to keep existing structure:**

```typescript
export default defineNuxtConfig({
  srcDir: '.',
  dir: { app: 'app' },
});
```

### 1.2 Remove Deprecated `generate` Configuration

**Search Pattern**: `grep -r "generate:" --include="nuxt.config.ts"`

```typescript
// Before
export default defineNuxtConfig({
  generate: {
    exclude: ['/admin'],
    routes: ['/sitemap.xml'],
  },
});

// After
export default defineNuxtConfig({
  nitro: {
    prerender: {
      ignore: ['/admin'],
      routes: ['/sitemap.xml'],
    },
  },
});
```

### 1.3 TypeScript Configuration

**Search Pattern**: Check `tsconfig.json` files

Nuxt 4 sets `noUncheckedIndexedAccess: true` by default.

**To override if needed:**

```typescript
export default defineNuxtConfig({
  typescript: {
    tsConfig: {
      compilerOptions: {
        noUncheckedIndexedAccess: false,
      },
    },
  },
});
```

---

## Section 2: Data Fetching Updates

### 2.1 Default Values Changed from `null` to `undefined`

**Search Pattern**: `grep -rn "!== null\|=== null" --include="*.vue" --include="*.ts"`

```typescript
// Before (Nuxt 3)
const { data } = await useAsyncData('key', () => fetch('/api/data'));
if (data.value !== null) {
  /* ... */
}

// After (Nuxt 4)
const { data } = await useAsyncData('key', () => fetch('/api/data'));
if (data.value !== undefined) {
  /* ... */
}
```

**Automation available:**

```bash
npx codemod@latest nuxt/4/default-data-error-value
```

### 2.2 `getCachedData` Context Parameter

**Search Pattern**: `grep -rn "getCachedData" --include="*.vue" --include="*.ts"`

```typescript
// Before
getCachedData: (key, nuxtApp) => cachedData[key];

// After
getCachedData: (key, nuxtApp, ctx) => {
  // ctx.cause: 'initial' | 'refresh:hook' | 'refresh:manual' | 'watch'
  if (ctx.cause === 'refresh:manual') return undefined;
  return cachedData[key];
};
```

### 2.3 Shallow Data Reactivity

**Search Pattern**: `grep -rn "useAsyncData\|useFetch" --include="*.vue" --include="*.ts"`

Data from `useAsyncData`/`useFetch` is now `shallowRef` (not deep reactive).

```typescript
// If deep reactivity is needed:
const { data } = useFetch('/api/test', { deep: true });
```

**Automation available:**

```bash
npx codemod@latest nuxt/4/shallow-function-reactivity
```

### 2.4 Removed `dedupe` Boolean Values

**Search Pattern**: `grep -rn "dedupe: true\|dedupe: false" --include="*.vue" --include="*.ts"`

```typescript
// Before
refresh({ dedupe: true });
refresh({ dedupe: false });

// After
refresh({ dedupe: 'cancel' });
refresh({ dedupe: 'defer' });
```

**Automation available:**

```bash
npx codemod@latest nuxt/4/deprecated-dedupe-value
```

### 2.5 Unique Keys for Shared Prerender Data

**Search Pattern**: Check dynamic route files `[*.vue` in `pages/`

```typescript
// Before (unsafe for dynamic routes)
const { data } = await useAsyncData(async () =>
  $fetch(`/api/page/${route.params.slug}`)
);

// After (safe - key includes slug)
const { data } = await useAsyncData(route.params.slug, async () =>
  $fetch(`/api/page/${route.params.slug}`)
);
```

---

## Section 3: Unhead v2 Migration

### 3.1 Remove Deprecated Props

**Search Pattern**: `grep -rn "hid:\|vmid:\|children:\|body:" --include="*.vue" --include="*.ts"`

```typescript
// Before
useHead({
  meta: [{ name: 'description', hid: 'description', content: 'My page' }],
  script: [{ children: 'console.log("hello")' }],
});

// After
useHead({
  meta: [{ name: 'description', content: 'My page' }],
  script: [{ innerHTML: 'console.log("hello")' }],
});
```

---

## Section 4: Component and Routing Changes

### 4.1 Normalized Component Names

**Search Pattern**: Check test files using `findComponent` and templates with `<KeepAlive>`

```typescript
// Component in SomeFolder/MyComponent.vue
// Before: findComponent({ name: 'MyComponent' })
// After: findComponent({ name: 'SomeFolderMyComponent' })
```

**To disable if needed:**

```typescript
export default defineNuxtConfig({
  experimental: {
    normalizeComponentNames: false,
  },
});
```

### 4.2 Route Metadata Deduplication

**Search Pattern**: `grep -rn "route.meta.name\|route.meta.path" --include="*.vue" --include="*.ts"`

```typescript
// Before
const name = route.meta.name;

// After
const name = route.name;
```

---

## Section 5: Removed Experimental Flags

These flags are now hardcoded and cannot be configured:

- `experimental.treeshakeClientOnly` → always `true`
- `experimental.configSchema` → always `true`
- `experimental.polyfillVueUseHead` → always `false`
- `experimental.respectNoSSRHeader` → always `false`

**Action Items:**

- [ ] Remove these from `nuxt.config.ts` if present

---

## Section 6: Error Handling

### 6.1 Parsed `error.data`

**Search Pattern**: `grep -rn "JSON.parse.*error.data\|error.data.*JSON.parse" --include="*.vue" --include="*.ts"`

```typescript
// Before
const data = JSON.parse(error.data);

// After (data is already parsed)
const data = error.data;
```

---

## Section 7: Module and Build Changes

### 7.1 Absolute Watch Paths in `builder:watch`

**Search Pattern**: Check custom modules using `builder:watch` hook

```typescript
import { relative, resolve } from 'node:fs';

nuxt.hook('builder:watch', async (event, path) => {
  // Convert to relative path for backward/forward compatibility
  path = relative(nuxt.options.srcDir, resolve(nuxt.options.srcDir, path));
});
```

### 7.2 Template Compilation Changes

**Search Pattern**: Check modules using `addTemplate` with EJS syntax

```typescript
// Before (using lodash template)
addTemplate({
  fileName: 'plugin.js',
  src: './runtime/plugin.ejs',
});

// After (using getContents)
import { template } from 'es-toolkit/compat';

addTemplate({
  fileName: 'plugin.js',
  getContents({ options }) {
    const contents = readFileSync('./runtime/plugin.ejs', 'utf-8');
    return template(contents)({ options });
  },
});
```

---

## Section 8: ESLint Configuration (Flat Config Only)

> **Note:** This section only applies if your workspace uses ESLint flat config (`eslint.config.js`, `eslint.config.mjs`, or `eslint.config.cjs`). If you're using legacy `.eslintrc.json`, no changes are required.

### 8.1 Migrate to `createConfigForNuxt`

**Search Pattern**: Check for `eslint.config.js`, `eslint.config.mjs`, or `eslint.config.cjs` in Nuxt project directories

For workspaces using ESLint flat config, Nuxt 4 requires updating to `@nuxt/eslint-config` version `^1.10.0` and using `createConfigForNuxt` from `@nuxt/eslint-config/flat`.

**Before (Nuxt 3 flat config):**

```javascript
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: '@typescript-eslint/parser' },
    },
  },
  {
    ignores: ['.nuxt/**', '.output/**', 'node_modules'],
  },
];
```

**After (Nuxt 4 flat config - eslint.config.mjs):**

```javascript
import { createConfigForNuxt } from '@nuxt/eslint-config/flat';
import baseConfig from '../../eslint.config.mjs';

export default createConfigForNuxt({
  features: {
    typescript: true,
  },
})
  .prepend(...baseConfig)
  .append(
    {
      files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue'],
      rules: {},
    },
    {
      ignores: ['.nuxt/**', '.output/**', 'node_modules'],
    }
  );
```

**For CJS (eslint.config.cjs):**

```javascript
const { createConfigForNuxt } = require('@nuxt/eslint-config/flat');
const baseConfig = require('../../eslint.config.cjs');

module.exports = createConfigForNuxt({
  features: {
    typescript: true,
  },
})
  .prepend(...baseConfig)
  .append(
    {
      files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue'],
      rules: {},
    },
    {
      ignores: ['.nuxt/**', '.output/**', 'node_modules'],
    }
  );
```

**Action Items (Flat Config Only):**

- [ ] Update `@nuxt/eslint-config` to `^1.10.0` in `package.json`
- [ ] Replace manual Vue/TypeScript parser config with `createConfigForNuxt`
- [ ] Use `features.typescript: true` option for TypeScript support
- [ ] Remove `@typescript-eslint/parser` from devDependencies (handled automatically)
- [ ] Use `.prepend()` for base configs and `.append()` for project-specific rules/ignores

### 8.2 Understanding the New Config Structure

The `createConfigForNuxt` function returns a chainable config builder:

- **`features.typescript: true`** - Enables TypeScript support with proper Vue file parsing
- **`.prepend(...configs)`** - Adds configs at the beginning (useful for workspace base configs)
- **`.append(...configs)`** - Adds configs at the end (for project-specific rules and ignores)

---

## Post-Migration Validation

After completing the migration, run these commands:

```bash
# 1. Install updated dependencies
npm install

# 2. Run Nuxt prepare
npx nuxi prepare

# 3. Type check
npx nuxi typecheck

# 4. Build the application
nx build <project-name>

# 5. Run tests
nx test <project-name>

# 6. Start dev server to verify
nx serve <project-name>
```

---

## Quick Migration Commands

Nuxt provides codemods to automate many changes:

```bash
# Run the full migration recipe
npx codemod@0.18.7 nuxt/4/migration-recipe

# Or run individual codemods:
npx codemod@latest nuxt/4/file-structure
npx codemod@latest nuxt/4/default-data-error-value
npx codemod@latest nuxt/4/shallow-function-reactivity
npx codemod@latest nuxt/4/deprecated-dedupe-value
npx codemod@latest nuxt/4/template-compilation-changes
npx codemod@latest nuxt/4/absolute-watch-path
```

---

## Common Issues and Solutions

### Issue: White flash on initial load

**Solution:** This is expected behavior - SPA loading template now renders outside `#__nuxt`. To revert:

```typescript
experimental: {
  spaLoadingTemplateLocation: 'within';
}
```

### Issue: Global CSS not inlined

**Solution:** Only component CSS is inlined by default. To inline all CSS:

```typescript
features: {
  inlineStyles: true;
}
```

### Issue: Middleware index files being registered

**Solution:** Filter unwanted middleware:

```typescript
hooks: {
  'app:resolve'(app) {
    app.middleware = app.middleware.filter(mw => !/\/index\.[^/]+$/.test(mw.path))
  }
}
```

---

## Files to Review

```bash
# Find all Vue files
find . -name "*.vue" -not -path "./node_modules/*"

# Find all nuxt config files
find . -name "nuxt.config.*" -not -path "./node_modules/*"

# Find composables using data fetching
grep -rn "useAsyncData\|useFetch\|getCachedData" --include="*.vue" --include="*.ts" | grep -v node_modules
```

---

## Notes for AI Agent

1. **Work systematically** through each section
2. **Run codemods first** where available, then manually fix remaining issues
3. **Test incrementally** - run `nx build` and `nx test` after each major change
4. **Document changes** as you make them for user review
5. **Handle errors gracefully** - if a file doesn't exist or a pattern isn't found, continue to the next item

---

## References

- [Official Nuxt 4 Upgrade Guide](https://nuxt.com/docs/4.x/getting-started/upgrade)
- [Nuxt 4 Announcement Blog](https://nuxt.com/blog/v4)
- [Nuxt GitHub Repository](https://github.com/nuxt/nuxt)
