#### Removes Redundant TypeScript Project References from tsconfig.json Files

Removes redundant TypeScript project references from `tsconfig.json` files when runtime tsconfig files (e.g., `tsconfig.lib.json`, `tsconfig.app.json`) exist. Previously, external project references were duplicated in both the project's `tsconfig.json` and runtime tsconfig files. This migration syncs the TypeScript project references to match the project graph, ensuring that external references only appear in runtime tsconfig files when they exist.

#### Examples

When a project has runtime tsconfig files like `tsconfig.lib.json`, the migration will remove external project references from the project's `tsconfig.json` file:

##### Before

```jsonc {7-9}
// libs/my-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true
  },
  "references": [
    {
      "path": "../other-lib"
    }
  ]
}
```

##### After

```jsonc {6}
// libs/my-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true
  },
  "references": []
}
```

The external references remain in the runtime tsconfig file where they belong:

##### Before

```jsonc {7-9}
// libs/my-lib/tsconfig.lib.json
{
  "compilerOptions": {
    "composite": true
  },
  "references": [
    {
      "path": "../other-lib/tsconfig.lib.json"
    }
  ]
}
```

##### After

```jsonc {7-9}
// libs/my-lib/tsconfig.lib.json
{
  "compilerOptions": {
    "composite": true
  },
  "references": [
    {
      "path": "../other-lib/tsconfig.lib.json"
    }
  ]
}
```

For projects without runtime tsconfig files, the project's `tsconfig.json` file will continue to contain external project references:

##### Before

```jsonc {7-9}
// libs/legacy-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true
  },
  "references": [
    {
      "path": "../other-lib"
    }
  ]
}
```

##### After

```jsonc {7-9}
// libs/legacy-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true
  },
  "references": [
    {
      "path": "../other-lib"
    }
  ]
}
```

Internal project references (references within the same project directory) are preserved in the project's `tsconfig.json`:

##### Before

```jsonc {7-12}
// libs/my-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true
  },
  "references": [
    {
      "path": "./tsconfig.lib.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ]
}
```

##### After

```jsonc {7-12}
// libs/my-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true
  },
  "references": [
    {
      "path": "./tsconfig.lib.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ]
}
```
