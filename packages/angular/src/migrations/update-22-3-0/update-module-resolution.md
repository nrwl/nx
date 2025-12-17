#### Update `module` to `preserve` and `moduleResolution` to `bundler` in TypeScript configurations

Updates the TypeScript `module` and `moduleResolution` compiler options to `'preserve'` and `'bundler'` respectively for Angular projects. These settings are required for Angular's build system to work correctly with modern module resolution algorithms used by bundlers like Webpack, Vite, and esbuild.

#### Examples

The migration updates TypeScript configuration files in Angular projects to set both compiler options:

##### Before

```jsonc {4-5}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "module": "es2020",
    "moduleResolution": "node",
  },
}
```

##### After

```jsonc {4-5}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "bundler",
  },
}
```

If both values are already set correctly and inherited from an extended tsconfig file, the migration will not modify the configuration:

##### Before

```jsonc {5-6}
// apps/my-app/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "bundler",
  },
}
```

```jsonc {4-6}
// apps/my-app/tsconfig.app.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": [],
  },
}
```

##### After

```jsonc {5-6}
// apps/my-app/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "bundler",
  },
}
```

```jsonc {4-6}
// apps/my-app/tsconfig.app.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": [],
  },
}
```

The migration only processes TypeScript configuration files that are referenced by Angular project build targets, ensuring that only Angular-specific configurations are updated.
