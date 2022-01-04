# Nx and TypeScript

> The build system for TypeScript that TypeScript deserves

The `@nrwl/js` package ships with corresponding generators and executors that best work when it comes to developing TypeScript applications and libraries.

> Note, you can also opt-out of TypeScript and use plain JavaScript by passing the `--js` flag to the generators.

<iframe width="560" height="315" src="https://www.youtube.com/embed/-OmQ-PaSY5M" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

`@nrwl/js` is particularly useful if you want to

- Create framework agnostic, just plain TypeScript libraries within an existing Nx workspace (say to use in your React, Node or Angular app)
- Publish TypeScript packages to NPM

To get started with TypeScript packages in Nx, either add the `@nrwl/js` package to an existing Nx workspace or generate a new Nx workspace using the `--preset=ts` preset.

```bash
npx create-nx-workspace happynrwl -–preset=ts
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

As with most of Nx plugins, `@nrwl/js` comes with a set of generators to quickly scaffold new TypeScript libraries as well as TypeScript applications. Let’s have a look at an example.

## Create a new TypeScript based library

We can use Nx Console and choose the `@nrwl/js:library` generator or directly use the following command:

```bash
nx generate @nrwl/js:library --name=hello-tsc --buildable
```

This creates a new library in the `packages/hello-tsc` folder that already comes with both, ESLint and Jest set up and ready to use.

You can run `nx lint hello-tsc` to run linting or `nx test hello-tsc` to run Jest tests.

Note, by passing the `--buildable` flag, our library can be built.

```bash
nx build hello-tsc
```

The output is placed into the `dist/packages/hello-tsc` by default.

## Create a TypeScript based application

Apart from setting up TypeScript libraries, you can also setup a plain TypeScript application that is framework agnostic and consists of an entry point script that can be easily run with Node, to develop a CLI or framework agnostic backend application.

To generate a new, framework agnostic TS application, run

```bash
nx generate @nrwl/js:app demoapp
```

Applications also come with a “serve” target, that allow to run the app in watch mode:

```bash
nx serve demoapp
```

## Importing Libraries

All the libraries generated within the Nx workspace are configured with corresponding TypeScript path mappings in the root-level `tsconfig.base.json`:

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

This allows to easily import from libraries, by using the corresponding TypeScript path mapping. The following shows an example of importing the `helloTsc` function from the `hello-tsc` library into the `tsapp` application (same works between libraries as well):

```
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

Alternatively, if you have already an existing tsc based library/application, you can run the `@nrwl/js:convert-to-swc` generator to migrate the package from TSC to SWC.

The following command converts the `hello-tsc` library to SWC:

```bash
nx generate @nrwl/js:convert-to-swc --name=hello-tsc
```

## Using NPM Scripts rather than Nx executors

If you want to use NPM scripts rather than Nx executors, you can use the `--config=npm-scripts`:

```bash
nx g @nrwl/js:lib mylib --config=npm-scripts
```

That way the Nx generator creates according NPM scripts in generated library's `package.json` (rather than in the `project.json`):

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

Nx is still able to pick those up natively, so you can still run `nx build mylib` or `nx test mylib` and it would trigger the npm scripts.

## Publish your TypeScript packages to NPM

Nx doesn’t provide an out of the box process for the publishing itself and leaves it to the developer to invoke the final command. The reason is that the actual publishing process can be very specific to your project and target you deploy to and might have a lot of custom pre-deployment setup (e.g. generating changelogs, determining semver etc.). Make sure to check out our [community page](/community) as there are a lot of community provided packages integrating into the publishing process.

However, integrating your custom publishing process with Nx can be pretty straightforward, especially with the help of Nx [run-commands](/{{framework}}/executors/run-commands-builder) and [“Target Dependencies”](/{{framework}}/configuration/projectjson#dependson).

To add a new run-command to our project, we can leverage the `run-command` generator:

```bash
nx g @nrwl/workspace:run-commands publish --project hello-tsc --command 'npm publish --tag=latest --access public'
```

This adds a new target `publish` to our existing `project.json` configuration of the `hello-tsc` project. Let's also make sure to adjust the `cwd` of our command, which should be in the output folder of the `hello-tsc` package.

```json
{
  "root": "packages/hello-tsc",
  "sourceRoot": "packages/hello-tsc/src",
  "projectType": "library",
  "targets": {
    "build": { ... },
    "lint": { ... },
    "test": { ... },
    "publish": {
      "executor": "@nrwl/workspace:run-commands",
      "outputs": [],
      "options": {
        "command": "npm publish --tag=latest --access public",
        "cwd": "dist/packages/hello-tsc"
      }
    }
  },
  "tags": []
}
```

With that, we're already set up. By running the following commands we can publish our package to NPM.

```bash
nx build hello-tsc
nx publish hello-tsc
```

We can however even automate this further by leveraging the `targetDependencies` feature. There's clearly a dependency from `publish -> build`, in that we want to make sure the `build` happens before the `publish` command, since the latter depends on the output of the former. We can define such relationship in the `nx.json`:

```json
{
  ...
  "targetDependencies": {
    ...
    "publish": [
      {
        "target": "build",
        "projects": "self"
      }
    ]
  },
  ...
}
```

Now, just running `nx publish hello-tsc` will automatically run the `nx build hello-tsc` command first. And of course, if `build` has already run, it won't execute again, thanks to [Nx computation caching](/{{framework}}/using-nx/caching).
