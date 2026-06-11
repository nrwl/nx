The @nx/cypress plugin provides various migrations to help you migrate to newer versions of cypress projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 22.3.x

### 22.3.2-package-updates
**Version**: 22.3.2-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `cypress` | `^15.8.0` | Updated only
| `@cypress/webpack-dev-server` | `^5.4.1` | Updated only



## 22.1.x

### `rename-cy-exec-code-property`
**Version**: 22.1.0-beta.6

Renames `cy.exec().its('code')` usages to the new `exitCode` property introduced in Cypress v15.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=15.0.0` |
#### Rename `cy.exec().its('code')` to `cy.exec().its('exitCode')`

Cypress v15 renamed the result property exposed by `cy.exec()` from `code` to `exitCode`. This migration updates Cypress spec files managed by Nx so that assertions such as `cy.exec(...).its('code')` use the new `exitCode` property.

Read more in the [migration guide](https://docs.cypress.io/app/references/migration-guide#cyexec-code-property-renamed).

#### Examples

##### Before

```ts title="apps/app-e2e/src/e2e/sample.cy.ts"
cy.exec('echo 0').its('code').should('eq', 0);
```

##### After

```ts title="apps/app-e2e/src/e2e/sample.cy.ts"
cy.exec('echo 0').its('exitCode').should('eq', 0);
```



### `update-selector-playground-api`
**Version**: 22.1.0-beta.6

Updates the deprecated `Cypress.SelectorPlayground` API to `Cypress.ElementSelector` and removes the unsupported `onElement` option.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=15.0.0` |
#### Update the Selector Playground API

Cypress v15 renamed `Cypress.SelectorPlayground` to `Cypress.ElementSelector` and removed the deprecated `onElement` option when calling `Cypress.ElementSelector.defaults()`. This migration updates existing Cypress support files to use the new API.

