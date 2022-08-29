# Using environment variables in React applications

In React applications (e.g. those using `@nrwl/web:webpack` or `@nrwl/next:build` executors for `build` target), Nx
includes the following variables in the build process:

- `NODE_ENV`
- Variables prefixed with `NX_`, such as `NX_CUSTOM_VAR`

Defining environment variables can vary between OSes. It's also important to know that this is temporary for the life of
the shell session.

## Using environment variables in `index.html`

Nx supports interpolating environment variables into your `index.html` file for React and Web applications.

To interpolate an environment variable named `NX_DOMAIN_NAME` into your `index.html`, surround it with `%` symbols like so:

```html
<html>
  <body>
    <p>The domain name is %NX_DOMAIN_NAME%.</p>
  </body>
</html>
```
