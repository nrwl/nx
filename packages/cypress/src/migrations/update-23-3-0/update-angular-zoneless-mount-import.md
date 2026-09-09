#### Use `cypress/angular` for zoneless Angular component tests in Cypress 16

Cypress 16 removed the `cypress/angular-zoneless` entry point and deprecated the `@cypress/angular-zoneless` npm package. `cypress/angular` now mounts components with zoneless change detection and supports Angular 21 and later. Imports of `cypress/angular-zoneless` fail to resolve on Cypress 16.

This migration rewrites `cypress/angular-zoneless` and `@cypress/angular-zoneless` module references to `cypress/angular` in every JavaScript and TypeScript file of the workspace, shared support libraries included: `import` and `export ... from` declarations, `import type`, dynamic `import()`, `require()` and `typeof import()` types. It also removes the `@cypress/angular-zoneless` package from `package.json` when it is installed.

#### Sample code changes

##### Before

```ts title="apps/myapp/cypress/support/component.ts"
import { mount } from 'cypress/angular-zoneless';
```

##### After

```ts title="apps/myapp/cypress/support/component.ts"
import { mount } from 'cypress/angular';
```
