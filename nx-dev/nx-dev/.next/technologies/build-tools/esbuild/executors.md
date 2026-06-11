
  The @nx/esbuild plugin provides various executors to help you create and configure esbuild projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `esbuild`
Bundle a package for different platforms.

`<app-root>/project.json`:

```jsonc
{
  //...
  "targets": {
    //...
    "build": {
      "executor": "@nx/esbuild:esbuild",
      "options": {
        "main": "<app-root>",
        "tsConfig": "<app-root>/tsconfig.app.json",
        "outputPath": "dist/<app-root>",
      },
    },
  },
}
```

```bash
nx build <app-name>
```

### Examples

###### CommonJS output

The CommonJS format is required in some environments, such as Electron applications. By default, `esbuild` will use the ESM format, which is recommended for Web and Node applications. You may also output to multiple formats.

```bash
nx build <app-name> --format=cjs
nx build <app-name> --format=esm,cjs
nx build <app-name> # defaults to es# defaults to esm
```

```json
"build": {
  "executor": "@nx/esbuild:esbuild",
  "options": {
    "main": "<app-root>",
    "tsConfig": "<app-root>/tsconfig.app.json",
    "outputPath": "dist/<app-root>",
      "format": ["esm", "cjs"]
  }
}
```

###### External packages

External packages are not bundled by default. To include them in the bundle you can use either the `thirdParty` option to include all third-party dependencies, or use `excludeFromExternal` option to include specific dependencies in the bundle.

To mark additional packages or assets as external, you may use the `external` option, which supports the `*` wildcard to match assets.

For example, this configuration includes all third-party dependencies such as `lodash` or `date-fns` in the bundle. It also marks all `*.png` files as external assets.

```json
"build": {
  "executor": "@nx/esbuild:esbuild",
  "options": {
    "main": "<app-root>",
    "tsConfig": "<app-root>/tsconfig.app.json",
    "outputPath": "dist/<app-root>",
    "thirdParty": true,
    "external": ["*.png"]
  }
}
```

And this configuration includes only `lodash` in the bundle, while keeping `*.png` files as external assets.

```json
"build": {
  "executor": "@nx/esbuild:esbuild",
  "options": {
    "main": "<app-root>",
    "tsConfig": "<app-root>/tsconfig.app.json",
    "outputPath": "dist/<app-root>",
    "excludeFromExternal": ["lodash"],
    "external": ["*.png"]
  }
}
```

###### Skip type checking

Type checking is the slowest part of the build. You may want to skip type checking during build and run it as another job in CI.

```json
"build": {
  "executor": "@nx/esbuild:esbuild",
  "options": {
    "main": "<app-root>",
    "tsConfig": "<app-root>/tsconfig.app.json",
    "outputPath": "dist/<app-root>",
    "skipTypeCheck": true
  }
}
```

###### Additional esbuild options

Additional [esbuild options](https://esbuild.github.io/api/) can be passed using `esbuildOptions` in your project configuration.

```json
"build": {
  "executor": "@nx/esbuild:esbuild",
  "options": {
    "main": "<app-root>",
    "tsConfig": "<app-root>/tsconfig.app.json",
    "outputPath": "dist/<app-root>",
    "esbuildOptions": {
      "legalComments": "inline",
      "banner": {
        ".js": "// banner"
      },
      "footer": {
        ".js": "// footer"
      }
    }
  }
}
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `main` | string [**required**] | The path to the entry file, relative to project. |  |
| `outputPath` | string [**required**] | The output path of the generated files. |  |
| `tsConfig` | string [**required**] | The path to tsconfig file. |  |
| `additionalEntryPoints` | array | List of additional entry points. | `[]` |
| `assets` | array | List of static assets. | `[]` |
| `bundle` | boolean | Whether to bundle the main entry point and additional entry points. Set to false to keep individual output files. | `true` |
| `declaration` | boolean | Generate declaration (*.d.ts) files for every TypeScript or JavaScript file inside your project. Should be used for libraries that are published to an npm repository. |  |
| `declarationRootDir` | string | Sets the rootDir for the declaration (*.d.ts) files. |  |
| `deleteOutputPath` | boolean | Remove previous output before build. | `true` |
| `esbuildConfig` | string | Path to a esbuild configuration file. See https://esbuild.github.io/api/. Cannot be used with 'esbuildOptions' option. |  |
| `esbuildOptions` | object | Additional options to pass to esbuild. See https://esbuild.github.io/api/. Cannot be used with 'esbuildConfig' option. |  |
| `excludeFromExternal` | array | List of dependencies that should be excluded from the external list. This is useful when Nx automatically marks certain packages as external, but you want to bundle them instead. |  |
| `external` | array | Mark one or more module as external. Can use * wildcards, such as '*.png'. |  |
| `format` | array | List of module formats to output. Defaults to matching format from tsconfig (e.g. CJS for CommonJS, and ESM otherwise). | `["esm"]` |
| `generatePackageJson` | boolean | Generates a `package.json` and pruned lock file with the project's `node_module` dependencies populated for installing in a container. If a `package.json` exists in the project's directory, it will be reused with dependencies populated. | `false` |
| `metafile` | boolean | Generate a meta.json file in the output folder that includes metadata about the build. This file can be analyzed by other tools. | `false` |
| `minify` | boolean | Minifies outputs. | `false` |
| `outputFileName` | string | Name of the main output file. Defaults same basename as 'main' file. |  |
| `outputHashing` | string | Define the output filename cache-busting hashing mode. | `"none"` |
| `platform` | string | Platform target for outputs. | `"node"` |
| `skipTypeCheck` | boolean | Skip type-checking via TypeScript. Skipping type-checking speeds up the build but type errors are not caught. | `false` |
| `sourcemap` | string | Generate sourcemap. |  |
| `target` | string | The environment target for outputs. | `"esnext"` |
| `thirdParty` | boolean | Includes third-party packages in the bundle (i.e. npm packages). |  |
| `watch` | boolean | Enable re-building when files change. | `false` |
