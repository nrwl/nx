---
title: Examples for the Vite preview server executor
description: This page contains examples for the Vite @nx/vite:preview-server executor.
---

`project.json`:

```json
//...
"my-app": {
    "targets": {
        //...
        "preview": {
            "executor": "@nx/vite:preview-server",
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
nx preview my-app
```

## Examples

{% tabs %}
{% tab label="Set up a custom port" %}

You can always set the port in your `vite.config.ts` file. However, you can also set it directly in your `project.json` file, in the `preview` target options:

```json
//...
"my-app": {
    "targets": {
        //...
        "preview": {
            "executor": "@nx/vite:preview-server",
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
        "preview": {
            "executor": "@nx/vite:preview-server",
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
