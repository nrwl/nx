#### Replace the `experimentalJustInTimeCompile` Configuration Option with `justInTimeCompile`

Replaces the `experimentalJustInTimeCompile` configuration option with the new `justInTimeCompile` configuration option. Read more at the [migration notes](https://docs.cypress.io/app/references/migration-guide#CT-Just-in-Time-Compile-changes).

#### Examples

If the `experimentalJustInTimeCompile` configuration option is present and set to `true`, the migration will remove it. This is to account for the fact that JIT compilation is the default behavior in Cypress v14.

##### Before

```ts title="apps/app1/cypress.config.ts"
import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
    experimentalJustInTimeCompile: true,
  },
});
```

##### After

```ts title="apps/app1/cypress.config.ts"
import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
  },
});
```

If the `experimentalJustInTimeCompile` configuration option is set to `false` and it is using webpack, the migration will rename it to `justInTimeCompile`.

##### Before

```ts title="apps/app1/cypress.config.ts"
import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
    experimentalJustInTimeCompile: false,
  },
});
```

##### After

```ts title="apps/app1/cypress.config.ts" {9}
import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
    justInTimeCompile: false,
  },
});
```

If the `experimentalJustInTimeCompile` configuration is set to any value and it is using Vite, the migration will remove it. This is to account for the fact that JIT compilation no longer applies to Vite.

##### Before

```ts title="apps/app1/cypress.config.ts"
import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    experimentalJustInTimeCompile: false,
  },
});
```

##### After

```ts title="apps/app1/cypress.config.ts"
import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
  },
});
```
