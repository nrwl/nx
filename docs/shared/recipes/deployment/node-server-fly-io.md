# Deploying a Node App to Fly.io

This recipe guides you through deploying your Nx based Node backend application to [Fly.io](https://fly.io/).

If you don't have an Nx powered Node project already, you can create a new one

```bash
npx create-nx-workspace@latest my-api \
  --preset=node-standalone \
  --framework=fastify \
  --docker
```

This example uses [Fastify](https://www.fastify.dev/) but you can equally use [Express](https://expressjs.com/), [Koa](https://koajs.com/) or [NestJS](https://nestjs.com/) by selecting those frameworks during project creation.

You can also install the `@nx/node` package into an existing Nx monorepo and generate a new Node application.

{% cards cols="1" %}
{% card title="Build Node backends - The Easy Way!" description="Starting with Nx 15.7 we now have first-class support for building Node backend applications" type="video" url="https://youtu.be/K4f-fMuAoRY" /%}
{% card title="Easy, Modular Node Applications!" description="In this video, we're going to explore how to modularize a Node backend application" type="video" url="https://youtu.be/LHLW0b4fr2w" /%}
{% /cards %}

## Setup Docker

If you don't have a Docker setup already, you can leverage the `setup-docker` generator from the `@nx/node` package to create one:

```shell
npx nx g @nx/node:setup-docker
```

## Deploying the Server to Fly.io

Now, all we need to do is set up Fly.io and deploy! If you haven't used Fly.io before, you need to install the CLI and create an account. It'll only take a couple of minutes.

1. [Install flyctl](https://fly.io/docs/hands-on/install-flyctl/) - This is the Fly.io CLI.
2. Create an account with `fly auth signup` or `fly auth login`.

If you run into any issues, please refer to their [getting started guide](https://fly.io/docs/speedrun/).

Once you have authenticated using `fly`, we are ready to launch our project.

```bash
fly launch --generate-name --no-deploy
```

{% callout type="warning" title="Dockerignore" %}

The setup process of Fly asks about creating a `.dockerignore` file based on the current `.gitignore`. If you confirm that step, make sure to remove `**/dist` from the `.dockerignore` file, otherwise the build will fail because the `Dockerfile` copies the build output from the `dist/` folder.

{% /callout %}

Once the setup completes, update the `fly.toml` file and make sure it uses the correct port:

```toml {% fileName="fly.toml" %}
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

## Optional: Adding a Deploy Target

You can also automate the deployment by adding a target to your project. In addition, that allows us to leverage the Nx [task pipeline](/concepts/task-pipeline-configuration) to make sure we first run the `build` and then the `deploy`.

By using [Nx run-commands](/recipes/executors/run-commands-executor), you can add a `deploy` target to the project. Go to the project's `project.json` file (under `"targets"`) and add the following:

```json {% fileName="project.json" %}
"deploy": {
  "dependsOn": [
    "build"
  ],
  "command": "fly deploy"
}
```

Then you can run `nx deploy`, which will run the build (if necessary) before deploying. If the build ran before, **it would be cached**.
