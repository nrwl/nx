---
title: Examples for the Vite dev server executor
description: This page contains examples for the Vite @nx/vite:dev-server executor.
---

`project.json`:

```json
//...
"my-app": {
    "targets": {
        //...
        "serve": {
            "executor": "@nx/vite:dev-server",
            "defaultConfiguration": "development",
            "options": {
                "buildTarget": "my-app:build",
            },
            "configurations": {
                ...
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
{% tab label="Set up a custom port" %}

You can always set the port in your `vite.config.ts` file. However, you can also set it directly in your `project.json` file, in the `serve` target options:

```json
//...
"my-app": {
    "targets": {
        //...
        "serve": {
            "executor": "@nx/vite:dev-server",
            "defaultConfiguration": "development",
            "options": {
                "buildTarget": "my-app:build",
                "port": 4200,
            },
            "configurations": {
                ...
            }
        },
    }
}
```

{% /tab %}
{% tab label="Specify a proxyConfig" %}

You can specify a proxy config by pointing to the path of your proxy configuration file:

```json
//...
"my-app": {
    "targets": {
        //...
        "serve": {
            "executor": "@nx/vite:dev-server",
            "defaultConfiguration": "development",
            "options": {
                "buildTarget": "my-app:build",
                "proxyConfig": "apps/my-app/proxy.conf.json"
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
