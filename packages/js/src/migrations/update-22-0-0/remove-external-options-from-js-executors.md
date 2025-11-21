#### Remove the `external` and `externalBuildTargets` Options from the `@nx/js:swc` and `@nx/js:tsc` Executors

Remove the deprecated `external` and `externalBuildTargets` options from the `@nx/js:swc` and `@nx/js:tsc` executors. These options were used for inlining dependencies, which was an experimental feature and has been deprecated for a long time. The migration only removes the options from the project configuration and target defaults. If you rely on inlining dependencies, you need to make sure they are all buildable or use a different build tool that supports bundling.

#### Sample Code Changes

Remove `external` and `externalBuildTargets` from the `@nx/js:swc` or `@nx/js:tsc` executor options in project configuration.

{% tabs %}
{% tab label="Before" %}

```json {% fileName="libs/my-lib/project.json" highlightLines=[9,10] %}
{
  "targets": {
    "build": {
      "executor": "@nx/js:swc",
      "options": {
        "main": "libs/my-lib/src/index.ts",
        "outputPath": "dist/libs/my-lib",
        "tsConfig": "libs/my-lib/tsconfig.lib.json",
        "external": ["react", "react-dom"],
        "externalBuildTargets": ["build"]
      }
    }
  }
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="libs/my-lib/project.json" %}
{
  "targets": {
    "build": {
      "executor": "@nx/js:swc",
      "options": {
        "main": "libs/my-lib/src/index.ts",
        "outputPath": "dist/libs/my-lib",
        "tsConfig": "libs/my-lib/tsconfig.lib.json"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

Remove `external` and `externalBuildTargets` from the `@nx/js:swc` or `@nx/js:tsc` executor target defaults in `nx.json`.

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" highlightLines=[8,9] %}
{
  "targetDefaults": {
    "@nx/js:swc": {
      "options": {
        "main": "{projectRoot}/src/index.ts",
        "outputPath": "dist/{projectRoot}",
        "tsConfig": "{projectRoot}/tsconfig.lib.json",
        "external": "all",
        "externalBuildTargets": ["build"]
      }
    }
  }
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "@nx/js:swc": {
      "options": {
        "main": "{projectRoot}/src/index.ts",
        "outputPath": "dist/{projectRoot}",
        "tsConfig": "{projectRoot}/tsconfig.lib.json"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}
