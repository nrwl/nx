#### Migrate `development` custom condition to unique workspace-specific name

Replace the TypeScript `development` custom condition with a unique workspace-specific name to avoid conflicts when consuming packages in other workspaces.

#### Examples

The migration will update the custom condition name in both `tsconfig.base.json` and all workspace package.json files that use the `development` custom condition:

##### Before

```json title="tsconfig.base.json" {3}
{
  "compilerOptions": {
    "customConditions": ["development"]
  }
}
```

##### After

```json title="tsconfig.base.json" {3}
{
  "compilerOptions": {
    "customConditions": ["@my-org/source"] // assuming the root package.json name is `@my-org/source`
  }
}
```

The migration also updates `package.json` files that use the `development` condition in their `exports` field and point to TypeScript files:

##### Before

```json title="libs/my-lib/package.json" {5}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "default": "./dist/index.js"
    }
  }
}
```

##### After

```json title="libs/my-lib/package.json" {5}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "@my-org/source": "./src/index.ts",
      "default": "./dist/index.js"
    }
  }
}
```

If the custom condition is not set to `["development"]` or the `package.json`'s `exports` field doesn't point to TypeScript files, the migration will not modify the configuration:

##### Before

```json title="libs/my-lib/package.json" {5}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "development": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

##### After

```json title="libs/my-lib/package.json" {5}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "development": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```
