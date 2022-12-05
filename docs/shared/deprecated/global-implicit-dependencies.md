# Global Implicit Dependencies

As of Nx 14.4, it is better to use [`inputs` and `namedInputs`](/more-concepts/customizing-inputs) instead of the `implicitDependencies` previously defined in `nx.json`. [`implicitDependencies` in the project configuration](/reference/project-configuration#implicitdependencies) are still the best way to manually set up a dependency between two projects that Nx is not able to detect automatically.

## Projects Depending on Global Files

The old way to have the `myapp` project depend on specific files in the root of the workspace was to use `implicitDependencies`, like this:

```json
{
  "implicitDependencies": {
    "globalConfig.js": ["myapp"],
    "styles/**/*.css": ["myapp"]
  }
}
```

To express the same dependencies with `inputs` and `namedInputs`, do this:

```json {% fileName="nx.json" %}
{
  "namedInputs": {
    "globalFiles": [
      "{workspaceRoot}/globalConfig.js",
      "{workspaceRoot}/styles/**/*.css"
    ]
  }
}
```

```json {% fileName="project.json" %}
{
  "targets": {
    "build": {
      "inputs": ["globalFiles" /* etc */]
    }
  }
}
```

For a more detailed explanation, read the [Customizing Inputs and Named Inputs guide](/more-concepts/customizing-inputs)

### Dependencies on Sections of the Root `package.json` File

You used to be able to set up dependencies on specific sections of the `package.json` file, like this:

```json
{
  "implicitDependencies": {
    "package.json": {
      "dependencies": "*",
      "devDependencies": {
        "mypackage": ["mylib"]
      },
      "scripts": {
        "check:*": "*"
      }
    }
  }
}
```

This never worked correctly with the caching mechanism and is not possible to specify using `inputs` and `namedInputs`.

As of Nx 15.3, you can create a root-level project and treat the root-level `package.json` scripts as targets like any other project and then set up the `dependsOn` property for those individual targets. Depending on your use case, this might be a sufficient replacement.
