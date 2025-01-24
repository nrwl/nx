---
title: 'A New Nx Experience for TypeScript Monorepos and Beyond'
slug: new-nx-experience-for-ts
authors: [Juri Strumpflohner]
tags: []
cover_image: /blog/images/articles/new-ts-experience-bg.jpg
youtubeUrl: https://youtu.be/D9D8KNffyBk
---

{% callout type="deepdive" title="TypeScript Project References Series" %}

This article is part of the TypeScript Project References series:

- [Everything You Need to Know About TypeScript Project References](/blog/typescript-project-references)
- [Managing TypeScript Packages in Monorepos](/blog/managing-ts-packages-in-monorepos)
- **A new Nx Experience For TypeScript Monorepos**

{% /callout %}

Today we're excited to release a brand new experience for Nx workspaces. Historically, Nx, and many other monorepo tools, have relied on TypeScript's path aliases to connect your many packages to one another. While this approach can work, it does come with some overhead. Apart from runtimes and bundlers requiring special handling, the main limitation is in large monorepos. We've seen larger organizations struggle with slowness, memory issues and editors not being able to properly resolve symbols.

This is why we're releasing a new NPM/Yarn/PNPM/Bun workspaces-based setup combined with TypeScript project references. The new setup is faster, more efficient in terms of memory use, and fixes common issue with TypeScript editor support for large monorepos.

