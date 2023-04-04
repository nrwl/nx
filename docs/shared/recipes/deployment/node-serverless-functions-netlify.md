# Deploying Node.js serverless functions to Netlify

Deploying Node.js serverless functions to Netlify involes a few steps:

## Creating the project

For new workspaces you can create a Nx workspace with serverless function with one command:

```shell
npx create-nx-workspace@latest my-functions \
--preset=@nrwl/netlify \
--site=my-site \ # Site ID or name to deploy the functions
```

## Configuring existing projects

**Skip this step if you are not configuring an existing project.**

You will need to install `@nrwl/netlify` if you haven't already.

{% tabs %}
{% tab label="npm" %}

```shell
npm i -D @nrwl/netlify
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn add -D @nrwl/netlify
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm add -D @nrwl/netlify
```

{% /tab %}
{% /tabs %}

- Add serverless configuration by running the following command:

```shell
nx generate @nrwl/netlify:setup-serverless
```

- Create a new netlify serverless project with:

```shell
nx generate @nrwl/netlfiy:serverless
```

This will do a few things:

1. Create a new serverless function in `src/functions`.
2. Add the `netlify.toml` in the root of the project
3. Update your `project.json` to have 2 new targets `dev` & `deploy`.

## Configure your Netlify deploy settings

If you **do not** have a _site_ setup within your workspace, go inside the Netlify dashboard, and create/use an existing site where your serverless functions will be deployed.

In your `project.json` you can update your deploy site by going to the `deploy` target adding `--site=my-site-name-or-id` replace **my-site-name-or-id** to what you have in your Netlify dashboard.

It should look similar to:

```json
    "deploy": {
      "dependsOn": ["lint"],
      "command": "npx netlify deploy --prod-if-unlocked --site=my-site"
    }
```

## Deployment

To view your functions locally you run:

```shell
nx serve
```

Inside your `netlify.toml` your functions _path_ should be already configured.
To deploy them to Netlify you would run:

```shell
nx deploy
```

The netlify CLI will output the link where you functions can be accessed. You can either click that link or open your browser and navigate to it!
