# Incremental Builds

Building applications incrementally is one of the main ways to scale your development as your applications getting bigger.

For instance, say we generate an application and a library, and then import the library from the application:

```bash
nx g @nrwl/react:app myapp
nx g @nrwl/react:lib mylib
```

In this case `mylib` isn't a buildable library. We can test and lint it independently, but the only way to build it is by building some application using it (in this case `myapp`). For small and medium size applications this provides the best dev experience because WebPack is optimized for this scenario. But as your application keeps growing, the dev experience degrades.

## Buildable Libraries

Now let's create a buildable library instead (you can always make an existing library buildable after the fact).

```bash
nx g @nrwl/react:app myapp
nx g @nrwl/react:lib mylib --buildable
```

Every buildable library has a build task:

```json
{
  "build": {
    "builder": "@nrwl/web:package",
    "options": {
      "outputPath": "dist/libs/mylib",
      "tsConfig": "libs/mylib/tsconfig.lib.json",
      "project": "libs/mylib/package.json",
      "entryFile": "libs/mylib/src/index.ts",
      "external": ["react", "react-dom"],
      "babelConfig": "@nrwl/react/plugins/bundle-babel",
      "rollupConfig": "@nrwl/react/plugins/bundle-rollup"
    }
  }
}
```

When building the app, we need to first run `nx build mylib` and then `nx build myapp`. As the number of libraries grows, running these commands quickly becomes unworkable. Instead, we can run `nx build myapp --with-deps`.

Running `nx build myapp --with-deps` is basically the same as running `nx run-many --target=build --projects=myapp --with-deps`. Nx will look at all the dependencies of `myapp`, and will build them in the right order. So if say some `parentlib` depends on `childlib`, `childlib` will be built first. Nx will build whatever it can in parallel.

When using buildable libraries, the application doesn't depend on the source code of the library. Instead, it depends on the compiled output. This is what lets you save a lot of time and make your builds fast.

## Incremental Builds and Cache

It's costly to rebuild all the buildable libraries from scratch every time you want to serve the app. That's why the Nx computation caching is so important. The caching allows us to only rebuild a small subset of the libraries, which results in much better performance.

If we can share the cache with our teammates, we can get a much better dev experience. For instance, [this repo](https://github.com/nrwl/nx-incremental-large-repo) has a large application, where `nx serve` takes just a few seconds. Check out [nx.app](https://nx.app) for more information on how to do it.

## Restrictions

- Buildable libraries can only depend on other buildable libraries.