Read more in the [migration guide](https://docs.cypress.io/app/references/migration-guide#Selector-Playground-API-changes).

#### Examples

##### Before

```ts title="apps/web-e2e/src/support/selector.ts"
Cypress.SelectorPlayground.defaults({
  selectorPriority: ['data-cy'],
  onElement: (el) => el,
});
```

##### After

```ts title="apps/web-e2e/src/support/selector.ts"
Cypress.ElementSelector.defaults({
  selectorPriority: ['data-cy'],
});
```



### `update-angular-component-testing-support`
**Version**: 22.1.0-beta.6

For Angular component testing projects below v18, switches to the fallback `@cypress/angular` harness required by Cypress v15.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=15.0.0` |
#### Use the fallback Angular component testing harness for Cypress v15

Cypress v15 requires Angular component testing projects running Angular versions below 18 to migrate from the built-in `cypress/angular` helper to the `@cypress/angular` harness (v3). This migration updates component testing imports and ensures the correct dependency is installed.

Read more in the [migration guide](https://docs.cypress.io/app/references/migration-guide#Angular-17-CT-no-longer-supported).

#### Examples

##### Before

```ts title="apps/dashboard/src/app/app.component.cy.ts"
import { mount } from 'cypress/angular';
```

##### After

```ts title="apps/dashboard/src/app/app.component.cy.ts"
import { mount } from '@cypress/angular';
```



### 22.1.0-package-updates
**Version**: 22.1.0-beta.6


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `cypress` | `^15.6.0` | Updated only
| `@cypress/vite-dev-server` | `^7.0.1` | Updated only
| `@cypress/webpack-dev-server` | `^5.1.4` | Updated only



## 21.0.x

### `remove-tsconfig-and-copy-files-options-from-cypress-executor`
**Version**: 21.0.0-beta.10

Removes the `tsConfig` and `copyFiles` options from the `@nx/cypress:cypress` executor.

#### Remove `tsConfig` and `copyFiles` Options from Cypress Executor

Removes the previously deprecated and unused `tsConfig` and `copyFiles` options from the `@nx/cypress:cypress` executor configuration in all projects.

#### Examples

Remove the options from the project configuration:

##### Before

```json title="apps/app1-e2e/project.json" {7-8}
{
  "targets": {
    "e2e": {
      "executor": "@nx/cypress:cypress",
      "options": {
        "cypressConfig": "apps/app1-e2e/cypress.config.ts",
        "tsConfig": "apps/app1-e2e/tsconfig.json",
        "copyFiles": "**/*.spec.ts",
        "devServerTarget": "app1:serve"
      }
    }
  }
}
```

##### After

```json title="apps/app1-e2e/project.json"
{
  "targets": {
    "e2e": {
      "executor": "@nx/cypress:cypress",
      "options": {
        "cypressConfig": "apps/app1-e2e/cypress.config.ts",
        "devServerTarget": "app1:serve"
      }
    }
  }
}
```

Remove the options from a target default using the `@nx/cypress:cypress` executor:

##### Before

```json title="nx.json" {7-8}
{
  "targetDefaults": {
    "e2e": {
      "cache": true,
      "executor": "@nx/cypress:cypress",
      "options": {
        "tsConfig": "{projectRoot}/tsconfig.json",
        "copyFiles": "**/*.spec.ts"
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "e2e": {
      "cache": true,
      "executor": "@nx/cypress:cypress"
    }
  }
}
```

Remove the options from a target default using the `@nx/cypress:cypress` executor as the key:

##### Before

```json title="nx.json" {6-7}
{
  "targetDefaults": {
    "@nx/cypress:cypress": {
      "cache": true,
      "options": {
        "tsConfig": "{projectRoot}/tsconfig.json",
        "copyFiles": "**/*.spec.ts"
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "@nx/cypress:cypress": {
      "cache": true
    }
  }
}
```




## 20.8.x

### `set-inject-document-domain`
**Version**: 20.8.0-beta.0

Replaces the `experimentalSkipDomainInjection` configuration option with the new `injectDocumentDomain` configuration option.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=14.0.0` |
#### Set `injectDocumentDomain` Configuration Option

Replaces the removed `experimentalSkipDomainInjection` configuration option with the new `injectDocumentDomain` configuration option when needed. Skipping domain injection is the default behavior in Cypress v14 and therefore, it is required to use the `cy.origin()` command when navigating between domains. The `injectDocumentDomain` option was introduced to ease the transition to v14, but it is deprecated and will be removed in Cypress v15. Read more at the [migration notes](https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin).

#### Examples

If the `experimentalSkipDomainInjection` configuration option is present, the migration will remove it. This is to account for the fact that skipping domain injection is the default behavior in Cypress v14.

##### Before

```ts title="apps/app1-e2e/cypress.config.ts"
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'pnpm exec nx run app1:dev',
        production: 'pnpm exec nx run app1:dev',
      },
      ciWebServerCommand: 'pnpm exec nx run app1:dev',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
    experimentalSkipDomainInjection: ['https://example.com'],
  },
});
```

##### After

```ts title="apps/app1-e2e/cypress.config.ts"
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'pnpm exec nx run app1:dev',
        production: 'pnpm exec nx run app1:dev',
      },
      ciWebServerCommand: 'pnpm exec nx run app1:dev',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
  },
});
```

If the `experimentalSkipDomainInjection` configuration option is present and set to an empty array (no domain injection is skipped), the migration will remove it and will set the `injectDocumentDomain` option to `true`.

##### Before

```ts title="apps/app1-e2e/cypress.config.ts"
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'pnpm exec nx run app1:dev',
        production: 'pnpm exec nx run app1:dev',
      },
      ciWebServerCommand: 'pnpm exec nx run app1:dev',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
    experimentalSkipDomainInjection: [],
  },
});
```

##### After

```ts title="apps/app1-e2e/cypress.config.ts" {17-19}
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'pnpm exec nx run app1:dev',
        production: 'pnpm exec nx run app1:dev',
      },
      ciWebServerCommand: 'pnpm exec nx run app1:dev',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
    // Please ensure you use `cy.origin()` when navigating between domains and remove this option.
    // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
    injectDocumentDomain: true,
  },
});
```

If the `experimentalSkipDomainInjection` configuration option is not present (no domain injection is skipped), the migration will set the `injectDocumentDomain` option to `true`.

##### Before

```ts title="apps/app1-e2e/cypress.config.ts"
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'pnpm exec nx run app1:dev',
        production: 'pnpm exec nx run app1:dev',
      },
      ciWebServerCommand: 'pnpm exec nx run app1:dev',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
  },
});
```

##### After

```ts title="apps/app1-e2e/cypress.config.ts" {17-19}
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'pnpm exec nx run app1:dev',
        production: 'pnpm exec nx run app1:dev',
      },
      ciWebServerCommand: 'pnpm exec nx run app1:dev',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
    // Please ensure you use `cy.origin()` when navigating between domains and remove this option.
    // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
    injectDocumentDomain: true,
  },
});
```



### `remove-experimental-fetch-polyfill`
**Version**: 20.8.0-beta.0

Removes the `experimentalFetchPolyfill` configuration option.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=14.0.0` |
#### Remove `experimentalFetchPolyfill` Configuration Option

Removes the `experimentalFetchPolyfill` configuration option that was removed in Cypress v14. Read more at the [migration notes](<https://docs.cypress.io/app/references/changelog#:~:text=The%20experimentalFetchPolyfill%20configuration%20option%20was,cy.intercept()%20for%20handling%20fetch%20requests>).

#### Examples

##### Before

```ts title="apps/app1-e2e/cypress.config.ts"
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'pnpm exec nx run app1:dev',
        production: 'pnpm exec nx run app1:dev',
      },
      ciWebServerCommand: 'pnpm exec nx run app1:dev',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
    experimentalFetchPolyfill: true,
  },
});
```

##### After

```ts title="apps/app1-e2e/cypress.config.ts"
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'pnpm exec nx run app1:dev',
        production: 'pnpm exec nx run app1:dev',
      },
      ciWebServerCommand: 'pnpm exec nx run app1:dev',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
  },
});
```



### `replace-experimental-just-in-time-compile`
**Version**: 20.8.0-beta.0

Replaces the `experimentalJustInTimeCompile` configuration option with the new `justInTimeCompile` configuration option.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=14.0.0` |
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



