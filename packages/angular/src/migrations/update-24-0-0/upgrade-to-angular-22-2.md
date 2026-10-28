#### Upgrade Angular to 22.2

Updates the Angular packages of an Angular 22.1 workspace to 22.2, unless the workspace uses Cypress component testing or webpack Module Federation in an Angular project.

Angular 22.2 installs webpack 5.111 and webpack-dev-server 6 through `@angular-devkit/build-angular`. Cypress rejects that webpack-dev-server when it starts Angular component tests ([cypress-io/cypress#34259](https://github.com/cypress-io/cypress/issues/34259)). Module Federation builds fail on that webpack ([module-federation/core#5077](https://github.com/module-federation/core/issues/5077)). The migration keeps the workspace on Angular 22.1 and reports why when it finds either of these:

- An import from `cypress/angular`, `@cypress/angular` or one of their variants, or from `@nx/angular/plugins/component-testing`, in any file of the workspace.
- An import from `@module-federation/enhanced`, `@module-federation/node`, `@nx/module-federation`, `@nx/angular/mf` or `@nx/angular/module-federation` in the webpack config of an Angular project.

An Angular project is one with an `@nx/angular` webpack or Module Federation executor, an `@angular-builders/custom-webpack` builder or an `ngx-build-plus` builder. Targets are read from `project.json`, including executors inherited from `targetDefaults`, and from every `angular.json`. The migration reads the webpack configs these targets reference, the `webpack*` and `module-federation.config` files in the project root, and every file they import through a relative path. When a config imports something the migration cannot follow, such as a path alias or a workspace package, a Module Federation import anywhere in the workspace also keeps Angular 22.1.

Rspack builds, Native Federation and `@angular-architects/module-federation` don't hold the update. The last one uses the container plugin built into webpack, which works with webpack 5.111.

The migration updates only the packages that the root `package.json` declares, and a catalog reference is updated in the catalog. `@angular/core` is added to `dependencies` when the root doesn't declare it. A later Nx migration updates a workspace kept on Angular 22.1 once the upstream issues are fixed.

#### Examples

##### Before

```jsonc title="package.json"
{
  "dependencies": {
    "@angular/common": "~22.1.0",
    "@angular/core": "~22.1.0",
  },
  "devDependencies": {
    "@angular/cli": "~22.1.0",
    "@angular-devkit/build-angular": "~22.1.0",
  },
}
```

##### After

```jsonc title="package.json"
{
  "dependencies": {
    "@angular/common": "~22.2.0",
    "@angular/core": "~22.2.0",
  },
  "devDependencies": {
    "@angular/cli": "~22.2.0",
    "@angular-devkit/build-angular": "~22.2.0",
  },
}
```
