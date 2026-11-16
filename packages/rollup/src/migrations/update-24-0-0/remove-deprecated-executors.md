#### Convert `@nx/rollup:rollup` targets to inferred tasks

Nx 24 removes the `@nx/rollup:rollup` executor and its `@nrwl/rollup:rollup` alias. The migration registers `@nx/rollup/plugin` in `nx.json` and converts the targets that use those executors to inferred tasks. It writes the executor options into a Rollup config file in the project root. A target with nothing left to override is removed from project configuration. When several projects share the same remaining options, those options move to a `targetDefaults` entry scoped to the plugin. `targetDefaults` entries keyed by a removed executor are removed once no target uses that executor.

The migration lists the targets the converter cannot convert safely. In agentic runs, an AI prompt finishes them and validates the project graph.

#### Sample code changes

##### Before

```json title="mypkg/project.json"
{
  "name": "mypkg",
  "targets": {
    "build": {
      "executor": "@nx/rollup:rollup",
      "outputs": ["{options.outputPath}"],
      "options": {
        "main": "mypkg/src/index.ts",
        "outputPath": "dist/mypkg",
        "tsConfig": "mypkg/tsconfig.lib.json",
        "compiler": "babel",
        "format": ["esm"],
        "external": [],
        "assets": []
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/rollup/plugin",
      "options": {
        "buildTargetName": "build"
      }
    }
  ]
}
```