### `update-component-testing-mount-imports`
**Version**: 20.8.0-beta.0

Updates the module specifier for the Component Testing `mount` function.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=14.0.0` |
#### Update Component Testing `mount` Imports

Updates the relevant module specifiers when importing the `mount` function and using the Angular or React frameworks. Read more at the [Angular migration notes](https://docs.cypress.io/app/references/migration-guide#Angular-1720-CT-no-longer-supported) and the [React migration notes](https://docs.cypress.io/app/references/migration-guide#React-18-CT-no-longer-supported).

#### Examples

If using the Angular framework with a version greater than or equal to v17.2.0 and importing the `mount` function from the `cypress/angular-signals` module, the migration will update the import to use the `cypress/angular` module.

##### Before

```ts title="apps/app1/cypress/support/component.ts"
import { mount } from 'cypress/angular-signals';
import './commands';

declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);
```

##### After

```ts title="apps/app1/cypress/support/component.ts" {1}
import { mount } from 'cypress/angular';
import './commands';

declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);
```

If using the Angular framework with a version lower than v17.2.0 and importing the `mount` function from the `cypress/angular` module, the migration will install the `@cypress/angular@2` package and update the import to use the `@cypress/angular` module.

##### Before

```json title="package.json"
{
  "name": "@my-repo/source",
  "dependencies": {
    ...
    "cypress": "^14.2.1"
  }
}
```

```ts title="apps/app1/cypress/support/component.ts"
import { mount } from 'cypress/angular';
import './commands';

declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);
```

##### After

```json title="package.json" {6}
{
  "name": "@my-repo/source",
  "dependencies": {
    ...
    "cypress": "^14.2.1",
    "@cypress/angular": "^2.1.0"
  }
}
```

```ts title="apps/app1/cypress/support/component.ts" {1}
import { mount } from '@cypress/angular';
import './commands';

declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);
```

If using the React framework and importing the `mount` function from the `cypress/react18` module, the migration will update the import to use the `cypress/react` module.

##### Before

```ts title="apps/app1/cypress/support/component.ts"
import { mount } from 'cypress/react18';
import './commands';

declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);
```

##### After

```ts title="apps/app1/cypress/support/component.ts" {1}
import { mount } from 'cypress/react';
import './commands';

declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);
```



### 20.8.0-package-updates
**Version**: 20.8.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `cypress` | `^14.2.1` | Updated only
| `@cypress/vite-dev-server` | `^6.0.3` | Updated only
| `@cypress/webpack-dev-server` | `^4.0.2` | Updated only


