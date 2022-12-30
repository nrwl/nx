# Run Root-Level NPM Scripts with Nx

There are often tasks in a codebase that apply to the whole codebase rather than a single project. With version 15.3.0 of Nx, you can run npm scripts directly from the root `package.json`.

{% youtube
src="https://www.youtube.com/embed/PRURABLaS8s"
title="Run root-level NPM scripts with Nx"
width="100%" /%}

## Example

Let's say your root `package.json` looks like this:

```json {% fileName="package.json" %}
{
  "name": "myorg",
  "scripts": {
    "docs": "node ./generateDocsSite.js"
  }
}
```

We want to be able to run the `docs` script using Nx.

## Setup

To make Nx aware of the root `package.json` scripts, add an `"nx": {}` property to the root `package.json`

```json {% fileName="package.json" %}
{
  "name": "myorg",
  "nx": {},
  "scripts": {
    "docs": "node ./generateDocsSite.js"
  }
}
```

## Running a Root-Level Target

Once Nx is aware of your root-level scripts, you can run them the same way you would run any other target. Just use the name of your root `package.json` as the project name, or you can omit the project name and Nx will use the project in the current working directory as the default.

For our example, you would run:

```{% command="nx docs" path="~/myorg" %}
> nx run myorg:docs

yarn run v1.22.19
$ node ./generateDocsSite.js
Documentation site generated in /docs

 ————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target docs for project myorg (5s)
```

## Configuring a Root-Level Target

You can also configure the `inputs` and `outputs` or task pipelines for root-level targets the same way you would for any other target.

Our fully configured example would look like this:

```jsonc {% fileName="package.json" %}
{
  "name": "myorg",
  "nx": {
    // Nx can't infer the project dependency from the docs script,
    // so we manually create a dependency on the store app
    "implicitDependencies": ["store"],
    "targets": {
      "docs": {
        // generates docs from source code of all dependencies
        "inputs": ["^production"],
        // the docs site is created under /docs
        "outputs": ["{workspaceRoot}/docs"]
      }
    }
  },
  "scripts": {
    "docs": "node ./generateDocsSite.js"
  }
}
```

To cache the `docs` target, you can add `docs` to the `cacheableOperations` in `nx.json` and then your output would look like this:

```{% command="nx docs" path="~/myorg" %}
> nx run myorg:docs  [existing outputs match the cache, left as is]

yarn run v1.22.19
$ node ./generateDocsSite.js
Documentation site generated in /docs

 ————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target docs for project myorg (31ms)

   Nx read the output from the cache instead of running the command for 1 out of 1 tasks.
```

Read more about [cacheableOperations](/core-features/cache-task-results) and fine-tuning caching with [task inputs](/more-concepts/customizing-inputs).

## Keep using NPM to run scripts rather than Nx

You can keep using `npm run docs` instead of the new `npx nx docs` version and still leverage the caching. To achieve this you need to wrap your command with `nx exec` s.t. it can be piped through Nx.

```json {% fileName="package.json" %}
{
  "name": "myorg",
  "nx": {},
  "scripts": {
    "docs": "nx exec -- node ./generateDocsSite.js"
  }
}
```

Read more in the [Nx exec docs](/packages/nx/documents/exec).
