# Environment Variables

Environment variables are global system variables accessible by all the processes running under the Operating System (OS). Environment variables are useful to store system-wide values such as the directories to search for executable programs (PATH), OS version, Network Information, and custom variables. These env variables are passed at build time and used at the runtime of an app.

## How to Use

It's important to note that NX will only include in the process:

- default env vars such as: `NODE_ENV`
- any environment variable prefixed with `NX_` such as: `NX_CUSTOM_VAR`

Defining environment variables can vary between OSes. It’s also important to know that this is temporary for the life of the shell session.

**Unix systems**

In Unix systems, we need to pass the env vars before passing the (or other) commands \

Let's say we want to build with development mode, with env vars we can do that like so:

```bash
NODE_ENV=development nx build myapp
```

And if we want to add a custom env var for the command above, it would look like:

```bash
NODE_ENV=development NX_BUILD_NUMBER=123 nx build myapp
```

**Windows (cmd.exe)**

```bash
set "NODE_ENV=development" && nx build myapp
```

**Windows (Powershell)**

```bash
($env:NODE_ENV = "development") -and (nx build myapp)
```

## Loading Environment Variables

By default, Nx will load any environment variables you place in the following files:

1. `workspaceRoot/apps/my-app/.local.env`
2. `workspaceRoot/apps/my-app/.env.local`
3. `workspaceRoot/apps/my-app/.env`
4. `workspaceRoot/.local.env`
5. `workspaceRoot/.env.local`
6. `workspaceRoot/.env`

Order is important. Nx will move through the above list, ignoring files it can't find, and loading environment variables into the current process for the ones it can find. If it finds a variable that has already been loaded into the process, it will ignore it. It does this for two reasons:

1. Developers can't accidentally overwrite important system level variables (like `NODE_ENV`)
2. Allows developers to create `.env.local` or `.local.env` files for their local environment and override any project defaults set in `.env`

For example:

1. `workspaceRoot/apps/my-app/.env.local` contains `AUTH_URL=http://localhost/auth`
2. `workspaceRoot/apps/my-app/.env` contains `AUTH_URL=https://prod-url.com/auth`
3. Nx will first load the variables from `apps/my-app/.env.local` into the process. When it tries to load the variables from `apps/my-app/.env`, it will notice that `AUTH_URL` already exists, so it will ignore it.

We recommend nesting your **app** specific `env` files in `apps/your-app`, and creating workspace/root level `env` files for workspace-specific settings (like the [Nx Cloud token](/{{framework}}/using-nx/caching#distributed-computation-caching)).

### Pointing to custom env files

If you want to load variables from `env` files other than the ones listed above:

1. Use the [env-cmd](https://www.npmjs.com/package/env-cmd) package: `env-cmd -f .qa.env nx serve`
2. Use the `envFile` option of the [run-commands](/{{framework}}/workspace/run-commands-executor#envfile) builder and execute your command inside of the builder

## Using Environment Variables in index.html

Nx supports interpolating environment variables into your `index.html` file for React and Web applications.

To interpolate an environment variable named `NX_DOMAIN_NAME` into your `index.html`, surround it with `%` symbols like so:

```html
<html>
  <body>
    <p>The domain name is %NX_DOMAIN_NAME%.</p>
  </body>
</html>
```
