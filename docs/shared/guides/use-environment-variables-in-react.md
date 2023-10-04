# Using environment variables in React applications

## For React applications using Vite

In React applications using Vite (e.g. those using `@nx/vite:*` executors), Nx includes the following variables in the build process:

- `NODE_ENV`
- Variables prefixed with `VITE_`, such as `VITE_CUSTOM_VAR`

You can read more about how to define environment variables in Vite [here](https://vitejs.dev/guide/env-and-mode.html).

You can then use these variables in your application code like so: `import.meta.env.VITE_CUSTOM_VAR`.

### Using environment variables in `index.html`

You cannot interpolate environment variables into your `index.html` file for React applications using Vite.

## For non-Vite React applications

In React applications (e.g. those using `@nx/web:webpack` or `@nx/next:build` executors for `build` target), Nx
includes the following variables in the build process:

- `NODE_ENV`
- Variables prefixed with `NX_`, such as `NX_CUSTOM_VAR`

Defining environment variables can vary between OSes. It's also important to know that this is temporary for the life of
the shell session.

### Using environment variables in `index.html`

Nx supports interpolating environment variables into your `index.html` file for React and Web applications.

To interpolate an environment variable named `NX_DOMAIN_NAME` into your `index.html`, surround it with `%` symbols like so:

```html {% fileName="index.html" %}
<html>
  <body>
    <p>The domain name is %NX_DOMAIN_NAME%.</p>
  </body>
</html>
```
