# Serverless deployment with Deno and Netlify

In this guide, we'll show you how to deploy Deno serverless functions using [Netlify](https://netlify.com/).

## Creating the project

You can create a new Deno project with a single command.

```shell
npx create-nx-workspace@latest denoapp --preset=@nx/deno
```

Once the command is finished, you can `cd` into the workspace.

```shell
cd denoapp
```

To serve the functions locally, run `nx serve-functions` and the server will start on `http://localhost:8888`. The Hello function is available on `http://localhost:8888/api/geo`.

For existing projects, see the next section, otherwise you can skip to [deployment](#deploying-to-netlify).

### Configure existing projects

**Skip this step if you are not configuring an existing project.**

For existing workspaces, you will need to install the `@nx/deno` package.

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

Now, you can generate a Deno project.

```shell
nx g @nx/deno:app denoapp
```

You are now ready to deploy the project.

## Deploying to Netlify

First, you'll need to run the generator to set up your project.

```shell
nx g @nx/deno:setup-serverless --platform=netlify
```

This will add a `netlify.toml` file and install the `netlify-cli` package. You can deploy your app with the following command.

```shell
npx netlify deploy
```

You will be prompted to set up the project when deploying for the first time. Once deployed, the production URL will be logged out, and you can see the Hello function by visiting `https://<deploy-id>.netlify.app/api/geo`.
