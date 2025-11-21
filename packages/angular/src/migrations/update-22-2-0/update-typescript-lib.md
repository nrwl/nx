#### Update TypeScript `lib` compiler option to ES2022

Updates the TypeScript `lib` compiler option in Angular projects to ensure compatibility with Angular v21+, which requires ES2022 as the minimum ECMAScript version. The migration upgrades any ES versions older than ES2022 (such as ES2015, ES2020, etc.) to ES2022 while preserving other library entries like `'dom'`, `'webworker'`, etc.

#### Examples

The migration processes TypeScript configuration files referenced by Angular project build targets and updates the `lib` compiler option when outdated ES versions are detected:

##### Before

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["es2020", "dom"]
  }
}
```

##### After

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["dom", "es2022"]
  }
}
```

When the `lib` array contains only an ES version older than ES2022 without additional entries, it is upgraded:

##### Before

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["es2020"]
  }
}
```

##### After

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["es2022"]
  }
}
```

If the configuration already uses ES2022 or higher (e.g., `'es2023'`, `'esnext'`), no changes are made:

##### Before

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["es2022", "dom"]
  }
}
```

##### After

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["es2022", "dom"]
  }
}
```

When the `lib` array contains multiple library entries, only the ES version is upgraded while all other entries are preserved:

##### Before

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["es2020", "dom", "webworker"]
  }
}
```

##### After

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["dom", "webworker", "es2022"]
  }
}
```

The migration only processes TypeScript configuration files that are referenced by Angular project build targets, ensuring that only Angular-specific configurations are updated.
