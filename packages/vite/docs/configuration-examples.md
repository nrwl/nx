This is a generator for setting up Vite configuration for an existing React or Web application. It will change the build and serve targets to use the `@nrwl/vite` executors for serving and building the application. This generator will modify your code, so make sure to commit your changes before running it.

```bash
nx g @nrwl/vite:configuration
```

When running this generator, you will be prompted to provide the following:

- The `project`, as the name of the project you want to generate the configuration for.
- The `uiFramework` you want to use. Supported values are: `react` and `none`.

You must provide a `project` and a `uiFramework` for the generator to work.

You can read more about how this generator works, in the [Vite package overview page](/packages/vite).

## Examples

### Change a React app to use Vite

```bash
nx g @nrwl/vite:configuration --project=my-app --uiFramework=react
```

This will change the `my-app` project to use Vite instead of the default Webpack configuration. The changes this generator will do are described in the [Vite package overview page](/packages/vite).

### Change a Web app to use Vite

```bash
nx g @nrwl/vite:configuration --project=my-app --uiFramework=none
```

This will change the `my-app` project to use Vite instead of the existing bundler configuration.
