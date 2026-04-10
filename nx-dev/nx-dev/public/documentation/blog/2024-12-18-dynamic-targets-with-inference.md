---
title: 'Avoiding Port Conflicts with Multiple Storybook Instances'
slug: dynamic-targets-with-inference-tasks
authors: ['Nicolas Beaussart', 'Juri Strumpflohner']
tags: [nx]
cover_image: /blog/images/articles/heroimg-nx-dynamic-targets.jpg
youtubeUrl: https://www.youtube.com/embed/v0lSEYPjgOs
description: Use Nx's task inference to automatically assign unique ports to Storybook instances, preventing conflicts in your monorepo.
---

{% callout type="info" title="Nx Champion takeover" %}
This post is written by our Nx Champion [Nicolas Beaussart](https://github.com/beaussan). Nicolas is an experienced Staff Engineer at PayFit and believer in open source. He is passionate about improving the DX on large monorepo thought architecture and tooling to empower others to shine brighter. With his experience spanning from DevOps, to backend and frontend, he likes to share his knowledge through teaching at his local university and online. In his free time, when he's not running some experiments, he's probably playing board games, tweaking his home server, or looking over his gemstone collection. You can find him on [X/Twitter](https://x.com/beaussan), [Bluesky](https://bsky.app/profile/beaussan.io), and [GitHub](https://github.com/beaussan).
{% /callout %}

Ever tried juggling multiple Storybook instances in a monorepo, only to face port conflicts? It's like trying to fit several square pegs into the same round hole. But what if I told you there's a way to give each project its own unique port, automatically? Enter Nx's task inference feature – the beacon of hope for our monorepo Storybook aspirations.

Want to skip to the code?

{% github-repository title="Jump to the code" url="https://github.com/juristr/dynamic-storybook-targets" /%}

## The problem

Consider the following setup:

```json {% fileName="packages/buttons/package.json" highlightLines=[8] %}
{
  "name": "@design-system/buttons",
  ...
  "scripts": {
    ...
    "storybook": "storybook dev",
    "build-storybook": "storybook build",
    "test-storybook": "start-server-and-test 'storybook dev --port 3000 --no-open' http://localhost:3000 'test-storybook --index-json --url=http://localhost:3000'"
  },
  ...
}
```

For each package in your monorepo, you have a `test-storybook` script that runs the Storybook test runner for that specific package. Now if you want to run them all in parallel (which you definitely should on CI), you will quickly run into port conflicts:

![](/blog/images/articles/storybook-port-clashes.avif)

To fix it, you can manually assign different ports to each package. But not only is this annoying but it also won't scale.

## The power of createNodes

The createNodes feature in Nx is a game-changer for creating inferences on projects. Today, we're diving into how we can leverage this to create dynamic Storybook targets with unique ports across our entire monorepo.

Why is this important? Well, imagine running multiple dev servers, test environments, and Storybook instances without worrying about port clashes. It's not just convenient – it's a productivity booster!

## Creating a workspace inference plugin

To make this magic happen, we need to create a workspace plugin. Here's how: first, we create a new file for your plugin (eg `tools/storybook.ts`). In this file, we will define the base of our inference:

```ts {% fileName="tools/storybook.ts" %}
import { CreateNodesV2 } from '@nx/devkit';

export const createNodesV2: CreateNodesV2 = [
  '**/.storybook/main.{js,ts,mjs,mts,cjs,cts}',
  async (configFiles, options, context) => {
    return [];
  },
];
```

Here, we can see the `createNodesV2` is an array, the first element being the entry point for our inference. In this case, we're looking for files with the `.storybook/main.{js,ts,mjs,mts,cjs,cts}` pattern as we want to capture all the Storybook configurations in our monorepo.

The second element is a function that will be called with the matching files. `configFiles` is an array of all the files found that matches the glob. This is where we can get creative with our dynamic configuration.

Finally, to be able to use it, you need to update your `nx.json` file to include the plugin:

```json {% fileName="nx.json" %}
{
  "plugins": ["./tools/storybook"]
}
```

To see whether you plugin loaded properly you can go to `.nx/workspace-data/d/daemon.log` and search for your plugin name. Behind the scenes the [Nx Daemon](/concepts/nx-daemon) re-calculates the project graph and loads all plugins, including ours.

{% callout type="info" title="TypeScript configuration" %}
Make sure you have some `tsconfig.json` file in the monorepo root. Nx loads the plugin dynamically (without you having to precompile it) which requires some TypeScript context to be present. [Have a look at the repo setup](https://github.com/juristr/dynamic-storybook-targets/blob/main/tsconfig.base.json).
{% /callout %}

## Dynamic projects creation

Now comes the fun part – dynamically creating project.json configurations. A static configuration of Storybook for your project might look as follows:

```json {% fileName="packages/somelib/project.json" %}
{
  "targets": {
    "storybook": {
      "command": "storybook dev --port 3000",
      ...
    }
  }
}
```

We want to make the `--port 3000` part dynamic, so we can run multiple Storybook instances in parallel.

Here's the gist of what we're doing:

- Loop over the config files
- Create one project per config file found

To do this, we will extract code from the [Nx codebase](https://github.com/nrwl/nx/blob/fb403661802a3500299d6f11ecc888117188b92b/packages/nx/src/project-graph/plugins/utils.ts#L13-L30) to add our dynamic index to our function:

```ts {% fileName="tools/storybook.ts" %}
import {
  AggregateCreateNodesError,
  CreateNodesContextV2,
  CreateNodesResult,
  CreateNodesV2,
} from '@nx/devkit';

const processFile = (
  file: string,
  context: CreateNodesContextV2,
  port: number
) => {
  // TODO
  return {};
};

export const createNodesV2: CreateNodesV2 = [
  '**/.storybook/main.{js,ts,mjs,mts,cjs,cts}',
  async (configFiles, options, context) => {
    // Extracted from <https://github.com/nrwl/nx/blob/master/packages/nx/src/project-graph/plugins/utils.ts#L7>
    const results: Array<[file: string, value: CreateNodesResult]> = [];
    const errors: Array<[file: string, error: Error]> = [];
    await Promise.all(
      // iterate over the config files
      configFiles.map(async (file, index) => {
        try {
          // create a dynamic port for each file
          const value = processFile(file, context, 3000 + index);
          if (value) {
            results.push([file, value] as const);
          }
        } catch (e) {
          errors.push([file, e as Error] as const);
        }
      })
    );
    if (errors.length > 0) {
      throw new AggregateCreateNodesError(errors, results);
    }
    return results;
  },
];
```

If you look closely, you will see that we construct our port based on the `index` of the file. This is where we can generate unique ports for each project.

```ts {% highlightLines=[4] fileName="tools/storybook.ts" %}
configFiles.map(async (file, index) => {
  try {
    // create a dynamic port for each file
    const value = processFile(file, context, 3000 + index);
    ...
  } catch (e) {
    errors.push([file, e as Error] as const);
  }
})
```

We're using the `index` to generate unique ports. Project 1 gets port 3000, project 2 gets 3001, and so on. It's simple, but effective.

Now, we can process our files to actually create targets:

```ts fileName="tools/storybook.ts" %}
import { CreateNodesContextV2 } from '@nx/devkit';
import { dirname } from 'node:path';

const processFile = (
  file: string,
  context: CreateNodesContextV2,
  port: number
) => {
  // We want to get the root of the project, this is how Nx know what project to merge this to
  let projectRoot = '';
  if (file.includes('/.storybook')) {
    projectRoot = dirname(file).replace('/.storybook', '');
  } else {
    projectRoot = dirname(file).replace('.storybook', '');
  }

  return {
    projects: {
      [projectRoot]: {
        // This is how Nx recognizes the project
        root: projectRoot,
        targets: {
          storybook: {
            command: `storybook dev --port ${port}`,
            options: { cwd: projectRoot },
          },
          'test-storybook': {
            // --index-json option is used as a workaround to avoid storybook test runner to check snapshot outside the project root: <https://github.com/storybookjs/test-runner/issues/415#issuecomment-1868117261>
            command: `start-server-and-test 'storybook dev --port ${port} --no-open' <http://localhost>:${port} 'test-storybook --index-json --url=http://localhost:${port}'`,
            options: { cwd: projectRoot },
          },
        },
      },
    },
  };
};
```

## Reaping the benefits

With this setup, we can now:

- Run concurrent Storybook instances without conflicts
- Have consistent ports within each project
- Easily spin up dev servers and test environments on matching ports

And the best part? It just works. Running a graph inspection on your projects will show each one with its unique port, ready for action.

Do you want to see it in action? [Check out the repo](https://github.com/beaussan/nx-storybook-dynamic-ports), and run the following commands:

```shell
npm install
npm run nx run-many -t test-storybook
```

And it will run all the tests in all the projects, with the matching ports, without any conflicts!

## Looking ahead: The infinite task proposal

While our current setup is pretty slick, the future looks even brighter. In our example, we had to rely on `start-server-and-test` [package](https://www.npmjs.com/package/start-server-and-test), but in the future, we will be able to rely on [Nx infinite task proposal](https://github.com/nrwl/nx/discussions/29025) that is in the works that could make our concurrent configuration even smoother. Keep an eye on that – it's going to be a game-changer!

## The create nodes API: A world of possibilities

What we've explored today is just the tip of the iceberg. The create nodes API opens up a world of possibilities for dynamic project configuration in your monorepo. Imagine having no static targets at all, with everything inferred based on your project structure.

While there are official Nx plugins available, don't be afraid to create your own. The power is in your hands to tailor your monorepo setup to your specific needs.

In the end, what we've achieved here is more than just unique ports – it's about creating a flexible, scalable infrastructure for your projects. So go ahead, give it a try, and watch your monorepo workflow transform. 🚀

## Learn More

- [Enforce Organizational Best Practices with a Local Plugin](/extending-nx/tutorials/organization-specific-plugin)
- [Create a Tooling Plugin](/extending-nx/tutorials/tooling-plugin)

Also make sure to check out:

- [Nx Docs](https://www.notion.so/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools)
- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Bluesky](https://bsky.app/profile/nx.dev)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)
