# Define Environment Variables

Environment variables are global system variables accessible by all the processes running under the Operating System (OS).
Environment variables are useful to store system-wide values such as the directories to search for executable programs
(PATH), OS version, Network Information, and custom variables. These env variables are passed at build time and used at
the runtime of an app.

This guide is divided into two sections:

- [Define Environment Variables](#define-environment-variables)
  - [Setting environment variables](#setting-environment-variables)
    - [Pointing to custom env files](#pointing-to-custom-env-files)
    - [Ad-hoc variables](#ad-hoc-variables)
      [Angular](#using-environment-variables-in-angular-applications)

## Setting environment variables

By default, Nx will load any environment variables you place in the following files:

1. `apps/my-app/.local.env`
2. `apps/my-app/.env.local`
3. `apps/my-app/.env`
4. `.local.env`
5. `.env.local`
6. `.env`

{% callout type="warning" title="Order is important" %}
Nx will move through the above list, ignoring files it can't find, and loading environment variables
into the current process for the ones it can find. If it finds a variable that has already been loaded into the process,
it will ignore it. It does this for two reasons:

1. Developers can't accidentally overwrite important system level variables (like `NODE_ENV`)
2. Allows developers to create `.env.local` or `.local.env` files for their local environment and override any project
   defaults set in `.env`

For example:

1. `apps/my-app/.env.local` contains `NX_API_URL=http://localhost:3333`
2. `apps/my-app/.env` contains `NX_API_URL=https://api.example.com`
3. Nx will first load the variables from `apps/my-app/.env.local` into the process. When it tries to load the variables
   from `apps/my-app/.env`, it will notice that `NX_API_URL` already exists, so it will ignore it.

We recommend nesting your **app** specific `env` files in `apps/your-app`, and creating workspace/root level `env` files
for workspace-specific settings (like the [Nx Cloud token](/concepts/how-caching-works#distributed-computation-caching)).
{% /callout %}

### Pointing to custom env files

If you want to load variables from `env` files other than the ones listed above:

1. Use the [env-cmd](https://www.npmjs.com/package/env-cmd) package: `env-cmd -f .qa.env nx serve`
2. Use the `envFile` option of the [run-commands](/packages/nx/executors/run-commands#envfile) builder and execute your command inside of the builder

### Ad-hoc variables

You can also define environment variables in an ad-hoc manner using support from your OS and shell.

**Unix systems**

In Unix systems, we need to set the environment variables before calling a command.

Let's say that we want to define an API URL for the application to use:

```bash
NX_API_URL=http://localhost:3333 nx build myapp
```

**Windows (cmd.exe)**

```bash
set "NX_API_URL=http://localhost:3333" && nx build myapp
```

**Windows (Powershell)**

```bash
($env:NX_API_URL = "http://localhost:3333") -and (nx build myapp)
```
