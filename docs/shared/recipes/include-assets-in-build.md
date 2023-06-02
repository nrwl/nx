# Including Assets in Your Build

All the official Nx executors with an `assets` option have the same syntax.

There are two ways to identify assets to be copied into the output bundle:

1. Specify assets with a regex string. This will copy files over in the same folder structure as the source files.
2. Use the object format to redirect files into different locations in the output bundle.

```jsonc {% fileName="project.json" %}
"build": {
  "executor": "@nx/node:package",
  "options": {
    // shortened...
    "assets": [
      // Copies all the markdown files at the root of the project to the root of the output bundle
      "path-to-my-project/*.md",
      {
        "input": "./path-to-my-project/src", // look in the src folder
        "glob": "**/*.!(ts)", // for any file (in any folder) that is not a typescript file
        "output": "./src" // put those files in the src folder of the output bundle
      },
      {
        "input": "./path-to-my-project", // look in the project folder
        "glob": "executors.json", // for the executors.json file
        "output": "." // put the file in the root of the output bundle
      }
    ]
  }
}
```
