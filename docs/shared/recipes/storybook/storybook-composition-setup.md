---
title: Setting up Storybook Composition with Nx
description: This guide explains how you can set up Storybook composition on your Nx workspace.
---

# Setting up Storybook Composition with Nx

## What is Storybook Composition

As explained in the [Storybook official docs](https://storybook.js.org/docs/angular/workflows/storybook-composition), Storybook Composition allows you to embed components from any Storybook inside your local Storybook. If you want to learn more about Storybook Composition, please take a look at the following articles, which explain it in detail:

- [Storybook Composition - Chromatic blog](https://www.chromatic.com/blog/storybook-composition/)
- [Storybook Composition - Storybook docs](https://storybook.js.org/docs/angular/workflows/storybook-composition)

## How it works

In essence, you have a Storybook running, which will be the host of the embeded Storybooks as well. Then, you provide this "host" Storybook with a URL of a live/running Storybook. The composed Storybook is then displayed in a new Canvas iframe as part of the host Storybook, and is listed on the left-hand-side stories inventory, too. You can read more about this in the docs listed above.

## How to use it

All you need is a URL of a live Storybook, and a "host" Storybook. In the `.storybook/main.ts` file of the "host" Storybook, inside `module.exports` you add a new `refs` attribute, which will contain the link(s) for the composed Storybook(s).

In the example below, we have a host Storybook running on local port 4400 (http://localhost:4400) - not displayed here. In it, we want to compose three other Storybooks. The "one-composed" and "two-composed", running on local ports `4401` and `4402` accordingly, as well as the [Storybook Design System's Storybook](https://master--5ccbc373887ca40020446347.chromatic.com/) which is live on the address that you see.

```javascript
// .storybook/main.ts of our Host Storybook - assuming it's running on port 4400
import type { StorybookConfig } from '@storybook/react-vite';
...

const config: StorybookConfig = {
  ...
  refs: {
    'one-composed': {
      title: 'One composed',
      url: 'http://localhost:4401',
    },
    'two-composed': {
      title: 'Two composed',
      url: 'http://localhost:4402',
    },
    'storybook-website-storybook': {
      title: 'The Storybook of the Storybook website',
      url: 'https://master--5ccbc373887ca40020446347.chromatic.com/',
    },
  },
  ...
};

export default config;
```

You can always read more in the [official Storybook docs](https://storybook.js.org/docs/sharing/storybook-composition#compose-published-storybooks).

## How to use it in Nx

It's quite easy to use this feature, in Nx and in general, since you do not need to make any code changes, you just need to have the "composed" Storybook instances (the ones you need to "compose") running, choose a "host" Storybook, and just add the composed Storybooks in it's `.storybook/main.ts` file.

Nx provides the [`run-many`](/reference/core-api/nx/documents/run-many) command, which will allow you to easily run multiple Storybooks at the same time. You need to run the `run-many` command with the parallel flag (eg. `--parallel=3`), because you want to run all your Storybooks in parallel. You can change the value of the `parallel` flag to be of as many Storybooks you want to run in parallel as you need. However, be **very carefull** with putting large numbers in this
flag, since it can cause big delays or get stuck. You can play around and adjust that number to one your machine runs comfortably with. Keep in mind that you can add in this feature however many live/public Storybooks as you need (Storybooks that you do not run locally).

In order to get it working for you, you need to two things:

1. Make sure your "composed" Storybook instances are running. For that you can do:

```shell
nx run-many -t storybook -p one-composed two-composed three-composed --parallel=3
```

2. Start your host Storybook in another tab of your terminal:

```shell
nx storybook main-host
```

Before doing the above steps to actually compose our Storybook instances under the **`main-host`** project, we would need to do the following adjustments to our workspace:

### Adjust the Storybook ports

By default, the `storybook` task for all projects uses the same port. This is problematic when it comes to setting up the Storybook Composition. We need to serve multiple Storybook instances (one per project) in parallel, and all of them are configured to be served in the same port. Storybook automatically assigns a random free port (usually adding `1` to the default port until it finds an empty port). This is not deterministic. There's no guarantee that the same port number will be assigned to the same project. Therefore, we wouldn't be able to create the proper configuration for Storybook Composition since we wouldn't know which URLs our composed Storybooks run on.

To solve this, we must statically set different ports for each project. We can keep the default port (or any set port) for the project serving as the host of our configuration, but we must change the port numbers for the rest of the projects that will be composed. Doing so ensures that each project will always use a known port, and we can correctly configure the Storybook Composition with the correct Storybook URLs.

```json {% fileName="<some-project-root>/project.json" highlightLines=[7] %}
{
  // ...
  "targets": {
    // ...
    "storybook": {
      "options": {
        "port": 4401 // make sure to set a port different than the rest of the projects
      }
    }
  }
}
```

{% callout type="note" title="Inferred tasks vs explicit tasks" %}
Projects using [inferred tasks](/concepts/inferred-tasks) might not have the `storybook` target defined in the `project.json` file, so you need to add the target with only the `port` option set.

If the project has the `storybook` target explicitly defined in the `project.json` file, you need to update or set the `port` option.
{% /callout %}

### Add the `refs` to the host project's `.storybook/main.ts` file

To configure our composition, we need to add a `refs` object to our host project's `main.ts` file. An example of such a configuration looks like this:

```javascript {% fileName="apps/main-host/.storybook/main.ts" highlightLines=["6-19"] %}
import type { StorybookConfig } from '@storybook/react-vite';
// ...

const config: StorybookConfig = {
  // ...
  refs: {
    one-composed: {
      title: 'One composed',
      url: 'http://localhost:4401',
    },
    two-composed: {
      title: 'Two composed',
      url: 'http://localhost:4402',
    },
    three-composed: {
      title: 'Three composed',
      url: 'http://localhost:4403',
    },
  },
  // ...
};

export default config;
```

### Optional: use `run-commands` and create a `storybook-composition` target

If you want to take advantage of the [`run-commands`](/reference/core-api/nx/executors/run-commands) functionality of Nx, you can create a custom target that will invoke the `run-parallel` command for your "composed" Storybook instances.

The objective is to end up with a new target in your `main-host`'s `project.json` file that looks like this:

```jsonc {% fileName="apps/main-host/project.json" highlightLines=["5-15"] %}
{
  // ...
  "targets": {
    // ...
    "storybook-composition": {
      "executor": "nx:run-commands",
      "options": {
        "commands": [
          "nx storybook one-composed",
          "nx storybook two-composed",
          "nx storybook three-composed"
        ],
        "parallel": true
      }
    }
  }
}
```

which you can then invoke like this:

```shell
nx run main-host:storybook-composition
```

which will take care of starting all your "composed" Storybook instances, before you run `nx storybook main-host`.

#### Generating a new `target` in our `main-host`

Let's first generate a new `target` called `storybook-composition` for our `main-host`.

Run the following command:

```shell
nx generate nx:run-commands storybook-composition --command='nx storybook one-composed' --project=main-host
```

This will create a new `target` in your `apps/main-host/project.json`:

```jsonc {% fileName="apps/main-host/project.json" highlightLines=["5-11"] %}
{
  // ...
  "targets": {
    // ...
    "storybook-composition": {
      "executor": "nx:run-commands",
      "outputs": [],
      "options": {
        "command": "nx storybook one-composed"
      }
    }
  }
}
```

Now, change the `command` option to be `commands`, add the `"parallel": true` option, and add all the other "composed" Storybook commands:

```jsonc {% fileName="apps/main-host/project.json" highlightLines=["5-15"] %}
{
  // ...
  "targets": {
    // ...
    "storybook-composition": {
      "executor": "nx:run-commands",
      "options": {
        "commands": [
          "nx storybook one-composed",
          "nx storybook two-composed",
          "nx storybook three-composed"
        ],
        "parallel": true
      }
    }
  }
}
```

Now, you can start all your "composed" Storybook instances by running:

```shell
nx run main-host:storybook-composition
```

**After** all of your "composed" Storybook instances have started, you can run in a new terminal:

```shell
nx storybook main-host
```

This approach takes the "burden" of writing the `run-many` command manually, and makes it easier to add/remove "composed" Storybook instances.
