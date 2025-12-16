#### Set `isolatedModules` to `true` in TypeScript test configurations

Sets the TypeScript `isolatedModules` compiler option to `true` in `tsconfig.spec.json` files for Angular projects using the Jest test runner.

#### Examples

The migration updates TypeScript test configuration files in Angular projects using the Jest test runner to set the `isolatedModules` compiler option:

##### Before

```jsonc {3-5}
// apps/my-app/tsconfig.spec.json
{
  "compilerOptions": {
    "outDir": "./out-tsc/spec"
  }
}
```

##### After

```jsonc {4-5}
// apps/my-app/tsconfig.spec.json
{
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "isolatedModules": true
  }
}
```

If the value is already set to `true` or inherited from an extended tsconfig file, the migration will not modify the configuration:

##### Before

```jsonc {4}
// tsconfig.json
{
  "compilerOptions": {
    "isolatedModules": true
  }
}
```

```jsonc {4-6}
// apps/my-app/tsconfig.spec.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec"
  }
}
```

##### After

```jsonc {4}
// tsconfig.json
{
  "compilerOptions": {
    "isolatedModules": true
  }
}
```

```jsonc {4-6}
// apps/my-app/tsconfig.spec.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec"
  }
}
```

The migration only processes TypeScript test configuration files (`tsconfig.spec.json` or custom test tsconfig files referenced by `@nx/jest:jest` tasks) in Angular projects.
