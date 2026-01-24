#### Update `moduleResolution` to `bundler` in TypeScript configurations

Updates the TypeScript `moduleResolution` option to `'bundler'` for improved compatibility with modern package resolution algorithms used by bundlers like Webpack, Vite, and esbuild.

#### Examples

The migration will update TypeScript configuration files in your workspace to use the `'bundler'` module resolution strategy:

##### Before

```json title="apps/app1/tsconfig.app.json" {4}
{
  "compilerOptions": {
    "module": "es2020",
    "moduleResolution": "node"
  }
}
```

##### After

```json title="apps/app1/tsconfig.app.json" {4}
{
  "compilerOptions": {
    "module": "es2020",
    "moduleResolution": "bundler"
  }
}
```

If the `moduleResolution` is already set to `'bundler'` or the `module` is set to `'preserve'`, the migration will not modify the configuration:

##### Before

```json title="apps/app1/tsconfig.app.json" {3-4}
{
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "node"
  }
}
```

##### After

```json title="apps/app1/tsconfig.app.json" {3-4}
{
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "node"
  }
}
```
