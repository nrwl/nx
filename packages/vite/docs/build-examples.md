---
title: Examples for the Vite builder executor
description: This page contains examples for the Vite @nx/vite:build executor.
---

`project.json`:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nx/vite:build",
            //...
            //...
            "options": {
                "outputPath": "dist/apps/my-app"
            },
                //...
            }
        },
    }
}
```

```bash
nx serve my-app
```

## Examples

{% tabs %}
{% tab label="Set a custom path for vite.config.ts" %}

Nx will automatically look in the root of your application for a `vite.config.ts` (or a `vite.config.js`) file. If you want to use a different path, you can set it in your `project.json` file, in the `build` target options:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nx/vite:build",
            //...
            "options": {
                "outputPath": "dist/apps/my-app",
                "configFile": "apps/my-app/vite.config.other-path.ts"
            },
            "configurations": {
                ...
            }
        },
    }
}
```

or even

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nx/vite:build",
            //...
            "options": {
                "outputPath": "dist/apps/my-app",
                "configFile": "vite.config.base.ts"
            },
            "configurations": {
                ...
            }
        },
    }
}
```

{% /tab %}

{% /tabs %}
