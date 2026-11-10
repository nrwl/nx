#### Add `@nx/cypress` to `devDependencies` when the workspace uses it

`@nx/storybook` no longer installs `@nx/cypress`. It is now an optional peer dependency, so workspaces that use Storybook without Cypress no longer install it.

A workspace that uses `@nx/cypress` without declaring it in the root `package.json` could still resolve the copy `@nx/storybook` installed. This migration adds `@nx/cypress` to the root `devDependencies` when the root `package.json` does not list it in `dependencies` or `devDependencies` and the workspace references it in any of these places:

- A project target or an `nx.json` `targetDefaults` entry with an `@nx/cypress:*` executor.
- An `@nx/cypress` plugin registered in the `nx.json` `plugins` array.
- A quoted string that is `@nx/cypress`, one of its subpaths, or `@nx/storybook/presets/cypress`, in a `.ts`, `.tsx`, `.cts`, `.mts`, `.js`, `.jsx`, `.cjs` or `.mjs` file that is not ignored by `.gitignore` or `.nxignore`. Escaped characters in the string are decoded first.

Workspaces that already declare `@nx/cypress`, or reference it in none of these places, are left unchanged. A quoted mention counts even when the file never loads the package, such as an ESLint rule that bans the import. Module names built at runtime, such as `'@nx/' + 'cypress'`, are not detected. If your workspace loads `@nx/cypress` that way, add it to the root `devDependencies` yourself.

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
    "@nx/storybook": "24.1.0"
  }
}
```

##### After

```json title="package.json"
{
  "devDependencies": {
    "@nx/cypress": "24.1.0",
    "@nx/storybook": "24.1.0"
  }
}
```
