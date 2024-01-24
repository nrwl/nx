# Adding Nx to your Existing Project

Nx can be added to any type of project, not just monorepos. The main benefit is to get caching abilities for the package scripts. Each project usually has a set of scripts in the `package.json`:

```json {% fileName="package.json" %}
{
  ...
  "scripts": {
    "build": "next build",
    "lint": "eslint .",
    "test": "node ./run-tests.js"
  }
}
```

You can make these scripts faster by leveraging Nx's caching capabilities. For example:

- You change some spec files: in that case the `build` task can be cached and doesn't have to re-run.
- You update your docs, changing a couple of markdown files: then there's no need to re-run builds, tests, linting on your CI. All you might want to do is trigger the Docusaurus build.

## Install Nx on a Non-Monorepo Project

Run the following command:

```shell
npx nx@latest init
```

This will

- detect the tools you are using and ask if you want to install plugins for them
- ask you if you want Nx to be used in your package.json scripts
- ask you if you want to enable remote caching

This process generates an `nx.json` based on your answers during the setup process. The example below is using the `@nx/eslint` and `@nx/next` plugins to run ESLint and Next tasks with Nx:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    },
    {
      "plugin": "@nx/next/plugin",
      "options": {
        "buildTargetName": "build",
        "devTargetName": "dev",
        "startTargetName": "start"
      }
    }
  ]
}
```

When Nx updates your `package.json` scripts, it looks for scripts that can be non-intrusively replaced with an Nx command that has caching automatically enabled. The `package.json` defined above would be updated to look like this:

```json {% fileName="package.json" %}
{
  "name": "my-workspace",
  ...
  "scripts": {
    "build": "nx build",
    "lint": "nx lint",
    "test": "node ./run-tests.js"
  },
  ...
  "nx": {
    "includedScripts": []
  }
}
```

The `@nx/next` plugin can run `next build` for you and set up caching correctly, so it replaces `next build` with `nx build`. Similarly, `@nx/eslint` can set up caching for `eslint .`. When you run `npm run build` or `npm run lint` multiple times, you'll see that caching is enabled.

The `test` script was not recognized by any Nx plugin, so it was left as is.

## Inferred Tasks

You may have noticed that `@nx/next` provides `dev` and `start` tasks in addition to the `build` task. Those tasks were created by `@nx/next` plugin from your existing Next configuration. To view all available tasks, open the Project Details view with Nx Console or run `nx show project my-workspace --web` to view the project details in a browser window.

The project detail view lists all available tasks, the configuration values for those tasks and where those configuration values are being set.

## Run More Tasks with Nx

If you want to run one of your existing scripts with Nx, you need to tell Nx about it.

1. Preface the script with `nx exec -- ` to invoke the command with Nx.
2. Add the script name to `includedScripts`.
3. Define caching settings.

The `nx exec` command allows you to keep using `npm test` or `npm run test` (or other package manager's alternatives) as you're accustomed to. But still get the benefits of making those operations cacheable.  Configuring the `test` script from the example above to run with Nx would look something like this:

```json {% fileName="package.json" %}
{
  "name": "my-workspace",
  ...
  "scripts": {
    "build": "nx build",
    "lint": "nx lint",
    "test": "nx exec -- node ./run-tests.js"
  },
  ...
  "nx": {
    "includedScripts": ["test"],
    "targets": {
      "test": {
        "cache": "true",
        "inputs": ["default", "^default"],
        "outputs": []
      }
    }
  }
}
```

Now if you run `npm run test` or `nx test` twice, the results will be retrieved from the cache. The `inputs` used in this example are as cautious as possible, so you can significantly improve the value of the cache by [customizing Nx Inputs](/concepts/task-inputs) for each task.

## Learn More

{% cards %}

{% card title="Customizing Inputs and Named Inputs" description="Learn more about how to fine-tune caching with custom inputs" type="documentation" url="/concepts/task-inputs" /%}

{% card title="Cache Task Results" description="Learn more about how caching works" type="documentation" url="/features/cache-task-results" /%}

{% card title="Adding Nx to NPM/Yarn/PNPM Workspace" description="Learn more about how to add Nx to an existing monorepo" type="documentation" url="/recipes/adopting-nx/adding-to-monorepo" /%}

{% /cards %}

{% short-embeds %}
{% short-video
title="Nx Tips: Nx Init"
embedUrl="https://www.youtube.com/embed/Wpj3KSpN0Xw" /%}
{% short-video
title="How Long Does It Take To Add Nx?"
embedUrl="https://www.youtube.com/embed/fPt_pFP6hn8" /%}
{% short-video
title="Nx is Complicated?"
embedUrl="https://www.youtube.com/embed/AQbSwPtPBiw" /%}
{% /short-embeds %}
