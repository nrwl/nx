---
title: Everything You Need to Know About TypeScript Project References
slug: typescript-project-references
authors: [Zack DeRose]
tags: [typescript, monorepo, nx]
cover_image: /blog/images/articles/ts-islands.avif
youtubeUrl: https://youtu.be/SDE3cIq28s8
description: Learn how TypeScript Project References create efficient boundaries in your codebase, improving build performance and type checking in large-scale projects.
---

{% callout type="deepdive" title="TypeScript Project References Series" expanded=true %}

This article is part of the TypeScript Project References series:

- **Everything You Need to Know About TypeScript Project References**
- [Managing TypeScript Packages in Monorepos](/blog/managing-ts-packages-in-monorepos)
- [A new Nx Experience For TypeScript Monorepos and Beyond](/blog/new-nx-experience-for-typescript-monorepos)

{% /callout %}

Consider the following workspace:

```plaintext
.
├─ is-even
│ ├─ index.ts
│ └─ tsconfig.json
├─ is-odd
│ ├─ index.ts
│ └─ tsconfig.json
└─ tsconfig.json
```

And here we can see the relevant code:

```ts {% fileName="is-even/index.ts" %}
export function isEven(n: number): boolean {
  return n % 2 === 0;
}
```

```ts {% fileName="is-odd/index.ts" %}
import { isEven } from 'is-even';

export function isOdd(n: number): boolean {
  return !isEven(n);
}
```

If we try to run our build script on the `is-odd` project, we see that TypeScript is unable to run the `tsc` command because at the TypeScript level, `is-odd` is not aware of the `is-even` module:

```{% title="Typescript cannot find the 'is-even' module." path="~/is-odd" command="tsc" lineWrap=80 %}
index.ts:1:24 - error TS2792: Cannot find module 'is-even'. Did you mean to set the 'moduleResolution' option to 'nodenext', or to add aliases to the 'paths' option?

1 import { isEven } from 'is-even';
                         ~~~~~~~~~


Found 1 error in index.ts:1

```

TypeScript needs to be informed as to how to find the module named `is-even`. The error message here actually suggests that we may have forgotten to add aliases to the `paths` option. To do this we can adjust our `tsconfig.json` file at the root of the monorepo:

```json {% fileName="tsconfig.json" %}
{
  "compilerOptions": {
    "paths": {
      "is-even": ["./is-even/index.ts"],
      "is-odd": ["./is-odd/index.ts"]
    }
  }
}
```

By having the individual `tsconfig.json` files `extend` this base config, they will all get these paths, and now our build command will work.

```{% title="Successfully building 'is-odd' package" path="~/is-odd" command="tsc" %}

```

The biggest downsides with this approach is that it does not enforce any boundaries within your monorepo. **At the TypeScript level we treat the entire monorepo as one "unit"**. The TypeScript path aliases we defined, while seeming to create boundaries, are really just a nicer alternative for relative imports.

To solve this, TypeScript introduced [Project References](https://www.typescriptlang.org/docs/handbook/project-references.html). Let's have a look.

## TypeScript Project References

By adding boundaries at the TypeScript level, we can significantly cut down on the "surface area" that TypeScript has to contend with when doing its job. This way, rather than TypeScript seeing our entire monorepo as one unit, it can now understand our workspace as a series of connected "islands" or nodes.

![Islands of TypeScript](/blog/images/articles/ts-islands.png)

To add this to our previous example, we'll adjust the `tsconfig.json` file for `is-odd` since it depends on `is-even` (note that the `references` field is the only difference from the `is-even/tsconfig.json` file):

```json {% fileName="is-odd/tsconfig.json" highlightLines=[10] %}
{
  "extends": "../tsconfig.json",
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
With a few more adjustments to this set up, we can now use the `-b` or `--build` option when building `is-odd`. One of these is turning on [the `composite` compiler option](https://www.typescriptlang.org/tsconfig/#composite) for each project, which we can do by setting the `compilerOption` of `composite` to `true` at the root `tsconfig.json` file - since our other `tsconfig.json` files for the 2 different projects already extend our root file:

```json {% fileName="tsconfig.json" highlightLines=[7] %}
{
  "compilerOptions": {
    "paths": {
      "is-even": ["./is-even/index.ts"],
      "is-odd": ["./is-odd/index.ts"]
    },
    "composite": true
  }
}
```

Let's run our build now with the `--verbose` flag on:

```{% title="Successful build with Typescript's 'Build Mode'" path="~" command="tsc -b is-odd --verbose" lineWrap=80 %}
Projects in this build:
    * is-even/tsconfig.json
    * is-odd/tsconfig.json

Project 'is-even/tsconfig.json' is out of date because buildinfo file 'is-even/tsconfig.tsbuildinfo' indicates that file 'is-odd/index.ts' was root file of compilation but not any more.

Building project '/Users/zackderose/monorepo-project-references/is-even/tsconfig.json'...

Project 'is-odd/tsconfig.json' is out of date because buildinfo file 'is-odd/tsconfig.tsbuildinfo' indicates that program needs to report errors.

Building project '/Users/zackderose/monorepo-project-references/is-odd/tsconfig.json'...
```

Notice our filesystem now:

```plaintext
.
├─ is-even
│  ├─ index.d.ts
│  ├─ index.js
│  ├─ index.ts
│  ├─ tsconfig.json
│  └─ tsconfig.tsbuildinfo
├─ is-odd
│  ├─ index.d.ts
│  ├─ index.js
│  ├─ index.ts
│  ├─ tsconfig.json
│  └─ tsconfig.tsbuildinfo
└─ tsconfig.json
```

Notice how both `is-even` AND `is-odd` now have a compiled `index.d.ts` declaration file and `index.js`. They also both have a `tsconfig.tsbuildinfo` file now (this holds the additional data TypeScript needs to determine which builds are needed). With the `--build` option, TypeScript is now operating as a build orchestrator - by finding all referenced projects, determining if they are out-of-date, and then building them in the correct order.

## Why This Matters

As a practical/pragmatic developer - the TLDR of all of this information is project references allow for more performant builds.

We've put together [a repo to demonstrate the performance gains](https://github.com/nrwl/typecheck-timings), summarized by this graphic:

![results of the perf measurements for TypeScript project references](/blog/images/articles/results-proj-refs-perf.png)

In addition to the time savings we saw reduced memory usage (~< 1GB vs 3 GB). This makes sense given what we saw about how project references work. This is actually a very good thing for CI pipelines, as exceeding memory usage is a common issue we see with our clients for their TypeScript builds. Less memory usage means we can use smaller machines, which saves on the CI costs.

## Can I use Project References in Nx?

Yes. You benefit from the performance gains of TypeScript project references the most in large monorepos. However, this is also when the biggest downsides of project references are felt, namely having to manually manage all the references in various `tsconfig.json` files. This is what we help automate in Nx.

We're going to **dive deeper into the new Nx experience with project references in one of the next articles** of the series, but TL;DR, you can experiment with the setup now by either using the `--preset=ts`:

```shell
npx create-nx-workspace@latest foo --preset=ts
```

Or alternatively by appending the `--workspaces` flag to other presets:

```shell
npx create-nx-workspace@latest reactmono --preset=react --workspaces
```

> Note, Angular doesn't work with TypeScript project references yet but we're looking into various options to make it happen.

## Next up

Stay tuned for our next article in the series about managing TypeScript packages in monorepos.

---

- [Nx Docs](/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools)
- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Bluesky](https://bsky.app/profile/nx.dev)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)
