#### Add Localize Polyfill to Targets

Add the '@angular/localize/init' polyfill to the 'polyfills' option of targets using esbuild-based executors.

#### Sample Code Changes

Add the `@angular/localize/init` polyfill to any of these executors:

- `@angular/build:application`
- `@angular-devkit/build-angular:application`
- `@nx/angular:application`
- `@angular-devkit/build-angular:browser-esbuild`
- `@nx/angular:browser-esbuild`

##### Before

```json title="apps/app1/project.json"
{
  "targets": {
    "build": {
      "executor": "@angular/build:application",
      "options": {
        "localize": true
      }
    }
  }
}
```

##### After

```json title="apps/app1/project.json"
{
  "targets": {
    "build": {
      "executor": "@angular/build:application",
      "options": {
        "localize": true,
        "polyfills": ["@angular/localize/init"]
      }
    }
  }
}
```
