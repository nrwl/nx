`<app-root>/project.json`:

```json
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
```

{% /tab %}
{% tab label="External packages" %}

You can avoid packages from being bundled by providing the `external` option with a list of packages to skip.

You can also use `*` wildcard to match assets.

```json
"build": {
  "executor": "@nx/esbuild:esbuild",
  "options": {
  "main": "<app-root>",
  "tsConfig": "<app-root>/tsconfig.app.json",
  "outputPath": "dist/<app-root>",
  "external": ["lodash", "*.png"]
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
```

{% /tab %}
{% tabs %}
