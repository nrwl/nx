`project.json`:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nrwl/vite:build",
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
            "executor": "@nrwl/vite:build",
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
            "executor": "@nrwl/vite:build",
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

{% tab label="Adding assets" %}

Assets are non-JS and non-TS files, such as images, CSS, etc. You can add them to the project configuration as follows.

```jsonc
"serve": {
 "executor": "@nrwl/vite:build",
  "options": {
    //...
    "assets": [
      { "input": "apps/my-app", "glob": "README.md", "output": "/" },
      { "input": "apps/my-app", "glob": "logo.png", "output": "/" },
      { "input": "apps/my-app", "glob": "docs/**/*.md", "output": "/docs" },
      //...
    ]
 }
}
```

Running `nx build my-app` outputs something like this.

```text
dist/apps/my-app/
├── README.md
├── docs
│   ├── CONTRIBUTING.md
│   └── TESTING.md
├── index.js
├── logo.png
└── package.json
```

{% /tab %}

{% /tabs %}
