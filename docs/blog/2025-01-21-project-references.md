---
title: What Are TypeScript Project References?
slug: typescript-project-references
authors: [Zack DeRose]
tags: [typescript, monorepo, nx]
cover_image: /blog/images/2025-01-21/ts-islands.png
---

## Connecting Projects At The TypeScript Level

Consider the following workspace:

```filesystem
is-even
  index.ts
  tsconfig.json
is-odd
  index.ts
  tsconfig.json
tsconfig.base.json
```

If we try to run our build script on the `is-odd` project, we see that TypeScript is unable to run the `tsc` command because at the TypeScript level, `is-odd` is not aware of the `is-even` module:

```shell
 . > cd is-odd
 is-odd > tsc

index.ts:1:24 - error TS2792: Cannot find module 'is-even'. Did you mean to set the 'moduleResolution' option to 'nodenext', or to add aliases to the 'paths' option?

1 import { isEven } from 'is-even';
                         ~~~~~~~~~


Found 1 error in index.ts:1

```

As we can see, there's an error associated with this line:

```typescript
import { isEven } from 'is-even';
```

TypeScript needs to be informed as to how to find the module named `is-even`. The error message here actually suggests that we may have forgotten to add aliases to the 'paths' option. To do this we can adjust our `tsconfig.json` file at the root of the monorepo:

```json
{
  "compilerOptions": {
    "paths": {
      "is-even": ["./is-even/index.ts"],
      "is-odd": ["./is-odd/index.ts"]
    }
  }
}
```

By having the individual `tsconfig.json` files `extend` this base config, they will all get these paths, and now our build command will work:

```shell
is-odd > tsc
```

This solution that we just implemented is how Nx has set up tsconfigs in the past. Before the new "Project References" feature that this article will look at next, this was the best option available for allowing you to import from another named project inside of your monorepo.

Before we look at project references though - one of the important things we should do is understand the downsides of this "paths"-based approach.

The biggest one being that this approach does not enforce any boundaries within your monorepo at the TypeScript level - instead, we treat the entire monorepo as one "unit," but by adding `paths`, we are adding aliases to specific files (usually the `index.ts` barrel files for each project in our monorepo) so we can reference them in our import statements.

## TypeScript Project References

By adding boundaries at the TypeScript level, we can significantly cut down on the "surface area" that TypeScript has to contend with when doing its job. This way, rather than TypeScript seeing our entire monorepo as one unit, it can now understand our workspace as a series of connected "islands" or nodes.

![Islands of TypeScript](/blog/images/2025-01-21/ts-islands.png)

To add this to our previous example, we'll adjust the `tsconfig.json` file for `is-odd` since it depends on `is-even`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  },
  "references": [{ "path": "../is-even" }]
}
```

Note that we still actually need path aliases for our example. This is because we still need a mechanism to resolve the location in the import statement:

```ts
import { isEven } from 'is-even';
```

There are alternatives to path aliases to allow for this name to be resolved. The most recent enhancements in Nx use the `workspaces` functionality of your package manager of choice (npm/pnpm/yarn/bun) as the way of resolving these names.

With this set up, we can now use the `-b` or `--build` option when building `is-odd` - let's run it now with the `--verbose` flag on:

```shell
  % tsc -b is-odd --verbose
Projects in this build:
    * is-even/tsconfig.json
    * is-odd/tsconfig.json

Project 'is-even/tsconfig.json' is out of date because buildinfo file 'is-even/tsconfig.tsbuildinfo' indicates that file 'is-odd/index.ts' was root file of compilation but not any more.

Building project '/Users/zackderose/monorepo-project-references/is-even/tsconfig.json'...

Project 'is-odd/tsconfig.json' is out of date because buildinfo file 'is-odd/tsconfig.tsbuildinfo' indicates that program needs to report errors.

Building project '/Users/zackderose/monorepo-project-references/is-odd/tsconfig.json'...
```

Notice our filesystem now:

```filesystem
is-even
  index.d.ts
  index.js
  index.ts
  tsconfig.json
  tsconfig.tsbuildinfo
is-odd
  index.d.ts
  index.js
  index.tx
  tsconfig.json
  tsconfig.tsbuildinfo
tsconfig.base.json
```

Notice how both `is-even` AND `is-odd` now have a compiled `index.d.ts` declaration file and `index.js`. They also both have a `tsconfig.base.json` file now (this holds the additional data TypeScript needs to determine which builds are needed). With the `--build` option, TypeScript is now operating as a build orchestrator - by finding all referenced projects, determining if they are out-of-date, and then building them in the correct order.

## So What Does This Mean For You

As a practical/pragmatic developer - the TLDR of all of this information is project references allow for more performant builds.

We've put together [a repo to demonstrate the perfomance gains](https://github.com/jaysoo/typecheck-timings), summarized by this graphic:

![results](/blog/images/2025-01-21/results.png)

In addition to the time savings we saw reduced memory usage (~< 1GB vs 3 GB). This makes sense given what we saw about how project references work. This is actually a very good thing for CI pipelines, as exceeding memory usuage is a common issue we see with our clients for their TypeScript builds. Less memory usuage means we can use smaller machines, which saves on the CI costs.

In general, while it's good to understand the mechanics around everything, we believe it's better to use tools for this (like Nx!). This way you can off-shore your mental capacity to the tool and instead focus on building your solution.

To setup a similar workspace as our example we started with, we can use:

```shell
npx create-nx-workspace@latest foo --preset=ts
cd foo
nx g lib packages/is-even
nx g lib packages/is-odd
```

After making the adjustments to the contents of the `is-even` and `is-odd`, we can now simply build `is-even` and Nx will automatically prompt us to "sync" our workspace (updating our project references since `is-odd` now depends on `is-even`):

```shell
% nx build is-odd

 NX   The workspace is out of sync

[@nx/js:typescript-sync]: Some TypeScript configuration files are missing project references to the projects they depend on or contain outdated project references.

This will result in an error in CI.

? Would you like to sync the identified changes to get your workspace up to date? …
Yes, sync the changes and run the tasks
No, run the tasks without syncing the changes

You can skip this prompt by setting the `sync.applyChanges` option to `true` in your `nx.json`.
For more information, refer to the docs: https://nx.dev/concepts/sync-generators.
```

So, offload the mental load to your tools, focus on building your solution, and you should have the best of all worlds.