**For existing Nx users:** Don't worry as we're not going to deprecate the current TypeScript alias based setup. We are going to have a migration guides and potentially tooling to automate some of it. More about that [later in the article](#nx-by-default-creates-a-typescript-path-aliases-based-setup-is-that-deprecated). Also, for now the new workspaces based setup is behind a `--workspaces` flag as we're gathering feedback and polishing it further.

Ready? Let's dive in!

{% toc /%}

## Let's Check Out the New Experience

The workspaces experience is currently available behind the `--workspaces` flag. This allows us to gather your feedback and polish it further before rolling it out as the default.

To try it, you can create a new workspace with:

```shell
npx create-nx-workspace tsmono --preset=react --workspaces
```

> The exception is if you use `--preset=ts` or if you use `nx init` to add Nx to an existing NPM/Yarn/PNPM/Bun workspaces monorepo. In those situations you are already in a NPM/Yarn/PNPM/Bun workspaces environment and you likely know what's going on.

### Create a New Workspaces-based Monorepo

Let's start with a simple workspace setup without any framework or specific tech stack, just TypeScript support. This allows us to highlight how features can be incrementally added over time. Run the following command:

```shell
npx create-nx-workspace tsmono --preset=ts
```

This generates a NPM workspaces setup. The only traces of Nx are:

- a `nx.json` at the root containing configuration about [caching](/features/cache-task-results) and [task pipelines](/concepts/task-pipeline-configuration)
- a `nx` dependency in the root-level `package.json`
- a `@nx/js` dependency in the root-level `package.json`; this is because we created a TypeScript monorepo setup which ships with support for creating and managing TS based packages.

> Note if you want to create a PNPM/Yarn/Bun workspace use the `--pm` flag to specify your preferred package manager.

### Creating a New Package

{% video-player src="/documentation/blog/media/02-tssetup-newteslib.mp4" alt="Using the @nx/js plugin generator to create a new TypeScript package" showDescription=true showControls=true autoPlay=true loop=false /%}

Nx has always shipped with [code generators](/features/generate-code), allowing you to scaffold projects or integrate features into existing ones. These generators are part of [Nx plugins](/concepts/nx-plugins) and have been adapted to work seamlessly in NPM, Yarn, PNPM, or Bun workspaces.

While you could create a package manually, the generator simplifies the process by handling all the tedious setup. It automatically:

1. Configures the `package.json` file, including proper exports.
2. Sets up `tsconfig` files to work well with your editor and TypeScript project references for fast incremental type checking.

Run the following command to generate a new TypeScript package:

```shell
npx nx g @nx/js:lib packages/mytslib
```

During the setup, you can choose whether to include a bundler like `tsc` or leave it out if the package is intended for local use only. You can also configure optional features like linting or testing (with Vitest or Jest).

![](/blog/images/articles/typescript-lib-generation.avif)

The generator configures the `package.json` file just as you would manually, ensuring it includes entries for `type`, `main`, `types`, and `exports`.

![](/blog/images/articles/tslib-packagejson.avif)

**Where are the `package.json` scripts though?** Although you could define `package.json` scripts and Nx would use them, this isn't required. Nx can automatically detect the underlying tool that is being used - in this case TypeScript - and [infers](/concepts/inferred-tasks) a `typecheck` command. You can simply run the following and it would work:

```shell
npx nx typecheck mytslib
```

If you selected additional features like a bundler, linter, or testing framework during generation, Nx would also infer corresponding commands, such as `build`, `lint`, or `test`.

Let's create an application next to use our package.

### Generating a New Vite-based React Application

{% video-player src="/documentation/blog/media/03-tssetup-newviteapp.mp4" alt="Using the @nx/react plugin generator to create a new Vite-based React application" showDescription=true showControls=true autoPlay=true loop=false /%}

While you could use the [Vite CLI](https://vite.dev/) to generate a new Vite app in your monorepo, the Nx React plugin adds some valuable features. It configures TypeScript project references and ensures Vite works seamlessly within a monorepo setup.

To begin, install the Nx React plugin:

```shell
npx nx add @nx/react
```

This command installs and configures the plugin. Once installed, you can use its application generator to scaffold a new React application:

```shell
npx nx g @nx/react:app apps/myviteapp
```

### Importing Packages in our React Application

To use the `mytslib` package in the newly generated React application, simply import it as follows:

```ts {% fileName="apps/myviteapp/src/app/app.tsx" highlightLines=[3,6] %}
import NxWelcome from './nx-welcome';

import { mytslib } from '@tsmono/mytslib';

export function App() {
  console.log(mytslib());
  return (
    <div>
      <NxWelcome title="@tsmono/myviteapp" />
    </div>
  );
}

export default App;
```

Thanks to the [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html) created by Nx during project generation, your editor will fully support features like autocomplete and navigation. For instance, the root-level `tsconfig.json` references both the `myviteapp` and `mytslib` projects which allows the editor to correctly find all the available projects in your monorepo.

```json {% fileName="tsconfig.json" %}
{
  "extends": "./tsconfig.base.json",
  "compileOnSave": false,
  "files": [],
  "references": [
    {
      "path": "./packages/mytslib"
    },
    {
      "path": "./apps/myviteapp"
    }
  ]
}
```

{% callout type="deepdive" title="Referencing Dependencies in package.json" %}

In an NPM-based monorepo, even though you reference `mytslib` from `myviteapp`, you don't have to add a dependency in `myviteapp/package.json`. You only need that if `mytslib` isn't buildable (i.e., you depend on the precompiled `.js` files).

However, if you're using PNPM, you must explicitly declare the dependency either in the consumer (`myviteapp`) or in the root-level `package.json`.

```json {% fileName="apps/myviteapp/package.json" %}
{
  "name": "@tsmono/myviteapp",
  "version": "0.0.1",
  "private": true,
  "dependencies": {
    "@tsmono/mytslib": "workspace:*"
  }
}
```

> Note that the `workspace:` prefix is part of the "Workspaces Protocol" that [PNPM](https://pnpm.io/workspaces), [Yarn v2+](https://yarnpkg.com/features/workspaces) and [Bun](https://bun.sh/docs/install/workspaces) support.

{% /callout %}

### Automatically Synching TypeScript Project References

{% video-player src="/documentation/blog/media/04-tssetup-sync-tsrefs.mp4" alt="Nx automatically prompts to sync TypeScript project references if they are out of sync" showDescription=true showControls=true autoPlay=true loop=false /%}

TypeScript project references offer significant benefits for large-scale monorepos, particularly in terms of compilation speed and memory usage. However, their maintenance can become a challenge as your monorepo evolves. Every project's `tsconfig.json` needs to stay updated with the correct references to its dependencies, effectively requiring you to manually manage the TypeScript project graph.

To address this, Nx introduces the `nx sync` command, which automatically keeps your TypeScript project references in sync. Whenever you run commands like `build`, `serve`, or `dev`, Nx verifies whether the project references are accurate. If they are out of sync, it prompts you to update them.

![](/blog/images/articles/tsproj-refs-sync.avif)

For example, after importing `mytslib` into `myviteapp`, you'll notice that `apps/myviteapp/tsconfig.json` now includes a reference to `mytslib`, ensuring your project remains correctly configured:

![](/blog/images/articles/tsproj-refs-updated-tsconfig.avif)

### Watching Dependencies

{% video-player src="/documentation/blog/media/08-tssetup-watching.mp4" alt="Automatically watching buildable libraries and rebuilding them." showControls=true autoPlay=true loop=false showDescription=true /%}

In our current setup, the `mytslib` package is not “buildable”. Notice it directly exports the TypeScript files. This means when `myviteapp` imports `mytslib`, it directly imports the TypeScript files and handles the transpilation. As a result, if we serve the application in dev mode, any changes to `mytslib` will automatically update the application because it depends on the source files directly.

However, in some cases, you may have buildable libraries. These are useful for caching, CI optimizations, or releasing packages outside the monorepo. When a buildable library changes, it must be recompiled to reflect the updates. To streamline this process, Nx introduces a `watch-deps` target, which automatically watches and rebuilds the dependencies of your applications.

To simulate this, let's create a buildable library:

```shell
npx nx g @nx/js:lib packages/buildablelib --bundler=tsc
```

Next, import it in our existing `mytslib`:

{% tabs %}

{% tab label="packages/mytslib/.../mytslib.ts" %}

```ts {% fileName="packages/mytslib/src/lib/mytslib.ts" %}
import { buildablelib } from '@tsmono/buildablelib';

export function mytslib(): string {
  return buildablelib() + ' - mytslib';
}
```

{% /tab %}

{% tab label="packages/mytslib/package.json" %}

```json {% fileName="packages/mytslib/package.json" %}
{
  "name": "@tsmono/mytslib",
  ...
  "dependencies": {
    "@tsmono/buildablelib": "*"
  }
}
```

{% /tab %}

{% /tabs %}

Now, open two terminal windows. In the first run the `watch-deps` command:

```shell
npx nx watch-deps myviteapp
```

In the second, serve the Vite application:

```shell
npx nx serve myviteapp
```

The `watch-deps` target takes care of automatically watching all dependencies of `myviteapp` and rebuilding them automatically when anything changes.

## Key Highlight - Locality and Minimalism

Nx plugins have been essential for helping enterprises organize and scale monorepos, but their reliance on Nx-generated workspace structures made migrating existing setups difficult. To address this, we introduced [inferred tasks](/concepts/inferred-tasks), which allows plugins to read directly from underlying tool configurations, like `vite.config.ts`, enabling seamless integration with existing projects.

We further improved how plugins work by applying the locality principle. Originally, plugins made many assumptions about the workspace structure and relied heavily on global configuration files. We updated them to operate locally within the project whenever possible, minimizing changes to global configurations.

In addition, we are now focusing on creating a minimal setup that you can expand incrementally as needed. The idea is to keep the initial setup for new projects as simple as possible, closely mirroring what you would manually configure yourself. The generated code follows best practices:

- Configuring `package.json` files correctly with exports
- Setting up `tsconfig` files to work optimally in editors
- Creating TypeScript project references and keeping them in sync

Nx is also much more versatile. It can directly run your `package.json` scripts or infer targets based on the tools you're using.

You still also have the option to create Nx's `project.json` files ([see docs](/reference/project-configuration)) for declaring more complex configurations. However, you only use them if needed.

The key idea here is that **tooling shouldn't get in your way but should elevate your experience**.

## Key Highlight - Performance

{% youtube
src="https://youtu.be/_6tpsu8zOik"
title="Making TypeScript type checking distributable"
width="100%" /%}

We have already highlighted some raw metrics from benchmarking TypeScript project references compared to running type checking globally for the entire monorepo. [Check out our 1st article of the series](/blog/typescript-project-references#why-this-matters) for more details.

The core difference to understand here is that, traditionally, you might have a single task that combines building and type checking, or at least two separate ones (like for Vite applications): one for building and one for type checking. For large TypeScript monorepos, this approach can become problematic because type checking occurs at the application level for all projects in the repository. This means a single TypeScript program is responsible for the entire process.

{% video-player src="/documentation/blog/media/animation-tsrefs-splitting.mp4" alt="Moving from a single build + typecheck to fine-grained distributable typechecks" showDescription=true autoPlay=true loop=true /%}

This has two major implications:

- It cannot be parallelized and distributed on CI, which makes it slow.
- It is memory-intensive, requiring large CI machines (resulting in higher costs).

By leveraging the new Nx and TypeScript project references setup, we now have fine-grained, individual type checking tasks at the project level. This allows for much better distribution as these tasks can be spread across different [Nx Agents](/ci/features/distribute-task-execution).

![Running type checking on different agents on CI](/blog/images/articles/cipe-typecheck-distribution.avif)

As such, the new approach:

- Is **distributable across multiple machines**, resulting in faster CI runs.
- Each individual type check **requires less memory**, allowing the use of smaller machines.
- Each **individual type check can be [cached](/features/cache-task-results)**, significantly speeding up follow-up runs.

We **ran some benchmarks** comparing [the current Nx setup](https://github.com/jaysoo/ts-bench-old) and [the new TypeScript project references-based setup](https://github.com/jaysoo/ts-bench-new):

- Current: [~11m 54s](https://github.com/jaysoo/ts-bench-old/actions/runs/12956714862)
- New TypeScript project references setup: [~8m 8s](https://github.com/jaysoo/ts-bench-new/actions/runs/12956715557)

And this is the **worst-case scenario**, relying solely on the distribution of type checking tasks across different machines. Subsequent runs might hit the cache and become even faster.

It is important to emphasize that the main reason we can fully leverage these benefits from TypeScript project references is that we avoid the maintenance burden of setting them up manually, thanks to the automated [Nx sync](#automatically-syncing-typescript-project-references) command.

## FAQ

Here are some common questions and corresponding answers.

### Nx by default creates a TypeScript Path Aliases based Setup. Is that Deprecated?

No, it's not deprecated. When Nx was first introduced, workspaces-based setups weren't yet an option. TypeScript path aliases were the go-to solution for creating modular monorepos, offering a simple yet effective way to structure projects. Nx plugins handled the complexities behind the scenes, enabling incremental compilation by rewriting paths on the fly.

Going forward, the recommended approach is to use NPM, Yarn, PNPM, or Bun workspaces combined with TypeScript project references. This setup integrates more seamlessly with modern tooling and can potentially lead to a more performant setup.

In fact, Nx has supported running tasks and caching `package.json` scripts in workspace setups for years. The main limitation was the compatibility of Nx plugins, which has now been addressed. Plugins work equally well in both scenarios: the workspaces setup and the TypeScript path alias setup.

### Will There be a Migration Path from the Current Nx Setup?

Yes, it's already possible to use Nx in a mixed setup that combines NPM, Yarn, or PNPM workspaces with TypeScript path aliases. However, doing so requires careful attention and an understanding of how package resolution works.

As we continue refining the new workspaces experience, we're also preparing detailed content and guidance to support an incremental migration, making the transition as smooth as possible.

### What Are the Implications for a Single Version Policy?

We've consistently advocated for a single version policy in Nx monorepos and continue to believe it's the better approach in the long run.

The TypeScript path alias-based setup inherently enforces a single version policy, making it harder to opt out. In contrast, the workspaces-based monorepo configuration provides more flexibility. That said, you can still adopt a single version strategy with workspaces, and we may introduce tooling in the future to help enforce it.

### What About Angular? Does the New Setup Work with Angular?

Currently, Angular and its underlying compiler don't support TypeScript project references. However, you can still use Nx and Angular within an NPM, Yarn, or PNPM workspaces-based setup. This can be especially useful when [migrating multiple Angular applications](/recipes/adopting-nx/import-project) into a single Nx monorepo.

For now, we continue to use the TypeScript path alias-based setup for pure Angular monorepos, as it offers a better developer experience in the current context. That said, we're actively working on improving this. Large Angular applications stand to benefit significantly from the performance and memory optimizations enabled by TypeScript project references.

## Learn More

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/nrwl_io)
