# Deploying a Node.js server to Fly.io

In this guide, we'll show you how to go from zero to production using Nx and Node.js server support. We'll use [Fastify](https://www.fastify.io/) as the frameworks of choice, but you can also use [Express](https://expressjs.com/) and [Koa](https://koajs.com/) by selecting those frameworks during project creation. We'll also cover how to configure the same setup for existing Node.js projects.

**Prefer a video version? Watch this short video to learn how to start a Node.js server project with Nx.**

{% youtube
src="https://www.youtube.com/embed/K4f-fMuAoRY"
title="Build Node backends - The Easy Way!"
width="100%" /%}

## Creating the project

You can create a new server project with a single command.

```bash
npx create-nx-workspace@latest my-api \
  --preset=node-standalone \ # create a Node.js project
  --framework=fastify \      # other options are express and koa
  --docker                   # generates a Dockerfile (we'll need this)
```

Once the command is finished, you can `cd` into the workspace.

```bash
cd my-api
```

To run the server, use `nx serve` and the server should start on `http://localhost:3333`. You can also run the e2e tests against the running server by running `nx e2e e2e` in a separate tab. Note that the `e2e` project is separate from the server project, thus the need to specify it in the `nx e2e <project>` command.

For existing projects, see the next section, otherwise you can skip to [deployment](#deploying-the-server-to-fly.io).

### Configure existing projects

**Skip this step if you are not configuring an exist project.**

If you have an existing Node.js server project, you can add the same deployment capabilities as we've just covered. Firstly, if the project is not an Nx project you can initialize it as such by running the `npx nx init` command in your project. Next, we can add the `build` and `docker-build` targets by invoking a couple of generators.

You will need to install `@nrwl/node` and `@nrwl/esbuild` if you haven't already.

{% tabs %}
{% tab label="npm" %}

```bash
npm i -D @nrwl/node @nrwl/esbuild
```

{% /tab %}
{% tab label="yarn" %}

```bash
yarn add -D @nrwl/node @nrwl/esbuild
```

{% /tab %}
{% tab label="pnpm" %}

```bash
pnpm add -D @nrwl/node @nrwl/esbuild
```

{% /tab %}
{% /tabs %}

Now, set up the build and Docker targets with these commands. You will be prompted to select the project to configure.

```bash
# Add build target
# You can skip this step if your project already has a build target.
nx g @nrwl/esbuild:esbuild-project --skipValidation

# Add Dockerfile
nx g @nrwl/node:setup-docker
```

You are now ready to deploy the project.

## Deploying the server to Fly.io

Recall that a `Dockerfile` has been created for our project. If you missed the Docker setup, you can always run the `nx g @nrwl/node:setup-docker` command to generate the `Dockerfile`.

Now, all we need to do is set up Fly.io and deploy! If you haven't used Fly.io before, you need to install the CLI and create an account. It'll only take a couple of minutes.

1. [Install flyctl](https://fly.io/docs/hands-on/install-flyctl/) - This is the Fly.io CLI.
2. Create an account with `fly auth signup` or `fly auth login`.

If you run into any issues, please refer to their [getting started guide](https://fly.io/docs/speedrun/).

Once you have authenticated using `fly`, we are ready to launch our project.

```bash
fly launch --generate-name --no-deploy
```

Follow the prompts and a `fly.toml` file will be generated, which contains the Fly.io configuration. We need to update this file with the correct port used by our image.

```
[[services]]
http_checks = []
internal_port = 3000 # Make sure this matches the port in Dockerfile
```

Now we can build and deploy the server.

```bash
nx build
fly deploy
```

Fly.io will log out the monitoring link when the server is successfully deployed. You can open the server in a browser using the `fly open` command.

That's is! Our server is now deployed for the world to use.

{% callout type="note" title="Adding deploy command" %}
You can add a `deploy` target to the project by add this to the `project.json` file (under `"targets"`).

```json
"deploy": {
  "dependsOn": [
    "build"
  ],
  "command": "fly deploy"
}
```

Then you can run `nx deploy`, which will run the build (if necessary) before deploying.

{% /callout %}
