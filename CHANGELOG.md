# On Release Process

The `nrwl/nx` and `nrwl/schematics` packages are released together. You must use the same version of the two packages.

# 0.3.0

We want to be able to add new features to Nx without breaking existing workspaces. Say, you created an Nx Workspace using Nx 0.2.0. Then, half a year later, you decided to upgrade the version of Nx to 0.5.0. Imagine the 0.5.0 release requires you to have more information in your `.angular-cli.json`. Until now, you would have to manually go through the changelog and modify your `.angular-cli.json`. This release adds the `nx-migrate` command that does it for you. Run `npm run nx-migrate` after upgrading `@nrwl/schematics`, and it will upgrade your workspace to be 0.5.0 compatible. 

## Features

* [add `allow` option to whitelist deep imports](https://github.com/nrwl/nx/commit/b3f67351fe8890e06402672e687b1789f279613b)
* [Added the nx-migrate command](https://github.com/nrwl/nx/commit/d6e66b99316181b8b67805b91cc35457c3465029)
* [Upgrade Prettier to 1.8.2](https://github.com/nrwl/nx/commit/cc2277e91be2ca49fb1588f1d8e29ef91fd12044)
* [Update readme to point to example apps using Nx](https://github.com/nrwl/nx/commit/3d53e31391d5d79a0724d099c7121edb53e8b163)

# 0.2.2

## Bug Fixes

* [Adds a schema file to allow custom properties that the default CLI distribution does not support](https://github.com/nrwl/nx/commit/7fd7594e673cf38af7668b891ed7c75b390b3330)
* [Fix issue with generating a wrong full path on windows](https://github.com/nrwl/nx/commit/11e6c055ba1211a5bee1cc73d46663985645f08e)

# 0.2.1

## New Features

* [Export jasmine-marbles getTestScheduler and time functions](https://github.com/nrwl/nx/commit/2e4613f475fc2673731540fb4724d6ba2af02aae)
* [Use fetch instead of optimisticUpdate in the generated effect classes](https://github.com/nrwl/nx/commit/c9759cc4427283422e906ed19a8a2dabcb2a656b)

## Bug Fixes

* [--routing should add RouterTestingModule](https://github.com/nrwl/nx/commit/d7fc5b56054c9a4c1fbb12845bfc0803f9a9ff86)
* [Fix wording in the documentation](https://github.com/nrwl/nx/commit/058c8995f35a9e677f88404bc9c8a2b177487080)

## Refactorings

* [Refactor Nx to use RxJS lettable operators](https://github.com/nrwl/nx/commit/715efa4b225b65be0052a1e6a88c5bdcd5a6cf38)

# 0.2.0

## New Features

### Changing Default Library Type

We changed the default library type from "simple" to "Angular". So where previously you would run:

```
ng generate lib mylib // simple TS library
ng generate lib mylib --ngmodule // an angular library
```

Now, you run:

```
ng generate lib mylib // an angular library
ng generate lib mylib --nomodule // simple ts library
```

### Generating Router Configuration

You can pass `--routing` when generating an app.

```
ng generate app myapp --routing // generate an angular app with router config
```

The generated app will have `RouterModule.forRoot` configured.

You can also pass it when generating a library, like this:

```
ng generate lib mylib --routing
```

This will set up the router module and will create an array of routes, which can be plugged into the parent module. This configuration works well for modules that aren't loaded lazily.

You can add the `--lazy` to generate a library that is loaded lazily.

```
ng generate lib mylib --routing --lazy
```

This will also register the generated library in tslint.json, so the linters will make sure the library is not loaded lazily.

Finally, you can pass `--parentModule` and the schematic will wire up the generated library in the parent router configuration.

```
ng generate lib mylib --routing --parentModule=apps/myapp/src/myapp.module.ts
ng generate lib mylib --routing --lazy --parentModule=apps/myapp/src/myapp.module.ts
```

