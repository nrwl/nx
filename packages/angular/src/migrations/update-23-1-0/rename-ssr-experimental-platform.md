#### Rename `ssr.experimentalPlatform` to `ssr.platform`

Angular v22 renamed the `@angular/build:application` SSR `experimentalPlatform` option to `platform` and removed the old key. This migration renames `ssr.experimentalPlatform` to `ssr.platform` in the options and configurations of application targets in `project.json`, covering the `@angular/build:application` and `@angular-devkit/build-angular:application` builders as well as the `@nx/angular:application` executor that wraps them.

#### Examples

##### Before

```jsonc {9}
// project.json
{
  "targets": {
    "build": {
      "executor": "@nx/angular:application",
      "options": {
        "ssr": {
          "entry": "src/server.ts",
          "experimentalPlatform": "neutral",
        },
      },
    },
  },
}
```

##### After

```jsonc {9}
// project.json
{
  "targets": {
    "build": {
      "executor": "@nx/angular:application",
      "options": {
        "ssr": {
          "entry": "src/server.ts",
          "platform": "neutral",
        },
      },
    },
  },
}
```
