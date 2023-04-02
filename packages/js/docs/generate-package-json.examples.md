---
title: Examples for the generate package json executor
description: This page contains examples for the js @nx/js:generate-package-json executor.
---

`project.json`:

```json
{
  "name": "api",
  //...
  "targets": {
    "build": {
      "dependsOn": [
        { "projects": "self", "target": "build-api", "params": "forward" }
      ],
      "executor": "@nx/js:generate-package-json",
      "options": {
        "outputPath": "dist/apps/api",
        "main": "apps/api/src/main.ts",
        "tsConfig": "apps/api/tsconfig.app.json"
      }
    },
    "build-api": {
      "executor": "@nx/vite:build",
      //...
      "configurations": {
        "production": {
          "mode": "production"
        }
      }
    },
    "serve": {
      "executor": "@nx/vite:dev-server",
      //...
      "configurations": {
        "production": {
          "buildTarget": "api:build:production"
        }
      }
    }
  }
}
```

```bash
nx build api --prod
nx build api --dev
```
