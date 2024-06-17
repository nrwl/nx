# Manual migration of existing code bases

The easiest way to start using Nx is to run the `nx init` command.

```shell
npx nx@latest init
```

If you don't want to run the script, this guide will walk you through doing everything the script does manually.

## Install `nx` as a `devDependency`

We'll start by installing the `nx` package:

{% tabs %}
{% tab label="npm" %}

```shell
npm add -D nx@latest
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn add -D nx@latest
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm add -D nx@latest
```

{% /tab %}
{% /tabs %}

## Create a Basic `nx.json` File

Next, we'll create a blank `nx.json` configuration file for Nx:

```json {% fileName="nx.json" %}
{}
```

## Add `.nx` directories to `.gitignore`

Next, we'll add [the Nx default task cache directory](/features/cache-task-results#where-is-the-cache-stored) and the project graph cache directory to the list of files to be ignored by Git. Update the `.gitignore` file adding the `.nx/cache` and `.nx/workspace-data` entry:

```text {% fileName=".gitignore" %}
...
.nx/cache
.nx/workspace-data
```

## Set Up Caching For a Task

Now, let's set up caching for a script in your `package.json` file. Let's say you have a `build` script that looks like this:

```json {% fileName="package.json" %}
{
  "scripts": {
    "build": "tsc -p tsconfig.json"
  }
}
```

In order for Nx to cache this task, you need to:

- run the script through Nx using `nx exec -- `
- configure caching settings in the `nx` property of `package.json`

The new `package.json` will look like this:

```json {% fileName="package.json" %}
{
  "scripts": {
    "build": "nx exec -- tsc -p tsconfig.json"
  },
  "nx": {
    "targets": {
      "build": {
        "cache": true,
        "inputs": [
          "{projectRoot}/**/*.ts",
          "{projectRoot}/tsconfig.json",
          { "externalDependencies": ["typescript"] }
        ],
        "outputs": ["{projectRoot}/dist"]
      }
    }
  }
}
```

Now, if you run `npm build` or `nx build` twice, the second run will be retrieved from the cache instead of being executed.

## Enable More Features of Nx as Needed

You could stop here if you want, but there are many more features of Nx that might be useful to you. Many [plugins](/plugin-registry) can automate the process of configuring the way Nx runs your tools. Plugins also provide [code generators](/features/generate-code) and [automatic dependency updates](/features/automate-updating-dependencies). You can speed up your CI with [remote caching](/ci/features/remote-cache) and [distributed task execution](/ci/features/distribute-task-execution).
