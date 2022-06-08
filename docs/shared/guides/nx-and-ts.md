# Nx and TypeScript

> The build system for TypeScript that TypeScript deserves

The `@nrwl/js` package ships with corresponding generators and executors that best work when it comes to developing TypeScript applications and libraries.

> Note, you can also opt-out of TypeScript and use plain JavaScript by passing the `--js` flag to the generators.

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/-OmQ-PaSY5M" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

`@nrwl/js` is particularly useful if you want to

- Create framework-agnostic TypeScript libraries within an existing Nx workspace (say to use in your React, Node or Angular app)
- Publish TypeScript packages to NPM

To get started with TypeScript packages in Nx, either add the `@nrwl/js` package to an existing Nx workspace or generate a new Nx workspace using the `--preset=ts` preset.

```bash
npx create-nx-workspace happynrwl --preset=ts
```

Generating a new workspace creates a lightweight setup with a `packages` and `tools` folder. The `tools` folder is where you can add monorepo specific scripts and custom Nx generators, the `packages` folder is where all our TS based libs will live.

```treeview
happynrwl/
├── packages/
├── tools/
├── workspace.json
├── nx.json
├── package.json
└── tsconfig.base.json
```

As with most Nx plugins, `@nrwl/js` comes with a set of generators to quickly scaffold new TypeScript libraries. Let’s have a look at an example.

## Create a new TypeScript based library

We can use Nx Console and choose the `@nrwl/js:library` generator or directly use the following command:

```bash
nx generate @nrwl/js:library --name=hello-tsc --buildable
```

This creates a new library in the `packages/hello-tsc` folder that already comes with both ESLint and Jest set up and ready to use.

You can run `nx lint hello-tsc` to run linting or `nx test hello-tsc` to run Jest tests.

Note, by passing the `--buildable` flag, our library can be built.

```bash
nx build hello-tsc
```

The output of the build step is placed into the `dist/packages/hello-tsc` by default.

## Create a TypeScript based application

Using either @nrwl/node or @nrwl/web, you can also setup a plain TypeScript application that is framework agnostic.

To generate a new framework agnostic TS node application, run

```bash
nx generate @nrwl/node:app demoapp
```

To generate a new framework agnostic TS web application, run

```bash
nx generate @nrwl/web:app demoapp
```

Applications also come with a “serve” target, that allow you to run the app in watch mode:

```bash
nx serve demoapp
```

## Importing Libraries

All the libraries generated within the Nx workspace are configured with corresponding TypeScript path mappings in the root-level `tsconfig.base.json` file:

```json
{
  "compileOnSave": false,
  "compilerOptions": {
    ...
    "paths": {
      "@happynrwl/hello-swc": ["packages/hello-swc/src/index.ts"],
      "@happynrwl/hello-tsc": ["packages/hello-tsc/src/index.ts"]
    }
  },
}
```

This allows you to easily import from libraries, by using the corresponding TypeScript path mapping. The following shows an example of importing the `helloTsc` function from the `hello-tsc` library into the `tsapp` application (the same method works between libraries as well):

```typescript
// file: packages/tsapp/src/index.ts

// importing from hello-tsc
import { helloTsc } from '@happynrwl/hello-tsc';

// use the function
helloTsc();

console.log(`Running ${tsapp()}`);
```

## Use SWC as the compiler

Nx also ships with support to use SWC instead of TSC. When generating a new library/application just pass the `--compiler=swc`.

Here's an example of generating a new library:

```bash
nx generate @nrwl/js:library --name=hello-tsc --buildable --compiler=swc
```

Alternatively, if you already have an existing tsc based library/application, you can run the `@nrwl/js:convert-to-swc` generator to migrate the package from TSC to SWC.

The following command converts the `hello-tsc` library to SWC:

```bash
nx generate @nrwl/js:convert-to-swc --name=hello-tsc
```

## Using NPM Scripts rather than Nx executors

If you want to use NPM scripts rather than Nx executors, you can use the `--config=npm-scripts`:

```bash
nx g @nrwl/js:lib mylib --config=npm-scripts
```

The Nx generator then creates NPM scripts in the generated library's `package.json` (rather than in the `project.json`):

```json
// packages/mylib/package.json
{
  "name": "@happynrwl/mylib",
  "version": "0.0.1",
  "type": "commonjs",
  "scripts": {
    "build": "echo 'implement build'",
    "test": "echo 'implement test'"
  }
}
```

To run these scripts with Nx, use the same syntax as Nx executors. `nx build mylib` or `nx test mylib` will build or test your library, respectively.

## Publish your TypeScript packages to NPM

### `--publishable` flag

Let's start by generating a new library `publish-me` with the following command:

```shell
nx g @nrwl/js:lib publish-me --publishable --importPath="@happynrwl/publish-me"
```

Generating a library with `--publishable` flag does several things extra on top of `--buildable`. It generates a minimal `publish.mjs` script in `tools/scripts/` directory if it does not already exist. Additionally, `--publishable` also adds a `publish` target to the library's `project.json` with the following content:

```json
{
  "root": "packages/publish-me",
  "sourceRoot": "packages/publish-me/src",
  "targets": {
    "build": {},
    "publish": {
      "executor": "nx:run-commands",
      "options": {
        "command": "node tools/scripts/publish.mjs publish-me {args.ver} {args.tag}"
      },
      "dependsOn": ["build"]
    },
    "lint": {},
    "test": {}
  },
  "tags": []
}
```

The `publish` target invokes the generated `publish.mjs` script using [`nx:run-commands`](/executors/run-commands-builder) executor. The script does the following:

- Validate the `ver` argument against a simple [SemVer](https://semver.org/) RegExp.
- Validate the `name` of the project (eg: `publish-me`) against the workspace existing projects.
- Update the `version` property in the `package.json` of your project's `build.outputPath`
- Invoke `npm publish` with the provided tag (default to `next` so you won't publish to `latest` by accident)

> Make sure to authenticate with `npm` before running the `publish` target.

```shell
nx publish publish-me --ver=<required-version> --tag=[custom-tag]
```

Thanks to [“Target Dependencies” (`dependsOn`)](/configuration/projectjson#dependson) property under the `publish` target, Nx runs the `build` target automatically before Nx runs `publish`. And of course, if `build` has already run, it won't execute again, thanks to [Nx computation caching](/using-nx/caching).

> The generated `publish.mjs` script is a minimal version of what a publishing process looks like. You can definitely add more to it as you see fit for your project. For example: you can add a capability to automatic increment the version

### Manual setup

Let's set up our `hello-tsc` library to be publishable as well but this time, we'll do it manually. All we have to do is to copy the `publish` target from `publish-me` library to `hello-tsc` and modify it to use `hello-tsc` project name instead.

```shell
{
  "root": "packages/hello-tsc",
  "sourceRoot": "packages/hello-tsc/src",
  "targets": {
    "build": {},
    "publish": {
      "executor": "nx:run-commands",
      "options": {
        "command": "node tools/scripts/publish.mjs hello-tsc {args.ver} {args.tag}",
      },
      "dependsOn": ["build"]
    },
    "lint": {},
    "test": {}
  },
  "tags": []
}

```

Now, you should be able to invoke `nx publish hello-tsc --ver=<required-version>` to publish it to `npm`
