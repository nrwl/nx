---
title: What Are TypeScript Project References? Setting Up Your TS Monorepo the Right Way
slug: typescript-project-references
authors: [Your Name]
tags: [typescript, monorepo, nx]
cover_image: /blog/images/2025-01-10/ts-project-references.png
---

## Connecting Projects At The Typescript Level

Consider the following workspace:

```filesysten
is-even
  index.ts
  tsconfig.json
is-odd
  index.tx
  tsconfig.json
tsconfig.base.json
```

// stackblitz example

If we try to run our build script on the `is-odd` project, we see that Typescript is unable to run the `tsc` command because at the typescript level, `is-odd` is not aware of the `is-even` module:

```shell
 . > cd is-odd
 is-odd > npm run build

> build
> tsc

index.ts:1:24 - error TS2792: Cannot find module 'is-even'. Did you mean to set the 'moduleResolution' option to 'nodenext', or to add aliases to the 'paths' option?

1 import { isEven } from 'is-even';
                         ~~~~~~~~~


Found 1 error in index.ts:1

```

There are actually 2 issues we're contending with. For this import statement:

```typescript
import { isEven } from 'is-even';
```

The first is that we need to be able to resolve the "is-even" name to it's module. The other issue is we need to mark to Typescript that this

## What Are TypeScript Project References?

You can think of [Project References]() as a way to define explicit relationships between TypeScript projects. Instead of treating your monorepo like one big pile of code, Project References let TypeScript treat each project as a standalone unit with its own boundaries.

Here’s a basic example:

```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true
  },
  "references": [{ "path": "../shared" }]
}
```

In this setup:

1. The `composite` flag enables incremental builds, ensuring that only changed projects are recompiled.
2. The `references` field declares dependencies on other projects, so TypeScript knows the order in which to compile them.

It’s like handing TypeScript a map of your monorepo, which speeds up builds and improves IntelliSense accuracy.

---

## Benefits of TypeScript Project References in Monorepos

Why go through the trouble of setting up Project References? Here are the standout benefits:

### 1. **Faster Builds with Incremental Compilation**

Instead of rebuilding your entire monorepo every time, Project References allow TypeScript to compile only the projects that have changed. This drastically reduces memory usage and build times, especially in CI pipelines.

### 2. **Clear Boundaries Between Projects**

Path aliases (`"@my-org/shared"`) are convenient, but they don't enforce boundaries. With Project References, TypeScript ensures that a project imports only what it’s supposed to, reducing the risk of circular dependencies.

### 3. **Better IntelliSense in Large Workspaces**

Large monorepos can overwhelm editors, leading to sluggish IntelliSense. By breaking your workspace into smaller, well-defined projects, you make it easier for TypeScript to "understand" your code.

---

## How to Set Up TypeScript Project References

Here’s a step-by-step guide to get started:

### 1. **Enable Composite Builds**

In each project’s `tsconfig.json`, set `composite` to `true`:

```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true
  }
}
```

### 2. **Add References**

Add a `references` field pointing to dependent projects:

```json
{
  "references": [{ "path": "../shared" }]
}
```

### 3. **Update Your Build Pipeline**

Use `tsc -b` to build your workspace with project references:

```shell
tsc -b
```

This ensures that TypeScript compiles projects in the correct order based on their dependencies.

---

## Challenges and Caveats

Before you jump in, be aware of a few limitations:

1. **Circular Dependencies**: TypeScript won’t allow circular references between projects. Use this as an opportunity to refactor!
2. **Additional Setup**: You'll need to update your CI/CD pipeline to use `tsc -b`.
3. **Configuration Overhead**: Managing references can be tedious in large repos, though tools like `nx sync` can automate this.

For a full list of caveats, check out [the official documentation](https://www.typescriptlang.org/docs/handbook/project-references.html#caveats-for-project-references).

---

## How Nx Makes It Easier

Setting up and maintaining TypeScript Project References manually can be tricky, especially as your monorepo grows. This is where Nx shines:

1. **Automated Setup**: Nx’s generators automatically configure Project References for you.
2. **Syncing References**: With the `nx sync` command, Nx keeps your references up to date, even as projects are added or moved.
3. **Optimized Builds**: Nx integrates TypeScript incremental builds with its own caching and task distribution, giving you the best of both worlds.

Want to see it in action? Try creating a new Nx workspace with TypeScript Project References:

```shell
npx create-nx-workspace@latest my-workspace --preset=ts
```

---

## Wrapping Up

TypeScript Project References can transform how you manage monorepos, offering faster builds, better IntelliSense, and stronger project boundaries. Whether you’re starting fresh or looking to optimize an existing setup, these features are worth exploring.

And if you’re using Nx, you’ve got the tools to take it to the next level. Check out [Nx’s docs on TypeScript Project References](https://nx.dev/nx-api/js/documents/typescript-project-references) for more!

Have questions or insights to share? Jump into [our Discord community](https://go.nx.dev/community) or hit us up on [Twitter](https://twitter.com/nxdevtools).
