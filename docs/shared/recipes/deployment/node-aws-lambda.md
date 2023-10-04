# Deploying AWS Lambda Functions in Node.js

This recipe guides you through setting up AWS Lambda functions with Nx.

## Getting set up

Depending on your current situation, you can either

- create a new project with the goal of primarily developing and publishing AWS Lambda functions
- add AWS Lambda functions to an existing Node.js project in an Nx workspace

### Starting a New Project

To create a new project, run

```shell
npx create-nx-workspace@latest my-functions --preset=@nx/aws-lambda
```

### Configure Existing Projects

First, make sure you have `@nx/aws-lambda` installed.

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

Next, use the corresponding Nx generator to add the AWS Lambda configuration to an existing project:

```shell
nx generate @nx/aws-lambda:setup-functions
```

This will setup your project to use AWS Lambda functions:

1. Creates a new AWS lambda function in directory `functions/hello-world`.
2. Adds `samconfig.toml` and `template.yaml` in the root of the project.
3. Updates your `project.json` to have 2 new targets `serve-functions` & `deploy-functions`.

## Serve and Develop Your Functions Locally

The `project.json` should have a new target `serve-functions`:

```json {% fileName="project.json" %}
{
  "name": "my-functions",
  ...
  "targets": {
    ...
    "serve-functions": {
      "command": "sam build && sam local start-api"
    },
    ...
  }
}
```

This allows to just run `nx serve-functions` to start a local server that serves your functions. As you can see it leverages the [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-command-reference.html) underneath.

## Configure Your AWS Lambda Deploy Settings

{% callout type="note" title="Prerequiste" %}
You need to configure your AWS credentials inside AWS before attempting to deploy.

{% /callout %}

## Deployment

The following requirements need to be met in order to run the AWS Lambda function deployment:

- [SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html#install-sam-cli-instructions) installed on your machine
- [esbuild](https://esbuild.github.io/getting-started/) available in your PATH (SAM need this). Example: `npm install -g esbuild`.

Your `samconfig.toml` stores default parameters for the SAM CLI. On the other hand, if you want to configure your lambda function settings such as the AWS region, runtime, and handler function, update your `template.yaml`.

The Nx `project.json` already contains a `deploy-functions` target we can invoke to trigger the deployment:

```json {% fileName="project.json" %}
{
  "name": "my-functions",
  ...
  "targets": {
    ...
    "deploy-functions": {
      "command": "sam build && sam deploy --guided"
    }
  }
}
```

Just run:

```shell
nx deploy-functions
```

That's it! For monitoring or further permission settings, please refer to the AWS Lambda console.
