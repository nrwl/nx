# Adding Nx to your Existing Project

Nx can be added to any type of project, not just monorepos. The main benefit is to get caching abilities for the package scripts. Each project usually has a set of scripts in the `package.json`:

```json {% fileName="package.json" %}
{
  ...
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "jest",
    "lint": "eslint . --ext .ts",
  }
}
```

You can make these scripts faster by leveraging Nx's caching capabilities. For example:

- You change some spec files: in that case the `build` task can be cached and doesn't have to re-run.
- You update your docs, changing a couple of markdown files: then there's no need to re-run builds, tests, linting on your CI. All you might want to do is trigger the Docusaurus build.

## Installing Nx on a Non-Monorepo Project

Run the following command:

```shell
npx nx@latest init
```

This will

- collect all the NPM scripts in the corresponding `package.json` files of your workspace packages
- ask you which of those scripts are cacheable (e.g. build, test, lint)
- ask you which of those scripts might need to be run in a certain order (e.g. if you run the `build` script you might want to first build all the dependent projects)
- ask you for custom output folders that should be captured as part of the caching

This process adds `nx` to your `package.json` at the root of your workspace:

```json {% fileName="package.json" %}
{
  "name": "my-workspace",
  ...
  "devDependencies": {
    ...
    "nx": "15.3.0"
  }
}
```

In addition it generates a `nx.json` based on your answers during the setup process. This includes cacheable operations as well as some initial definition of the task pipeline. Here is an example:

```json {% fileName="nx.json" %}
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "lint"]
      }
    }
  }
}
```

## Wrapping Cacheable Scripts

Nx also automatically wraps your cacheable scripts with the `nx exec` command. The main advantage here is that you can still keep using `npm start` or `npm run build` (or other package manager's alternatives) as you're accustomed to. But still get the benefits of making those operations cacheble.

Here's an example of a `build` and `lint` script being wrapped by Nx:

```json {% fileName="package.json" %}
{
  ...
  "scripts": {
    "build": "nx exec -- vite build",
    "lint": "nx exec -- eslint \"src/**/*.ts*\"",
    ...
    "dev": "vite",
    "start": "vite --open",
  },
  "devDependencies": {
    ...
    "nx": "15.3.0"
  }
}
```

{% callout type="note" title="Use Nx commands directly" %}

Alternatively you could obviously also just switch to using `nx` for invoking the commands. Like `nx build` rather than `npm run build`.

{% /callout %}

## Fine-tuning caching with Nx Inputs

To get the best caching results, you can customize which inputs should be accounted for when it comes to caching certain commands. This can be done in your `nx.json`.

For example, excluding markdown files from the `lint` task cache:

```json {% fileName="nx.json" %}
{
  ...
  "targetDefaults": {
    "lint": {
      "inputs": ["{projectRoot}/**/*.ts","!**/*.md"]
    }
  }
}
```

This includes all TypeScript files, but excludes markdown files. As a result, changing your README won't invalidate your "lint cache".

Learn more about [Nx Inputs](/more-concepts/customizing-inputs).

## Learn More

{% cards %}

{% card title="Customizing Inputs and Named Inputs" description="Learn more about how to fine-tune caching with custom inputs" type="documentation" url="/more-concepts/customizing-inputs" /%}

{% card title="Cache Task Results" description="Learn more about how caching works" type="documentation" url="/core-features/cache-task-results" /%}

{% card title="Adding Nx to NPM/Yarn/PNPM Workspace" description="Learn more about how to add Nx to an existing monorepo" type="documentation" url="/recipes/adopting-nx/adding-to-monorepo" /%}

{% /cards %}
