# Creating a Lib

Adding new libs to an Nx Workspace is done by using the Angular CLI generate command, just like adding a new app.

```bash
ng generate lib mylib
ng generate library mylib # same thing
```

This will create a new lib, will place it in the libs directory, and will configure the `angular.json` and `nx.json` files to support the new lib.

# Available options

Run `ng generate lib --help` to see the list of available options:

```
usage: ng generate lib <name> [options]
options:
  --directory
    A directory where the app is placed
  --dry-run (-d)
    Run through without making any changes.
  --force (-f)
    Forces overwriting of files.
  --lazy
    Add RouterModule.forChild when set to true, and a simple array of routes when set to false.
  --parent-module
    Update the router configuration of the parent module using loadChildren or children, depending on what `lazy` is set to.
  --prefix (-p)
    The prefix to apply to generated HTML selector of components.
  --publishable
    Generate a simple TS library when set to true.
  --routing
    Add router configuration. See lazy for more information.
  --skip-package-json
    Do not add dependencies to package.json.
  --skip-ts-config
    Do not update tsconfig.json for development experience.
  --tags
    Add tags to the library (used for linting)
```

Most of these options are identical to the ones supported by the default CLI library, but the following are new or different: `directory`, `routing`, `lazy`, `parent-module`, `publishable`, and `tags`.

- `ng generate lib mylib --directory=myteam` will create a new application in `libs/myteam/mylib`.
- `ng generate lib mylib --routing` will configure the lib's `NgModule` to wire up routing to be loaded eagerly.
- `ng generate lib mylib --routing --lazy` will configure the lib's `NgModule` to wire up routing to be loaded lazily.
- `ng generate lib mylib --routing --parent-module=apps/myapp/src/app/app.module.ts` will configure the lib's `NgModule` to wire up routing and will configure `app.module.ts` to load the library.
- `ng generate lib mylib --routing --lazy --parent-module=apps/myapp/src/app/app.module.ts` will configure the lib's `NgModule` to wire up routing and will configure `app.module.ts` to load the library.
- `ng generate lib mylib --publishable` will generate a few extra files configuring for `ng-packagr`. You can then run `ng build mylib` to create an npm package you can publish to a npm registry. This is very rarely needed when developing in a monorepo. In this case the clients of the library are in the same repository, so no packaging and publishing step is required.
- `ng generate lib mylib --tags=shared,experimental` will annotate the created lib with the two tags, which can be used for advanced code analysis. Read more below.

Note when creating lazy-loaded libraries, you need to add an entry to the tsconfig.app.json file of the parent module app, so TypeScript knows to build it as well:

```javascript
{
  . . .

  "include": [
      "**/*.ts"
      /* add all lazy-loaded libraries here: "../../../libs/my-lib/index.ts" */

      , "../../../libs/mymodule/src/index.ts"
  ]
}
```

In most cases, Nx will do it by default. Sometime, you need to manually add this entry.

This is great, but is not sufficient to enable the monorepo-style development. Nx adds an extra layer of tooling to make this possible.
