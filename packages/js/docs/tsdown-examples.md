## Examples

##### Basic library build

Build a TypeScript library using tsdown with ESM output and declaration files:

```json title="libs/my-lib/project.json"
{
  "build": {
    "executor": "@nx/js:tsdown",
    "options": {
      "entry": ["src/index.ts"],
      "outDir": "dist",
      "format": ["esm"],
      "dts": true,
      "tsconfig": "libs/my-lib/tsconfig.lib.json"
    },
    "outputs": ["{projectRoot}/dist"]
  }
}
```

##### Multiple formats

Output both ESM and CJS formats:

```json title="libs/my-lib/project.json"
{
  "build": {
    "executor": "@nx/js:tsdown",
    "options": {
      "entry": ["src/index.ts"],
      "outDir": "dist",
      "format": ["esm", "cjs"],
      "dts": true,
      "tsconfig": "libs/my-lib/tsconfig.lib.json"
    },
    "outputs": ["{projectRoot}/dist"]
  }
}
```

##### Custom tsdown config

Use a `tsdown.config.ts` for full control over the build:

```json title="libs/my-lib/project.json"
{
  "build": {
    "executor": "@nx/js:tsdown",
    "options": {
      "configFile": "libs/my-lib/tsdown.config.ts"
    },
    "outputs": ["{projectRoot}/dist"]
  }
}
```
