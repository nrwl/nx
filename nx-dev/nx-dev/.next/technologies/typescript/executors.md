
  The @nx/js plugin provides various executors to help you create and configure js projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `copy-workspace-modules`
Copies Workspace Modules into the output directory after a build to prepare it for use with Docker or alternatives.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `buildTarget` | string [**required**] | The build target that produces the output directory to transform. | `"build"` |
| `outputPath` | string | The output path to transform. Usually inferred from the outputs of the buildTarget. |  |

### `node`
Execute Nodejs applications.

The `@nx/js:node` executor runs the output of a build target. For example, an application uses esbuild ([`@nx/esbuild:esbuild`](/nx-api/esbuild/executors/esbuild)) to output the bundle to `dist/my-app` folder, which can then be executed by `@nx/js:node`.

`project.json`:

```json
"my-app": {
  "targets": {
    "serve": {
      "executor": "@nx/js:node",
      "options": {
        "buildTarget": "my-app:build"
      }
    },
    "build": {
      "executor": "@nx/esbuild:esbuild",
      "options": {
        "main": "my-app/src/main.ts",
        "output": ["dist/my-app"],
        //...
      }
    },
  }
}
```

```bash
npx nx serve my-app
```

### Examples

###### Pass extra Node CLI arguments

Using `runtimeArgs`, you can pass arguments to the underlying `node` command. For example, if you want to set [`--no-warnings`](https://nodejs.org/api/cli.html#--no-warnings) to silence all Node warnings, then add the following to the `project.json` file.

```json
"my-app": {
  "targets": {
    "serve": {
      "executor": "@nx/js:node",
      "options": {
        "runtimeArgs": ["--no-warnings"],
        //...
      },
    },
  }
}
```

###### Run all task dependencies

If your application build depends on other tasks, and you want those tasks to also be executed, then set the `runBuildTargetDependencies` to `true`. For example, a library may have a task to generate GraphQL schemas, which is consume by the application. In this case, you want to run the generate task before building and running the application.

This option is also useful when the build consumes a library from its output, not its source. For example, if an executor that supports `buildLibsFromSource` option has it set to `false` (e.g. [`@nx/webpack:webpack`](/nx-api/webpack/executors/webpack)).

Note that this option will increase the build time, so use it only when necessary.

```json
"my-app": {
  "targets": {
    "serve": {
      "executor": "@nx/js:node",
      "options": {
        "runBuildTargetDependencies": true,
        //...
      },
    },
  }
}
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `buildTarget` | string [**required**] | The target to run to build you the app. |  |
| `args` | array | Extra args when starting the app. | `[]` |
| `buildTargetOptions` | object | Additional options to pass into the build target. | `{}` |
| `debounce` | number | Delay in milliseconds to wait before restarting. Useful to batch multiple file changes events together. Set to zero (0) to disable. | `500` |
| `host` | string | The host to inspect the process on. | `"localhost"` |
| `inspect` | string | Ensures the app is starting with debugging. | `"inspect"` |
| `port` | number | The port to inspect the process on. Setting port to 0 will assign random free ports to all forked processes. | `9229` |
| `runBuildTargetDependencies` | boolean | Whether to run dependencies before running the build. Set this to true if the project does not build libraries from source (e.g. 'buildLibsFromSource: false'). | `false` |
| `runtimeArgs` | array | Extra args passed to the node process. | `[]` |
| `waitUntilTargets` | array | The targets to run before starting the node app. Listed in the form <project>:<target>. The main target will run once all listed targets have output something to the console. | `[]` |
| `watch` | boolean | Enable re-building when files change. | `true` |

### `prune-lockfile`
Creates a pruned lockfile based on the project dependencies and places it into the output directory.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `buildTarget` | string [**required**] | The build target that produces the output directory to place the pruned lockfile. | `"build"` |
| `outputPath` | string | The output path to place the pruned lockfile. Usually inferred from the outputs of the buildTarget. |  |

### `swc`
Builds using SWC.

### Examples

###### Custom swcrc

`@nx/js:swc` can compile your code with a custom `.swcrc`

```json title="libs/ts-lib/project.json"
{
  "build": {
    "executor": "@nx/js:swc",
    "options": {
      "outputPath": "dist/libs/ts-lib",
      "main": "libs/ts-lib/src/index.ts",
      "tsConfig": "libs/ts-lib/tsconfig.lib.json",
      "assets": ["libs/ts-lib/*.md"],
      "swcrc": "libs/ts-lib/.dev.swcrc"
    },
    "configurations": {
      "production": {
        "swcrc": "libs/ts-lib/.prod.swcrc"
      }
    }
  }
}
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `main` | string [**required**] | The name of the main entry-point file. |  |
| `outputPath` | string [**required**] | The output path of the generated files. |  |
| `tsConfig` | string [**required**] | The path to the Typescript configuration file. |  |
| `additionalEntryPoints` | array | Additional entry-points to add to exports field in the package.json file. |  |
| `assets` | array | List of static assets. | `[]` |
| `clean` | boolean | Remove previous output before build. | `true` |
| `generateExportsField` | boolean | Update the output package.json file's 'exports' field. This field is used by Node and bundles. | `false` |
| `generateLockfile` | boolean | Generate a lockfile (e.g. package-lock.json) that matches the workspace lockfile to ensure package versions match. | `false` |
| `includeIgnoredAssetFiles` | boolean | Include files that are ignored by .gitignore and .nxignore when copying assets. WARNING: Ignored files are not automatically considered when calculating the task hash. To ensure Nx tracks these files for caching, add them to your target's inputs using 'dependentTasksOutputs' or 'runtime' configuration. | `false` |
| `skipTypeCheck` | boolean | Whether to skip TypeScript type checking. | `false` |
| `stripLeadingPaths` | boolean | Remove leading directory from output (e.g. src). See: https://swc.rs/docs/usage/cli#--strip-leading-paths | `false` |
| `swcExclude` | array | List of SWC Glob/Regex to be excluded from compilation (https://swc.rs/docs/configuration/compilation#exclude). | `["./src/**/.*.spec.ts$","./**/.*.spec.ts$","./src/**/jest-setup.ts$","./**/jest-setup.ts$","./**/.*.js$"]` |
| `swcrc` | string | The path to the SWC configuration file. Default: .swcrc |  |
| `watch` | boolean | Enable re-building when files change. | `false` |

### `tsc`
Builds using TypeScript.

### Examples

###### Using TypeScript Transformer Plugins

`@nx/js:tsc` can run the [TypeScript Transformers](https://github.com/madou/typescript-transformer-handbook) by using the `transformers` option.

```json title="libs/ts-lib/project.json"
{
  "build": {
    "executor": "@nx/js:tsc",
    "options": {
      "outputPath": "dist/libs/ts-lib",
      "main": "libs/ts-lib/src/index.ts",
      "tsConfig": "libs/ts-lib/tsconfig.lib.json",
      "assets": ["libs/ts-lib/*.md"],
      "transformers": [
        "@nestjs/swagger/plugin",
        {
          "name": "@automapper/classes/transformer-plugin",
          "options": {}
        }
      ]
    }
  }
}
```

###### Batch mode execution

:::tip[Available since Nx 16.6.0]
The `@nx/js:tsc` batch implementation was introduced in Nx **16.6.0**.
:::

The `@nx/js:tsc` executor supports running multiple tasks in a single process. When running in batch mode, the executor uses the [TypeScript APIs for incremental builds](https://www.typescriptlang.org/docs/handbook/project-references.html#build-mode-for-typescript). This results in a much faster build time when compared to the default implementation (the bigger the task graph to run, the more the performance improvements).

:::danger[Experimental feature]
Executing tasks in batch mode is an experimental feature.
:::

:::tip[Requirements]
Building a project with the `@nx/js:tsc` executor in batch mode requires all dependent projects (excluding implicit dependencies) to be buildable and built using the `@nx/js:tsc` executor.
:::

To run your builds using the batch implementation, pass in `--batch` flag:

```shell
nx build ts-lib --batch
```

For optimal performance, you could set the `clean` option to `false`. Otherwise, the executor cleans the output folder before running the build, which results in the loss of the [`.tsbuildinfo` file](https://www.typescriptlang.org/tsconfig/#tsBuildInfoFile) and, consequently, the loss of important optimizations performed by TypeScript. This is not a requirement. Even if the `clean` option is not set to `false` there are other important optimizations that are performed by the batch implementation.

```json title="libs/ts-lib/project.json"
{
  "build": {
    "executor": "@nx/js:tsc",
    "options": {
      "outputPath": "dist/libs/ts-lib",
      "main": "libs/ts-lib/src/index.ts",
      "tsConfig": "libs/ts-lib/tsconfig.lib.json",
      "assets": ["libs/ts-lib/*.md"],
      "clean": false
    }
  }
}
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `main` | string [**required**] | The name of the main entry-point file. |  |
| `outputPath` | string [**required**] | The output path of the generated files. |  |
| `tsConfig` | string [**required**] | The path to the Typescript configuration file. |  |
| `additionalEntryPoints` | array | Additional entry-points to add to exports field in the package.json file. Ignored when `generatePackageJson` is set to `false`. |  |
| `assets` | array | List of static assets. | `[]` |
| `clean` | boolean | Remove previous output before build. | `true` |
| `generateExportsField` | boolean | Update the output package.json file's 'exports' field. This field is used by Node and bundlers. Ignored when `generatePackageJson` is set to `false`. | `false` |
| `generateLockfile` | boolean | Generate a lockfile (e.g. package-lock.json) that matches the workspace lockfile to ensure package versions match. Ignored when `generatePackageJson` is set to `false`. | `false` |
| `generatePackageJson` | boolean | Generate package.json file in the output folder. | `true` |
| `includeIgnoredAssetFiles` | boolean | Include files that are ignored by .gitignore and .nxignore when copying assets. WARNING: Ignored files are not automatically considered when calculating the task hash. To ensure Nx tracks these files for caching, add them to your target's inputs using 'dependentTasksOutputs' or 'runtime' configuration. | `false` |
| `outputFileName` | string | The path to the main file relative to the outputPath |  |
| `rootDir` | string | Sets the rootDir for TypeScript compilation. When not defined, it uses the root of project. |  |
| `transformers` | array | List of TypeScript Transformer Plugins. | `[]` |
| `watch` | boolean | Enable re-building when files change. | `false` |

### `verdaccio`
Start a local registry with Verdaccio.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `port` | number [**required**] | Port of local registry that Verdaccio should listen to |  |
| `clear` | boolean | Clear local registry storage before starting Verdaccio | `true` |
| `config` | string | Path to the custom Verdaccio config file |  |
| `listenAddress` | string | Listen address that Verdaccio should listen to | `"localhost"` |
| `location` | string | Location option for npm config | `"user"` |
| `scopes` | array | Scopes to be added to the Verdaccio config |  |
| `storage` | string | Path to the custom storage directory for Verdaccio |  |
