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
        "outputPath": "dist/<app-root>"
      }
    }
  }
}
```

```bash
nx build <app-name>
```

## Examples

{% tabs %}
{% tab label="CommonJS output" %}

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

{% /tab %}
{% tab label="External packages" %}

External packages are not bundled by default. To included them in the bundle you can use either the `thirdParty` option to include all third-party dependencies, or use `excludeFromExternal` option to include specific dependencies in the bundle.

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

{% /tab %}
{% tab label="Skip type checking" %}

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

{% /tab %}
{% tab label="Additional esbuild options" %}

Additional [esbuild options](https://esbuild.github.io/api/) can be passed using `esbuildOptions` in your project configuration.

```json
"build": {
  "executor": "@nx/esbuild:esbuild",
  "options": {
    "main": "<app-root>",
    "tsConfig": "<app-root>/tsconfig.app.json",
    "outputPath": "dist/<app-root>",
    "esbuildOptions": {
      "legalComments": "inline"
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

{% /tab %}
{% /tabs %}
