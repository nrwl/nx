# Serverless Deployment with Deno Deploy

In this guide, we'll show you how to deploy serverless functions using [Deno Deploy](https://deno.com/deploy).

## Prerequisite: A Deno Project

{% callout type="warning" title="Have Deno already installed?" %}
Make sure you have Deno installed on your machine. Consult the [Deno docs for more details](https://deno.com/manual/getting_started/installation)
{% /callout %}

If you don't have a Nx Deno project yet, you can easily create a new one with the following command:

```shell
npx create-nx-workspace@latest denoapp --preset=@nx/deno
```

This creates a single Deno application.

You can also add a new Deno application to an existing Nx monorepo workspace. Make sure you have the `@nx/deno` package installed:

{% tabs %}
{% tab label="npm" %}

```shell
npm i -D @nx/deno
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn add -D @nx/deno
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm add -D @nx/deno
```

{% /tab %}
{% /tabs %}

Then generate a new Deno app with the following command:

```shell
nx g @nx/deno:app denoapp
```

## Configuring Deno Deploy

First configure your Deno Deploy project:

1. Push your repository to [GitHub](https://github.com/).
2. Go to [Deno dashboard](https://dash.deno.com/) and set up your Deno project. You need to authorize GitHub to allow access to your repositories, then you need to specify the main file (e.g. `src/main.ts`), and the production branch (e.g. `main`).
3. Generate an access token from your [account settings page](https://dash.deno.com/account#access-tokens). Copy the new token somewhere.
4. Add an entry to the project's `.env` file: `DENO_DEPLOY_TOKEN=<token-from-previous-step>` (create this file if needed, and add it to `.gitignore` so you don't commit it)
5. Install the [`deployctl`](https://deno.com/deploy/docs/deployctl) CLI tool.

`deployctl` is a CLI that allows us to deploy our Deno project. We can embed that into our Nx project by creating a `run-command`. The `@nx/deno` plugin already comes with a `setup-deploy` generator that helps with that. Just run:

```shell
nx g @nx/deno:setup-deploy --platform=deno-deploy
```

This adds a new target to your `project.json`

```json {% fileName="project.json"}
{
  "name": "denoapp",
  ...
  "targets": {
    ...
    "deploy": {
      "executor": "nx:run-commands",
      "options": {
        "command": "deployctl deploy --project=<Your-Deno-Deploy-Project-Name> --import-map=import_map.json --exclude=node_modules  src/main.ts --dry-run"
      },
      "configurations": {
        "preview": {
          "command": "deployctl deploy --project=<Your-Deno-Deploy-Project-Name> --import-map=import_map.json --exclude=node_modules src/main.ts"
        },
        "production": {
          "command": "deployctl deploy --project=<Your-Deno-Deploy-Project-Name> --import-map=import_map.json --exclude=node_modules --prod src/main.ts"
        }
      }
    }
  }
}

```

## Deploy

Once you are done the above steps, you can deploy and view your Deno app using the following command:

```shell
nx deploy
```

You can find the production URL from the [Deno dashboard](https://dash.deno.com/) (e.g. `https://acme-denoapp.deno.dev/`). Browsing to the production URL should return the default JSON message: `{ "message": "Hello denoapp" }`.
