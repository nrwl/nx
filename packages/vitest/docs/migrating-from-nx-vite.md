# Migrating from @nx/vite to @nx/vitest

## Overview

Vitest functionality has been split from `@nx/vite` into a standalone `@nx/vitest` package. This provides better separation of concerns and allows vitest to be used independently of vite.

## What Changed

### Generators

- `@nx/vite:vitest` → `@nx/vitest:configuration`

### Executors

- `@nx/vite:test` → `@nx/vitest:test`

### Plugins

- `@nx/vite/plugin` (for vitest) → `@nx/vitest/plugin`

## Migration Steps

### 1. Install @nx/vitest

```bash
npm install --save-dev @nx/vitest
# or
pnpm add -D @nx/vitest
# or
yarn add -D @nx/vitest
```

### 2. Update project.json

**Before:**

```json
{
  "targets": {
    "test": {
      "executor": "@nx/vite:test",
      "options": {
        "config": "vite.config.ts"
      }
    }
  }
}
```

**After:**

```json
{
  "targets": {
    "test": {
      "executor": "@nx/vitest:test",
      "options": {
        "config": "vite.config.ts"
      }
    }
  }
}
```

### 3. Update nx.json (if using plugin)

**Before:**

```json
{
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": {
        "testTargetName": "test"
      }
    }
  ]
}
```

**After:**

```json
{
  "plugins": [
    {
      "plugin": "@nx/vitest/plugin",
      "options": {
        "testTargetName": "test"
      }
    }
  ]
}
```

### 4. Update future generator usage

When adding vitest to new projects:

```bash
# Old
nx g @nx/vite:vitest my-project

# New
nx g @nx/vitest:configuration my-project
```

## Backward Compatibility

The old `@nx/vite:vitest` generator and `@nx/vite:test` executor still work but are deprecated. They will be removed in Nx 23. Please migrate before upgrading to Nx 23.

When you use the deprecated generators/executors, you'll see a warning message:

```
The '@nx/vite:vitest' generator is deprecated. Please use '@nx/vitest:configuration' instead.
This generator will be removed in Nx 23.
```

## No Changes Required for These Files

- **vite.config.ts / vitest.config.ts**: No changes needed
- **Test files**: No changes needed
- **vitest.config.ts**: No changes needed

## Questions?

File an issue at https://github.com/nrwl/nx/issues
