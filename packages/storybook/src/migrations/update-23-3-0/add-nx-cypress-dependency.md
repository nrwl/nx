#### Add `@nx/cypress` to `devDependencies` when the workspace uses it

`@nx/storybook` no longer installs `@nx/cypress`. It is now an optional peer dependency, so workspaces that use Storybook without Cypress no longer install it.

A workspace that uses `@nx/cypress` without declaring it in the root `package.json` could still resolve the copy `@nx/storybook` installed. This migration adds `@nx/cypress` to the root `devDependencies` when the root `package.json` does not list it in `dependencies` or `devDependencies` and the workspace uses it in any of these places:

- A project target or an `nx.json` `targetDefaults` entry with an `@nx/cypress:*` executor.
- An `@nx/cypress` plugin registered in the `nx.json` `plugins` array.
- An `import`, `export ... from`, `import x = require()`, `require()`, `require.resolve()`, `import()` or `import()` type of `@nx/cypress`, one of its subpaths, or `@nx/storybook/presets/cypress` in a `.ts`, `.tsx`, `.cts`, `.mts`, `.js`, `.jsx`, `.cjs` or `.mjs` file that is not ignored by `.gitignore` or `.nxignore`.

Workspaces that already declare `@nx/cypress`, or reference it in none of these places, are left unchanged. If a file that mentions `@nx/cypress` or `@nx/storybook/presets/cypress` has syntax errors and no reference is found elsewhere, the migration lists the file in its next steps so you can check it and add `@nx/cypress` yourself.

#### Sample code changes

##### Before

```ts title="apps/app1-e2e/cypress.config.ts"
import { defineConfig } from 'cypress';
import { nxE2EStorybookPreset } from '@nx/storybook/presets/cypress';

export default defineConfig({
  e2e: nxE2EStorybookPreset(__dirname),
});
```

```json title="package.json"
{
  "devDependencies": {
    "@nx/storybook": "23.3.0"
  }
}
```

##### After

```json title="package.json"
{
  "devDependencies": {
    "@nx/cypress": "23.3.0",
    "@nx/storybook": "23.3.0"
  }
}
```
