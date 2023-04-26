# Global Implicit Dependencies

Since v14.4, Nx supports [`inputs` and `namedInputs`](/more-concepts/customizing-inputs) for setting up implicit dependencies. As of Nx v16, the `implicitDependencies` defined in `nx.json` are ignored and do not influence the affected graph. This field will be removed in v17. The [`implicitDependencies` in the project configuration](/reference/project-configuration#implicitdependencies) are still the best way to manually set up a dependency between two projects that Nx is not able to detect automatically.

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

To express the same dependencies with `inputs` and `namedInputs`, modify the default `sharedGlobals` named input:

```json {% fileName="nx.json" %}
{
  "namedInputs": {
    "sharedGlobals": [
      "{workspaceRoot}/globalConfig.js",
      "{workspaceRoot}/styles/**/*.css"
    ],
    "default": [
      "sharedGlobals"
      // etc
    ]
  }
}
```

The `sharedGlobals` are included in the `default` named input, so most targets will be set up to depend on them.

For a more detailed explanation, read the [Customizing Inputs and Named Inputs guide](/more-concepts/customizing-inputs)

### Dependencies on Sections of the Root `package.json` File

You used to be able to set up dependencies on specific packages in the `dependencies` and `devDependencies` sections of the `package.json` file, like this:

```json
{
  "implicitDependencies": {
    "package.json": {
      "dependencies": "*",
      "devDependencies": {
        "mypackage": ["mylib"]
      }
    }
  }
}
```

As of Nx 15, this is inferred automatically by Nx based on the `import` statements in your code. These `implicitDependencies` can be safely deleted.
