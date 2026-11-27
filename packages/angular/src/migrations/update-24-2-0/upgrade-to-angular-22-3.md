#### Upgrade Angular to 22.3 after the 22.2 upgrade

Updates the Angular packages to 22.3 in a workspace that the Angular 22.2 upgrade moved from Angular 22.1 in the same `nx migrate` run.

`nx migrate` picks the package updates before it runs any migration, and the Angular 22.3 updates apply only to workspaces on Angular 22.2. A workspace on Angular 22.1 reaches 22.2 later, through the 22.2 upgrade migration, so it misses them. This migration runs after the 22.2 upgrade and updates the workspace to 22.3 when it is on Angular 22.2. A workspace that the 22.2 upgrade kept on Angular 22.1, because it uses Cypress component testing or webpack Module Federation in an Angular project, stays on 22.1.

The migration updates only the packages that the root `package.json` declares, and a catalog reference is updated in the catalog.

#### Examples

##### Before

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

##### After

```jsonc title="package.json"
{
  "dependencies": {
    "@angular/common": "~22.3.0",
    "@angular/core": "~22.3.0",
  },
  "devDependencies": {
    "@angular/cli": "~22.3.0",
    "@angular-devkit/build-angular": "~22.3.0",
  },
}
```
