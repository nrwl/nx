# Add and Deploy Netlify Edge Functions with Deno

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

## Adding a Netlify Serverless Function

To add serverless support to the Deno project, run the `setup-serverless` generator. Pass `--netlify` to the `platform` argument to set it up for Netlify deployment.

```shell
nx g @nx/deno:setup-serverless --platform=netlify
```

This will add a `netlify.toml` file and install the `netlify-cli` package. In addition it also creates a `functions` directory:

```
└─ denoapp
   ├─ ...
   ├─ functions
   │  └─ hello-geo.ts
   ├─ src
   │  ├─ ...
   ├─ ...
   ├─ netlify.toml
   ├─ nx.json
   ├─ project.json
   └─ package.json
```

The generator updates the `project.json` of your Deno project and adds a new `serve-functions` target that delegates the local serving of the function to the Netlify CLI:

```json {% fileName="project.json" %}
{
  "targets": {
    ...
    "serve-functions": {
      "command": "npx netlify dev"
    }
  }
}
```

Just run `nx serve-functions` to start the local server.

## Configure Your Netlify Deploy Settings

Make sure you have a site configured on Netlify (skip if you have already). You have mostly two options:

- either go to [app.netlify.com](https://app.netlify.com) and create a new site
- use the Netlify CLI and run `npx netlify deploy` which will walk you through the process

If you run `npx netlify deploy` in the workspace, the site ID will be automatically saved in the `.netlify/state.json` file. Alternatively adjust the `deploy-functions` in your `project.json` to include the `--site` flag:

```json {% fileName="project.json" %}
{
  "targets": {
    ...
    "deploy-functions": {
      "executor": "nx:run-commands",
      "options": {
        "command": "npx netlify deploy"
      },
      "configurations": {
        "production": {
          "command": "npx netlify deploy --prod"
        }
      }
    },
  }
}
```

## Deploying to Netlify

To deploy them to Netlify, run:

```shell
nx deploy-functions
```

This creates a "draft deployment" to a temporary URL. If you want to do a production deployment, pass the `--prod` flag:

```shell
nx deploy-functions --prod
```

This invokes the "production" configuration of the `deploy-functions` target and passes the `--prod` flag to the Netlify CLI.

{% callout type="info" title="Configure your CI for automated deployments" %}

Note that for a more stable and automated setup you might want to configure your CI to automatically deploy your functions.

{% /callout %}
