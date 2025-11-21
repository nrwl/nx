---
title: Next.js server executor examples
description: This page contains examples for the @nx/next:serve executor.
---

`project.json`:

```json
//...
{
  "name": "acme",
  "$schema": "node_modules/nx/schemas/project-schema.json",
  "sourceRoot": ".",
  "projectType": "application",
  "targets": {
    //...
    "serve": {
      "executor": "@nx/next:server",
      "defaultConfiguration": "production",
      "options": {
        "buildTarget": "acme:build",
        "dev": true
      }
    }
    //...
  }
}
```

```bash
nx run acme:serve
```

## Examples

### For Next.js Standalone projects

{% tabs %}
{% tab label="Default configuration" %}

This is the default configuration for Next.js standalone projects. Our `@nx/next:server` executor is integrated to use Next.js' CLI. You can read more about the serve options at [Next.js CLI Options](https://nextjs.org/docs/app/api-reference/next-cli)

```json
    "serve": {
      "executor": "@nx/next:server",
      "defaultConfiguration": "development",
      "options": {
        "buildTarget": "acme:build",
        "dev": true
      },
      "configurations": {
        "development": {
          "buildTarget": "acme:build:development",
          "dev": true
        },
        "production": {
          "buildTarget": "acme:build:production",
          "dev": false
        }
      }
    },
```

{% /tab %}
{% tab label="Choosing your bundler" %}

Turbopack is a cutting-edge bundler designed for JavaScript and TypeScript. To read more about supported features see [Next.js Turbopack Documentation](https://turbo.build/pack/docs/features)

**Important: Next.js 16 changed the default bundler**

- **Next.js 15 and below**: Webpack is the default bundler. Use `--turbo` to enable Turbopack.
- **Next.js 16 and above**: Turbopack is the default bundler. Use `--webpack` to use Webpack instead.

### Using Turbopack in Next.js 15 and below

Append the `--turbo` flag while executing the Nx development server:

```shell
nx run acme:serve --turbo
```

Or update the serve options to include `turbo`:

```json
    "serve": {
      "executor": "@nx/next:server",
      "defaultConfiguration": "development",
      "options": {
        "buildTarget": "acme:build",
        "dev": true
      },
      "configurations": {
        "development": {
          "buildTarget": "acme:build:development",
          "dev": true,
          "turbo": true
        }
      }
    }
```

### Using Webpack in Next.js 16 and above

If you need to use Webpack instead of the default Turbopack in Next.js 16+:

```shell
nx run acme:serve --webpack
```

Or update the serve options to include `webpack`:

```json
    "serve": {
      "executor": "@nx/next:server",
      "defaultConfiguration": "development",
      "options": {
        "buildTarget": "acme:build",
        "dev": true
      },
      "configurations": {
        "development": {
          "buildTarget": "acme:build:development",
          "dev": true,
          "webpack": true
        }
      }
    }
```

{% /tab %}

{% tab label="Adding keep alive timeout" %}

When using Nx with Next.js behind a downstream proxy, it's important to make sure that the `keep-alive timeouts` of Next.js' HTTP server are set to longer durations than the timeouts of the proxy. If you don't do this, Node.js will unexpectedly end TCP connections without notifying the proxy when the `keep-alive timeout` is reached. This can lead to a proxy error when the proxy tries to reuse a connection that Node.js has already terminated.

To configure timeout values (in milliseconds) you can:

Pass `--keepAliveTimeout`

```shell
nx run acme:serve --keepAliveTimeout 60000
```

Updating the serve options to include `keepAliveTimeout`.

```json
    "serve": {
      "executor": "@nx/next:server",
      "defaultConfiguration": "development",
      "options": {
        "buildTarget": "acme:build",
        "dev": true
      },
      "configurations": {
        "development": {
          "buildTarget": "acme:build:development",
          "dev": true,
          "keepAliveTimeout": 60000
        },
        //
    }
  }
```

```shell
nx run acme:serve
```

{% /tab %}

{% /tabs %}
