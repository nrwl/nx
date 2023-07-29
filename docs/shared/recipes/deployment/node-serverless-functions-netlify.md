# Add and Deploy Netlify Edge Functions with Node

Deploying Node.js serverless functions to Netlify involves a few steps.

## Getting set up

Depending on your current situation, you can either

- create a brand new project with the intention of solely hosting and deploying Netlify functions
- adding Netlify functions to an existing project

Let's walk through both scenarios.

### Starting a New Project

For new workspaces you can create a Nx workspace with serverless function with one command:

```shell
npx create-nx-workspace@latest my-functions --preset=@nx/netlify --site=my-site
```

### Configure Existing Projects

You will need to install `@nx/netlify` if you haven't already.

{% tabs %}
{% tab label="npm" %}

```shell
npm i -D @nx/netlify
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn add -D @nx/netlify
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm add -D @nx/netlify
```

{% /tab %}
{% /tabs %}

Next add the Netlify serverless configuration by running the following command:

```shell
nx g @nx/netlify:setup-functions
```

This will do a few things:

1. Create a new serverless function in `src/functions`.
2. Add the `netlify.toml` in the root of the project
3. Update your `project.json` to have 2 new targets `serve-functions` & `deploy-functions`.

## Serve Your Functions Locally

To serve your functions locally, run:

```shell
nx serve-functions
```

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
      "dependsOn": ["lint"],
      "command": "npx netlify deploy --site=YOUR_SITE_ID",
      "configurations": {
        "production": {
          "command": "npx netlify deploy --site=YOUR_SITE_ID --prod"
        }
      }
    }
  }
}
```

## Deployment

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
