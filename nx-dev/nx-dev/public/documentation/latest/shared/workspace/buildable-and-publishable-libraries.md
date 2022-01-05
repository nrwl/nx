# Publishable and Buildable Nx Libraries

The `--buildable` and `--publishable` options are available on the Nx library generators for the following plugins:

- Angular
- React
- NestJs
- Node

This document will look to explain the motivations for why you would use either the `--buildable` or `--publishable` option, as well as the mechanics of how they adjust the result when you add them to your generator.

## Publishable libraries

You might use the `--publishable` option when generating a new Nx library if your intention is to distribute it outside the monorepo.

One typical scenario for this may be that you use Nx to develop your organizations UI design system component library (maybe using its Storybook integration), which should be available also to your organizations’ apps that are not hosted within the same monorepo.

A normal Nx library - let’s call it "workspace library" - is not made for building or publishing. Rather it only includes common lint and test targets in its `angular.json` or `workspace.json`. These libraries are directly referenced from one of the monorepo’s applications and built together with them.

Keep in mind that the `--publishable` flag does not enable automatic publishing. Rather it adds to your Nx workspace library a builder target that **compiles** and **bundles** your app. The resulting artifact will be ready to be published to some registry (e.g. [npm](https://npmjs.com/)). By having that builder, you can invoke the build via a command like: `nx build mylib` (where "mylib" is the name of the lib) which will then produce an optimized bundle in the `dist/mylib` folder. Nx [also analyzes](/{{framework}}/angular/package#updatebuildableprojectdepsinpackagejson) the library’s dependencies and automatically compiles the dependencies in the resulting `package.json` file.

One particularity when generating a library with `--publishable` is that it requires you to also provide an `--importPath`. Your import path is the actual scope of your distributable package (e.g.: `@myorg/mylib`) - which needs to be a [valid npm package name](https://docs.npmjs.com/files/package.json#name).

To publish the library (for example to npm) you can run the CLI command: `npm publish` from the artifact located in the `dist` directory. Setting up some automated script in Nx’s `tools` folder may also come in handy.

For more details on the mechanics, remember that Nx is an open source project, so you can see the actual impact of the generator by looking at the source code (the best starting point is probably `packages/<framework>/src/generators/library/library.ts`).

## Buildable libraries

Buildable libraries are similar to "publishable libraries" described above. Their scope however is not to distribute or publish them to some external registry. Thus they might not be optimized for bundling and distribution.

Buildable libraries are mostly used for producing some pre-compiled output that can be directly referenced from an Nx workspace application without the need to again compile it. A typical scenario is to leverage Nx’s [incremental building](/{{framework}}/ci/incremental-builds) capabilities.

For more details on the mechanics, remember that Nx is an open source project, so you can see the actual impact of the generator by looking at the source code (the best starting point is probably `packages/<framework>/src/generators/library/library.ts`).
