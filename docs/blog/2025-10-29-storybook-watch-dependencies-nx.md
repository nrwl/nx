---
title: 'Watch and Rebuild Storybook Dependencies with Nx'
slug: 'storybook-watch-dependencies-nx'
authors: ['Juri Strumpflohner']
tags: ['nx']
cover_image: /blog/images/articles/hero-storybook-nx-watching.avif
description: 'Learn how to set up automatic rebuilding of buildable library dependencies in your Storybook setup using Nx workspace watching for a seamless developer experience.'
youtubeUrl: https://youtu.be/URc1aQU0Scs
---

This came up in [our Discord](https://go.nx.dev/community): A Storybook setup in a library that depends on another **buildable package** in the monorepo. The problem? Whenever you run Storybook and change something in the buildable package, you won't see the effect right away. You need to manually rebuild it, and only then will Storybook pick up the changes.

Let me show you how we can fix this with Nx's [workspace watching feature](/docs/guides/tasks--caching/workspace-watching). _(Demo repo included in the links at the very end.)_

{% toc /%}

## The Problem: Buildable Libraries and Storybook

I reproduced the setup. Here's what we're working with:

![Project graph showing Storybook library depending on UI library](/blog/images/articles/graph-storybook-watching.avif)

We have a Storybook library (`feat-create-orders`) that depends on a buildable library (`ui`). The buildable library is configured to point to its pre-built output in the `dist` folder. This means everyone consuming this library in the monorepo will point to the pre-built version rather than the source files.

Here's what the `ui` library's `package.json` looks like:

```json {% fileName="packages/ui/package.json" %}
{
  "name": "@storybooknx/ui",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "@storybooknx/source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

Notice how the main entry points point to `*.js` files. This means we need to keep the `dist` folder up-to-date whenever we make changes to the source files. Otherwise, Storybook won't reflect our changes.

## The Solution: Nx Workspace Watching

Nx actually has a feature that allows you to watch files and automatically run commands when they change. You can find all the details in the [Workspace Watching guide](/docs/guides/tasks--caching/workspace-watching) in the Nx docs.

The key is the `nx watch` command which lets you watch specific projects and run a command whenever a change is detected. Here's the basic syntax:

```shell
npx nx watch --projects=@storybooknx/feat-create-orders --includeDependentProjects -- nx build-deps @storybooknx/feat-create-orders
```

For our Storybook setup, we need to watch all dependencies (`--includeDependentProjects`) of the Storybook package and rebuild them whenever something changes. This way, Storybook's Vite HMR server picks up the changes and refreshes automatically.

## Setting It Up: Step by Step

To make this work, we need to configure two targets in our Storybook library's configuration. You can also [follow along in my example repository](https://github.com/juristr/nxdemo-storybook-watching).

### 1. The `build-deps` Target

This is a simple no-op target that serves as a hook point. The magic happens through its `dependsOn` configuration, which tells Nx to build all dependencies of the current project:

```json {% fileName="packages/feat-create-orders/package.json" highlightLines=[7] %}
{
  "name": "@storybooknx/feat-create-orders",
  "version": "0.0.1",
  "nx": {
    "targets": {
      "build-deps": {
        "dependsOn": ["^build"],
        "executor": "nx:noop"
      }
    }
  }
}
```

The `^build` in `dependsOn` means: "build all my dependencies first." Since this is a noop executor, it won't do anything itself, but Nx will ensure all dependencies are built before this target completes.

### 2. The `watch-deps` Target

This is where the actual watching happens:

```json {% fileName="packages/feat-create-orders/package.json" highlightLines=[10,11,12,13,14,15,16] %}
{
  "name": "@storybooknx/feat-create-orders",
  "version": "0.0.1",
  "nx": {
    "targets": {
      "build-deps": {
        "dependsOn": ["^build"],
        "executor": "nx:noop"
      },
      "watch-deps": {
        "continuous": true,
        "dependsOn": ["build-deps"],
        "executor": "nx:run-commands",
        "options": {
          "command": "nx watch --projects @storybooknx/feat-create-orders --includeDependentProjects -- nx build-deps @storybooknx/feat-create-orders"
        }
      }
    }
  }
}
```

Let's break down what's happening:

- `continuous: true` - Marks this as a [long-running task](/docs/reference/project-configuration#continuous)
- `dependsOn: ["build-deps"]` - Ensures dependencies are built before watching starts
- The command watches the current project and all its dependencies
- When a change is detected, it runs `nx build-deps` which triggers rebuilding

### 3. Update the Storybook Target

Finally, we need to make the Storybook target depend on these new targets:

```json {% fileName="packages/feat-create-orders/package.json" highlightLines=[4,5,6] %}
{
  "nx": {
    "targets": {
      "storybook": {
        "dependsOn": ["^build", "watch-deps"]
      },
      "build-deps": {
        "dependsOn": ["^build"],
        "executor": "nx:noop"
      },
      "watch-deps": {
        "continuous": true,
        "dependsOn": ["build-deps"],
        "executor": "nx:run-commands",
        "options": {
          "command": "nx watch --projects @storybooknx/feat-create-orders --includeDependentProjects -- nx build-deps @storybooknx/feat-create-orders"
        }
      }
    }
  }
}
```

Now when you run `nx storybook feat-create-orders`, Nx will:

1. Build all dependencies (`^build`)
2. Start the watch command in parallel (`watch-deps`)
3. Serve Storybook

{% callout type="tip" title="Copy Configuration from Nx Console" %}
If you're using a Vite or React app with Nx, you likely already have the `watch-deps` target configured automatically. You can easily copy the target configuration from Nx Console! Just open the project panel, navigate to the `watch-deps` target, and click "Copy Target Configuration." Then paste it into your Storybook library's `package.json` and adjust as needed. [Check the video for the details](https://youtu.be/URc1aQU0Scs?si=nTYNEN1eHxv97n4A&t=349)
{% /callout %}

## See It in Action

Let me show you the final developer experience:

{% youtube src="https://youtu.be/URc1aQU0Scs" /%}

When you run:

```shell
nx storybook feat-create-orders
```

You'll see the Nx terminal split into two panels:

- **Top panel**: Storybook dev server
- **Bottom panel**: The watch-deps process monitoring for changes

![Nx TUI showing the storybook run and watch in 2 panels](/blog/images/articles/nx-storybook-watch-nx-tui.avif)

When you make any change in the UI package, you'll see the bottom panel running the `watch-deps` command update, rebuild the package and hence the Storybook Vite HMR server will pick it up and show the live result.

## Watch-deps and Build-deps by Default in Nx v22

`nx watch` is powerful and crucial in a monorepo to maintain good DX by automatically rebuilding buildable packages. Nx already adds this to applications and other buildable packages. While recording the video (you can [actually see it in the video itself](https://youtu.be/URc1aQU0Scs?si=k2pzCtB3OalC5hjf&t=536)), I realized this should be the default experience for Nx + Storybook.

I [submitted a PR](https://github.com/nrwl/nx/pull/33119) right after finishing the video, and **this now ships by default with Nx v22**. The power of open source!

## Conclusion

Setting up automatic rebuilding for your Storybook dependencies transforms the developer experience from frustrating to seamless. No more manual rebuilds, no more stale changes - just edit your code and see it update in Storybook immediately.

The combination of Nx's workspace watching, intelligent caching, and task orchestration makes this setup not only possible but performant. Give it a try and experience the difference!

---

## Learn More

- 📚 [Nx Workspace Watching Docs](/docs/guides/tasks--caching/workspace-watching)
- 🔧 [Storybook with Nx](/docs/technologies/test-tools/storybook/introduction)
- 🎬 [Watch the Video Tutorial](https://youtu.be/URc1aQU0Scs)
- 💻 [Demo Repository](https://github.com/juristr/nxdemo-storybook-watching)

Also, make sure to check out:

- 🐦 [X/Twitter](https://twitter.com/nxdevtools)
- 💼 [LinkedIn](https://www.linkedin.com/company/nrwl/)
- 🦋 [Bluesky](https://bsky.app/profile/nx.dev)
- 👨‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx YouTube Channel](https://www.youtube.com/@nxdevtools)
- ⚡ [Speed up your CI with Nx Cloud](/nx-cloud)
