# Deploying AWS lambda functions in Node.js

Deploying AWS lambda functions in Node.js takes a few steps:

## Creating the project

For new workspaces you can create a Nx workspace with AWS lambda functions with one command:

```shell
npx create-nx-workspace@latest my-functions \
--preset=@nx/aws-lambda \
```

## Configuring existing projects

**Skip this step if you are not configuring an existing project.**

You will need to install `@nx/aws-lambda` if you haven't already.

{% tabs %}
{% tab label="npm" %}

```shell
npm i -D @nx/aws-lambda
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn add -D @nx/aws-lambda
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm add -D @nx/aws-lambda
```

{% /tab %}
{% /tabs %}

- Add AWS lambda configuration by running the following command:

```shell
nx generate @nx/aws-lambda:setup-functions
```

- Create a new aws-lambda project with:

```shell
nx generate @nx/aws-lambda:serverless
```

This will do a few things:

1. Create a new AWS lambda function in directory `src/hello-world`.
2. Add `samconfig.toml` & `template.yaml` in the root of the project.
3. Update your `project.json` to have 2 new targets `serve` & `deploy`.

## Configure your AWS lambda deploy settings

{% callout type="note" title="Prerequiste" %}
You need to configure your AWS credentials inside AWS before attempting to deploy.

{% /callout %}

## Deployment

Before running your deployments you must have these:

- [SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html#install-sam-cli-instructions) installed on your machine
- [Esbuild](https://esbuild.github.io/getting-started/) available in your PATH

```shell
npm install -g esbuild
```

To view your functions locally you run:

```shell
nx serve
```

Your `samconfig.toml` stores default parameters for SAM CLI.

If you want configure your lambda function settings such as the AWS region, runtime, and handler function. You can update your `template.yaml` file located at the root of your project.

To deploy them to AWS you would run:

```shell
nx deploy
```

That's it! Your AWS Lambda function should now be deployed using Nx. You can test it using the endpoint URL provided by Nx, and monitor its execution using the AWS Lambda console or other monitoring tools. Note that you may need to configure additional settings, such as event sources or permissions, depending on your specific use case.
