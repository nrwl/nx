# Using environment variables in React applications

## For React applications using Vite

In React applications using Vite (e.g. those using `@nx/vite:*` executors), Nx includes the following variables in the build process:

- `NODE_ENV`
- Variables prefixed with `VITE_`, such as `VITE_CUSTOM_VAR`

You can read more about how to define environment variables in Vite [here](https://vitejs.dev/guide/env-and-mode.html).

You can then use these variables in your application code like so: `import.meta.env.VITE_CUSTOM_VAR`.

### Environment Variable Conflict between Nx and Vite

When using Nx with Vite, you may encounter an issue related to loading environment variables that can lead to unexpected behavior. This issue arises due to the way Nx and Vite handle environment files and configuration settings.

1. **Nx Environment Variable Loading**: Nx loads environment variables from configuration names using the `--configuration` flag. This is the preferred method in Nx, especially when you have a default configuration specified in your `project.json` file for most targets. In our [guide on how to define environment variables](/recipes/tips-n-tricks/define-environment-variables), you can see that if you're using the `configuration` option, then Nx will load `.env.[configuration-name]` files.

2. **Vite Environment Variable Loading**: Vite loads environment files named `.env.[mode]` using the `--mode` flag.

The conflict occurs when you use the `--configuration` flag in Nx. In such cases, the `--mode` flag in Vite is ignored. For example, this behavior can be particularly confusing, as it may seem like you are always loading the `development` mode in Vite, instead of the expected one, if you're using the `--configuration=development` setting or if your default configuration is `development`.

The root cause of this issue is that Nx has already loaded variables from `.env.[configuration]`. So any variables defined in both Nx and Vite's `.env.[mode]` files will have their values overridden by the Nx-loaded values.

#### Solution

We recommend that developers adapt to the Nx way of handling environment variables and refer to our [documentation on defining environment variables](/recipes/tips-n-tricks/define-environment-variables). This will help ensure consistent behavior and prevent conflicts when using Nx with Vite.

However, if you still want to use Vite's `mode`, you still can. To ensure seamless integration between Nx and Vite environment variables, you can establish a clear distinction between `configuration` and `mode` names. By assigning distinct names to both `configuration` and `mode`, you can eliminate any potential conflicts that may arise during environment variable loading. Additionally, consider defining custom configurations in your Nx workspace, each with a corresponding `mode` option. For example, you can create configurations like `development`, `production`, and `staging`, each with its respective `mode` set, like this:

```json
"configurations": {
  "development": {
    "mode": "development"
  },
  "production": {
    "mode": "production"
  },
  "staging": {
    "mode": "staging"
  },
  "my-other-mode": {
    "mode": "my-other-mode"
  }
}
```

That way, you can set the `--configuration` flag to `development`, `production`, or `staging` to load the corresponding `.env.[configuration]` file, and this will respect the `mode` set in the configuration.

### Using environment variables in `index.html`

You cannot interpolate environment variables into your `index.html` file for React applications using Vite.

## For non-Vite React applications

In React applications (e.g. those using the `@nx/web:webpack` executor or an [inferred task](/concepts/inferred-tasks) that runs the Webpack CLI for building), Nx
includes the following variables in the build process:

- `NODE_ENV`
- Variables prefixed with `NX_PUBLIC`, such as `NX_PUBLIC_CUSTOM_VAR` (when using the [NxWebpackPlugin](/recipes/webpack/webpack-plugins#nxwebpackplugin) or the [withNx](/recipes/webpack/webpack-plugins#withnx) plugins)

Defining environment variables can vary between OSes. It's also important to know that this is temporary for the life of
the shell session.

### Using environment variables in `index.html`

Nx supports interpolating environment variables into your `index.html` file for React and Web applications built with Webpack.
This feature is available when using the [NxWebpackPlugin](/recipes/webpack/webpack-plugins#nxwebpackplugin) or the [withNx](/recipes/webpack/webpack-plugins#withnx) plugins.

{% callout type="note" title="Predefined Nx variable" %}
Note that with the release of Nx 19, you won't be able to use predefined Nx variable on this [link](/reference/environment-variables).
{% /callout %}

To interpolate an environment variable named `NX_PUBLIC_DOMAIN_NAME` into your `index.html`, surround it with `%` symbols like so:

```html {% fileName="index.html" %}
<html>
  <body>
    <p>The domain name is %NX_PUBLIC_DOMAIN_NAME%.</p>
  </body>
</html>
```
