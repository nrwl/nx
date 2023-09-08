---
title: Next.js builder executor examples
description: This page contains examples for the @nx/next:build executor.
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
    "build": {
      "executor": "@nx/next:build",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/acme"
      }
    }
    //...
  }
}
```

```bash
nx run acme:build
```

## Examples

### For Next.js Standalone projects

{% tabs %}
{% tab label="Default configuration" %}

This is the default configuration for Next.js standalone projects. Our `@nx/next:build` executor is integrated to use Next.js' CLI. You can read more about the build options at [Next.js CLI Options](https://nextjs.org/docs/app/api-reference/next-cli)

```json
    "build": {
      "executor": "@nx/next:build",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/acme"
      },
      "configurations": {
        "development": {
          "outputPath": "."
        },
        "production": {}
      }
    },
```

{% /tab %}
{% tab label="Enable debug" %}

You can create a debug build for more verbose output by:

Using the `--debug` flag

```shell
nx run acme:build:development --debug
```

Updating the build options to include `debug`.

```json
    "build": {
      "executor": "@nx/next:build",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/acme"
      },
      "configurations": {
        "development": {
          "outputPath": ".",
          "debug": true
        },
        "production": {}
      }
    },
```

```bash
nx run acme:build:development
```

{% /tab %}

{% tab label="Adding profiling" %}

You can enable profiing for React by

Using the `--profile` flag

```shell
nx run acme:build:production --profile
```

Updating the build options to include `profile`.

```json
    "build": {
      "executor": "@nx/next:build",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/acme"
      },
      "configurations": {
        "development": {
          "outputPath": ".",
        },
        "production": {
          "profile": true
        }
      }
    },
```

```shell
nx run acme:build:production
```

{% /tab %}

{% tab label="Enable experimental app only" %}

Since Next.js 13 the `app/` directory it is reserved.
You can enable to build only `app/` routes by

Using the `--experimentalAppOnly` flag

```shell
nx run acme:build:production --experimentalAppOnly
```

Updating the build options to include `experimentalAppOnly`.

```json
    "build": {
      "executor": "@nx/next:build",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/acme"
      },
      "configurations": {
        "development": {
          "outputPath": ".",
          "experimentalAppOnly": true
        },
        "production": {}
      }
    },
```

```shell
nx run acme:build:production
```

{% /tab %}

{% /tabs %}
