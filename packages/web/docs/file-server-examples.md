---
title: Examples for the Web file-server executor
description: This page contains examples for the Vite @nx/web:file-server executor.
---

`project.json`:

```json5
"myapp": {
  "targets": {
    "serve": {
      "executor": "@nx/web:file-server",
      "options": {
        "buildTarget": "build",
        "port": 3000,
      },
    },
    "build": {
      "outputs": ["{workspaceRoot}/dist/myapp"],
      "command": "echo 'Generating index.html' && mkdir -p dist && echo '<h1>Works</h1>' > dist/myapp/index.html"
    },
  }
}
```

```shell
nx serve myapp
```

## Examples

{% tabs %}
{% tab label="Additional http-server options" %}

There are additional options from `http-server` that can be passed as CLI args. For example, to enable directory listing, pass `-d` as follows:

```shell
nx serve myapp -d
```

Refer to the [`http-server`](https://www.npmjs.com/package/http-server) package for all available options.

{% /tab %}
{% /tabs %}
