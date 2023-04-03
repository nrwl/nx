# Serverless deployment with Deno Deploy

In this guide, we'll show you how to deploy serverless functions using [Deno Deploy](https://deno.com/deploy).

## Creating the project

You can create a new Deno project with a single command.

```shell
npx create-nx-workspace@latest denoapp --preset=@nrwl/deno
```

Once the command is finished, you can `cd` into the workspace.

```shell
cd denoapp
```

To run the server, use `nx serve` and the server will start on `http://localhost:8000`. You can also run lint and tests with `nx lint` and `nx test` respectively.

For existing projects, see the next section, otherwise you can skip to [deployment](#deno-deploy).

### Configure existing projects

**Skip this step if you are not configuring an existing project.**

For existing workspaces, you will need to install the `@nrwl/deno` package.

{% tabs %}
{% tab label="npm" %}

```shell
npm i -D @nrwl/deno
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn add -D @nrwl/deno
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm add -D @nrwl/deno
```

{% /tab %}
{% /tabs %}

Now, you can generate a Deno project.

```shell
nx g @nrwl/deno:app denoapp
```

You are now ready to deploy the project.

## Deno Deploy

We will use [Deno Deploy](https://deno.com/deploy) to host our serverless functions. First, you'll need to run the generator to set up your project.

```shell
nx g @nrwl/deno:setup-serverless --platform=deno-deploy
```

A new `nx deploy` target will be added to your project, but before you can run it there are a few set up steps.

1. Push your repository to [GitHub](https://github.com/).
2. Go to [Deno dashboard](https://dash.deno.com/) and set up your Deno project. You need to authorize GitHub to allow access to your repositories, then you need to specify the main file (e.g. `src/main.ts`), and the production branch (e.g. `main`).
3. Generate an access token from your [account settings page](https://dash.deno.com/account#access-tokens). Copy the new token somewhere.
4. Add an entry to the project's `.env` file: `DENO_DEPLOY_TOKEN=<token-from-previous-step>` (create this file if needed, and add it to `.gitignore` so you don't commit it)
5. Install the [`deployctl`](https://deno.com/deploy/docs/deployctl) CLI tool.

Once you are done the above steps, you can deploy and view your Deno app!

```shell
nx deploy
```

You can find the production URL from the [Deno dashboard](https://dash.deno.com/) (e.g. `https://acme-denoapp.deno.dev/`). Browsing to the production URL should return the default JSON message: `{ "message": "Hello denoapp" }`.
