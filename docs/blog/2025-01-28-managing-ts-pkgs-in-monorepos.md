---
title: 'Managing TypeScript Packages in Monorepos'
slug: managing-ts-packages-in-monorepos
authors: [Juri Strumpflohner]
tags: [typescript, monorepo, nx]
cover_image: /blog/images/articles/bg-managing-typescript-packages.jpg
description: Compare strategies for managing TypeScript packages in monorepos, from relative imports to project references, and find the best approach for your project.
---

{% callout type="deepdive" title="TypeScript Project References Series" expanded=true %}

This article is part of the TypeScript Project References series:

- [Everything You Need to Know About TypeScript Project References](/blog/typescript-project-references)
- **Managing TypeScript Packages in Monorepos**
- [A new Nx Experience For TypeScript Monorepos and Beyond](/blog/new-nx-experience-for-typescript-monorepos)

{% /callout %}

Managing TypeScript packages in a monorepo presents unique challenges. As your monorepo grows, so does the complexity of structuring and resolving dependencies between packages. From using simple relative imports to taking advantage of TypeScript path aliases, project references, and your package manager's workspaces feature, developers have a variety of strategies at their disposal. But which approach is the best fit for you?

{% toc /%}

## What Does it Mean to Manage and Share TypeScript Code in a Monorepo?

When you work in a monorepo, the goal is to split logic into separate packages. Why? To create smaller, self-contained, and maintainable units. This approach not only enhances reusability but also helps scale: whether that's scaling teams or optimizing CI pipelines.

As you split logic into packages, you'll inevitably need to somehow connect them together. At the **code level**, this is typically expressed through an import statement on the consumer side—whether that's an application using a package or one package depending on another.

```ts
import { something } from '@tsmono/mypackage';
```

To have this work we need to be able to resolve the `@tsmono/mypackage` import to the actual file path. This needs to happen during:

- **Build:** This includes type checking and compilation/transpilation.
- **Runtime:** This is when the application runs in the browser/on the server.

In this article we'll mostly **focus on the building part, in particular type checking**. In real world applications you'll most often have some sort of bundler in the pipeline where `tsc` is used for type checking and the actual compilation part is being taken care of by the bundler (e.g. esbuild, Rspack, or Vite).

There are several approaches to connect TypeScript packages in a monorepo, each with its own trade-offs. Let's explore them in detail.

## Using Relative Imports

Example: [Stackblitz](https://stackblitz.com/github/juristr/ts-monorepo-linking/tree/relative-imports) - [Github](https://github.com/juristr/ts-monorepo-linking/tree/relative-imports)

The simplest approach to connecting packages is using relative imports. Here's an example of the setup:

```
└─ .
   ├─ apps
   │  └─ myapp
   │     ├─ src
   │     │  └─ index.ts
   │     └─ tsconfig.json
   ├─ packages
   │  └─ lib-a
   │     ├─ src
   │     │  └─ index.ts
   │     └─ tsconfig.json
   └─ tsconfig.base.json

```

Here's the content of the main TypeScript configuration files:

{% tabs %}
{% tab label="tsconfig.base.json" %}

Starting at the root, the `tsconfig.base.json` looks as follows. It is meant to set some of the base compilation properties which can then be adjusted further by individual projects in your workspace.

```json {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "strict": true,
    "moduleResolution": "NodeNext",
    "baseUrl": ".",
    "rootDir": "."
  }
}
```

{% /tab %}
{% tab label="apps/myapp/tsconfig.json" %}

The application extends from the `tsconfig.base.json` and adds some minor adjustments which are relatively uninteresting for our setup:

```json {% fileName="apps/myapp/tsconfig.json" %}
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../dist",
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

{% /tab %}
{% tab label="packages/lib-a/tsconfig.json" %}

Similarly this is the config for our `lib-a` package. The library package has its own TypeScript configuration:

```json {% fileName="packages/lib-a/tsconfig.json" %}
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../dist",
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

{% /tab %}
{% /tabs %}

With this setup, the main application can consume the library **using a relative import**:

```ts {% fileName="apps/myapp/src/index.ts" %}
import { greet } from '../../../packages/lib-a/src/index';

console.log(greet('World'));
```

We can have some scripts in our main `package.json` at the workspace root to run our TypeScript code directly, compile it to JavaScript and for performing type checking.

```json {% fileName="package.json" %}
{
  "name": "ts-monorepo-linking",
  "private": true,
  "devDependencies": {
    "typescript": "^5.3.3",
    "tsx": "^4.1.0"
  },
  "scripts": {
    "dev": "tsx apps/myapp/src/index.ts",
    "build": "tsc -p apps/myapp/tsconfig.json",
    "typecheck": "tsc -p apps/myapp/tsconfig.json --noEmit"
  }
}
```

### Observations: Relative Imports

**Dependency resolution:**  
Relative imports are the simplest way to link packages, but they are fragile. Restructuring your codebase will require updating import paths, which can become unmanageable in larger workspaces.

**Modularity:**  
This setup enables modularization at the organizational level. Apps and libraries are placed in separate folders, making the workspace easier to navigate. However, from TypeScript's perspective, the entire workspace is treated as a single, unified project. This means there are no strict boundaries between packages at the type-checking level.

**Performance:**  
Treating the entire workspace as a single TypeScript project generally works for small setups but can become problematic as the workspace grows. Type checking and compilation span the entire repo, which may lead to higher memory usage, slower builds, and sluggish editor responsiveness in larger workspaces.

## Fixing Relative Imports with TypeScript Path Aliases

Example: [Stackblitz](https://stackblitz.com/github/juristr/ts-monorepo-linking/tree/ts-path-aliases) - [Github](https://github.com/juristr/ts-monorepo-linking/tree/ts-path-aliases)

Relative imports are functional but difficult to maintain in larger workspaces. A simple improvement is to use **TypeScript path aliases**. These allow you to create custom paths for imports, making the codebase easier to navigate and refactor.

In the `tsconfig.base.json` you can define a path alias for the `lib-a` package:

```json {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    ...
    "paths": {
      "@ts-monorepo-linking/lib-a": ["packages/lib-a/src/index.ts"]
    }
  }
}
```

> Note you can use whatever name you want for the alias. Choosing `@ts-monorepo-linking/lib-a` makes it look like an actual import of an external package, thus closer to a structure we want to achieve.

With this setup, you can simplify the import in your application:

```ts {% fileName="apps/myapp/src/index.ts" %}
import { greet } from '@ts-monorepo-linking/lib-a';

console.log(greet('World'));
```

### Observations: TypeScript Path Aliases

**Dependency resolution:**  
Path aliases eliminate the need for relative imports, resulting in a cleaner and more maintainable structure. If the underlying paths change, you only need to update the alias in `tsconfig.base.json`.

> As a side note: While this article focuses on the build and type-checking phase, it's worth noting that running the transpiled TypeScript code directly wouldn't work out of the box. This is because TypeScript path aliases are purely a compile-time construct—they don't exist in the output JavaScript. To run the application, you'd need a runtime plugin or bundler (like Webpack, esbuild, or Vite) that can resolve these aliases to actual file paths.

**Modularity:**  
This approach doesn't change the modularity from the relative imports setup. TypeScript still treats the entire workspace as one large project, without enforcing strict boundaries between packages.

**Performance:**  
Path aliases don't improve performance compared to relative imports. The entire workspace is still treated as a single TypeScript project, so type checking and compilation remain unchanged. This approach focuses on maintainability and readability rather than optimizing performance.

## Improving Performance with Project References

Example: [Stackblitz](https://stackblitz.com/github/juristr/ts-monorepo-linking/tree/ts-proj-references-simple) - [Github](https://github.com/juristr/ts-monorepo-linking/tree/ts-proj-references-simple)

TypeScript project references let you break a large TypeScript project into smaller, manageable units. This approach aligns with monorepo structures, allowing each package to act as its own TypeScript program while maintaining relationships between them.

To use project references:

- Add the `references` property in `tsconfig.json` files to point to dependent projects.
- Enable `composite: true` in `compilerOptions` (this also enables `incremental` and `declaration` by default).
- Use `tsc --build` (`tsc -b`) for compilation and type checking.

> For a more deep-dive on TypeScript project references, make sure to check out our article on ["Everything You Need to Know About TypeScript Project References"](/blog/typescript-project-references).

Our workspace structure still remains the same with the exception of adding another root-level `tsconfig.json`:

```
ts-monorepo-linking
   ├─ apps
   │  └─ myapp
   │     ├─ src
   │     │  └─ index.ts
   │     └─ tsconfig.json
   ├─ packages
   │  └─ lib-a
   │     ├─ src
   │     │  └─ index.ts
   │     └─ tsconfig.json
   ├─ tsconfig.base.json
   └─ tsconfig.json
```

This new `tsconfig.json` is the entry point for TypeScript project references, pointing to all individual TypeScript configs of the projects that are part of the monorepo workspace.

```json {% fileName="tsconfig.json" %}
{
  "files": [],
  "references": [{ "path": "./packages/lib-a" }, { "path": "./apps/myapp" }]
}
```

This is distinct from `tsconfig.base.json`, which is used to share common configurations across the workspace:

```diff {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "strict": true,
    "moduleResolution": "NodeNext",
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@ts-monorepo-linking/lib-a": ["packages/lib-a/src/index.ts"]
    }
  }
}
```

Note that in the `tsconfig.base.json` we removed the `rootDir` from our TypeScript configuration (compared to the pure TypeScript path aliases setup). The reason is that we no longer treat the entire workspace as a single TypeScript project. Instead, each project's `tsconfig.json` forms its own TypeScript root and will be processed by TypeScript's project references individually.

The `myapp` and `lib-a` configurations look as follows:

{% tabs %}

{% tab label="apps/myapp/tsconfig.json" %}

```json {% fileName="apps/myapp/tsconfig.json" %}
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../dist/apps/myapp",
    "rootDir": "src",
    "tsBuildInfoFile": "../../dist/apps/myapp/tsconfig.tsbuildinfo"
  },
  "references": [{ "path": "../../packages/lib-a" }],
  "include": ["src/**/*"]
}
```

{% /tab %}

{% tab label="lib-a TSConfig" %}

```json {% fileName="packages/lib-a/tsconfig.json" %}
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../dist/packages/lib-a",
    "rootDir": "src",
    "tsBuildInfoFile": "../../dist/packages/lib-a/tsconfig.tsbuildinfo"
  },
  "include": ["src/**/*"]
}
```

{% /tab %}
{% /tabs %}

Changing the configuration alone isn't enough. If you continue using `tsc` (or `tsc -p`), TypeScript will ignore your project references and treat the workspace as a single large project. To fully leverage project references, you must switch to using the `--build` (`-b`) flag with `tsc`. This mode enables TypeScript to process each project individually, respecting dependencies defined in the references property.

```json {% fileName="package.json" %}
{
  "name": "ts-monorepo-linking",
  ...
  "scripts": {
    "dev": "tsx --tsconfig tsconfig.base.json apps/myapp/src/index.ts",
    "build": "tsc --build",
    "clean": "tsc --build --clean",
    "typecheck": "tsc --build --emitDeclarationOnly"
  }
}
```

> Note: `--noEmit` is not compatible with the `--build` flag. Use `--emitDeclarationOnly`.

### Observations: Project References

**Dependency resolution:**  
Imports remain the same, relying on TypeScript path aliases to resolve dependencies. Project references don't change how TypeScript resolves paths; they focus on modularizing type checking and compilation.

**Modularity:**  
Project references create stronger boundaries by treating each package as an independent TypeScript program. This enforces better isolation and ensures dependencies are type-checked at the package level.

**Performance:**  
This approach introduces incremental builds, where only modified packages are recompiled. TypeScript generates `.tsbuildinfo` files to track changes, reducing memory usage and speeding up type checking and compilation. This is particularly beneficial for large workspaces or CI pipelines.

From a TypeScript program structure we now don't have a single TypeScript program, but multiple ones.

```
ts-monorepo-linking
   ├─ apps
   │  └─ myapp
   │     ├─ src
   │     └─ tsconfig.json  <<< myapp TS program
   ├─ packages
   │  └─ lib-a
   │     ├─ src
   │     └─ tsconfig.json  <<< lib-a TS program
   ├─ tsconfig.base.json
   └─ tsconfig.json        <<< root-level solution tsconfig
```

The incremental nature of project references allows TypeScript to track changes and skip unnecessary recompilation, resulting in:

- **Faster builds:** Only projects affected by changes are recompiled, saving time during development and on CI.
- **Lower memory usage:** Processing smaller, isolated projects is more memory efficient, which is particularly helpful in large workspaces or resource-constrained environments like CI pipelines.
- **Improved editor performance:** TypeScript's incremental setup ensures quicker type-checking and autocomplete, even in large monorepos.

## Combining TypeScript Project References and Package Manager Workspaces

Example: [Stackblitz](https://stackblitz.com/github/juristr/ts-monorepo-linking/tree/workspaces-ts-proj-refs) - [Github](https://github.com/juristr/ts-monorepo-linking/tree/workspaces-ts-proj-refs)

Modern package managers like NPM, PNPM, Yarn, and Bun have a so-called "workspaces feature" that allows for a more seamless resolution of local packages that allows for a more seamless resolution of local packages.

{% tabs %}

{% tab label="NPM/Yarn/Bun Workspaces" %}

For most package managers, you can use the `workspaces` property in the root `package.json` to define the packages that are part of the monorepo.

```json {% fileName="package.json" %}
{
  "name": "ts-monorepo-linking",
  ...
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}

```

{% /tab %}

{% tab label="PNPM Workspaces" %}

PNPM uses a `pnpm-workspace.yaml` file to define the packages that are part of the monorepo.

```yaml {% fileName="pnpm-workspace.yaml" %}
packages:
  - 'apps/*'
  - 'packages/*'
```

{% /tab %}
{% /tabs %}

This approach **eliminates the need for TypeScript path aliases for module resolution**.

```diff {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "strict": true,
    "moduleResolution": "NodeNext",
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
  }
}
```

Instead, the package manager's workspaces feature makes sure to link the packages properly such that they can be resolved correctly at build and runtime. This doesn't have any impact on our TypeScript project references setup which cares about type checking and resolves dependencies via the `references` property.

> Note, setting up package resolution with workspaces is the generally recommended approach. More on that later.

In an NPM/Yarn/PNPM workspace packages tend to be more self-contained. As such it is common to have the output directly in a `dist` folder within the package itself. We also adjust the `baseUrl` to be at the package root.

{% tabs %}

{% tab label="apps/myapp/tsconfig.json" %}

```json {% fileName="apps/myapp/tsconfig.json" highlightLines=[4,6,7] %}
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "tsBuildInfoFile": "dist/tsconfig.tsbuildinfo"
  },
  "references": [{ "path": "../../packages/lib-a" }],
  "include": ["src/**/*"]
}
```

{% /tab %}

{% tab label="packages/lib-a/tsconfig.json" %}

```json {% fileName="packages/lib-a/tsconfig.json" highlightLines=[4,6,7] %}
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "dist/tsconfig.tsbuildinfo"
  },
  "include": ["src/**/*"]
}
```

{% /tab %}
{% /tabs %}

Each package requires to have a `package.json` that defines the contract for its entry points, types, and dependencies on other packages.

Here's our updated `package.json` for `lib-a`:

```json {% fileName="packages/lib-a/package.json" %}
{
  "name": "@ts-monorepo-linking/lib-a",
  ...
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./package.json": "./package.json"
  },
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "module": "./src/index.ts"
}
```

Note how it directly exports the `index.ts` file, eliminating the need for pre-compilation. This approach works regardless of whether you use TypeScript project references, as long as the consuming application handles compilation or transpilation. The package manager's workspaces feature makes sure that the packages are properly linked so they can be resolved at runtime (by Node or respective bundler).

### Do I need to reference dependent packages in the consuming package's `package.json`?

For NPM workspaces you don't necessarily have to reference dependent packages in the consuming package's `package.json`. Like in our example, `myapp` has a dependency on `lib-a`, so **we could list it in the `dependencies` section, but we don't have to**:

```json {% fileName="apps/myapp/package.json" %}
{
  "name": "@ts-monorepo-linking/myapp",
  ...
  "dependencies": {
    "@ts-monorepo-linking/lib-a": "*" // optional for NPM workspaces
  }
}
```

> The `*` version specifier tells the package manager to resolve the dependency locally if available.

There's an exception to this:

- **publishable packages**: Clearly, if you want to [publish a package](/features/manage-releases), it needs to have all its dependencies listed properly in the `package.json`.
- **PNPM workspaces**: Due to how PNPM links packages, you need to reference the dependent packages in the consuming package's `package.json`. To avoid having to manually maintain such dependency in every consumer `package.json` you could resort to declaring such dependencies in the root `package.json` instead.

Also note that [PNPM](https://pnpm.io/workspaces), [Yarn v2+](https://yarnpkg.com/features/workspaces) and [Bun](https://bun.sh/docs/install/workspaces) support a dedicated "Workspaces Protocol" allowing you to prefix local dependencies with `workspace:`. This makes it more evident that the dependency is resolved locally. For example:

```json {% fileName="apps/myapp/package.json" %}
{
  "name": "@ts-monorepo-linking/myapp",
  ...
  "dependencies": {
    "@ts-monorepo-linking/lib-a": "workspace:*"
  }
}
```

### Observations: Workspaces and Project References

**Dependency resolution:**  
With workspaces we delegate the package resolution to the package manager, making it independent of TypeScript. Unlike the previous solution with TypeScript path aliases, this approach works seamlessly at runtime since the package resolution is handled natively by Node.js or the package manager. This makes the setup more robust and platform-aligned.

**Modularity:**  
Each package's `package.json` defines its public API and dependencies, making the structure explicit and easy to understand. One important detail is that in our example the `package.json` directly exports TypeScript files, making the consumer responsible for transpilation and bundling. As a result, these libraries are primarily intended for local use within the monorepo workspace.

**Performance:**  
Compared to previous solutions, performance remains largely the same in this setup. The TypeScript project references still handle incremental type checking and compilation, which guarantees performance improvements. Package resolution is handled by the package manager's workspaces feature and Node itself, so it doesn't impact TypeScript's performance.

## Using TypeScript Project References, Workspaces and Pre-building Packages

Example: [Stackblitz](https://stackblitz.com/github/juristr/ts-monorepo-linking/tree/workspaces-ts-proj-refs-precompiled) - [Github](https://github.com/juristr/ts-monorepo-linking/tree/workspaces-ts-proj-refs-precompiled)

In the previous setup, the `lib-a` package directly exported TypeScript files through its `package.json`:

```json {% fileName="packages/lib-a/package.json" %}
{
  "name": "@ts-monorepo-linking/lib-a",
  ...
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./package.json": "./package.json"
  },
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

This configuration works well for local monorepo use cases but delegates the responsibility of bundling to the consumer. To avoid that, you can pre-compile the package. You'll need to:

- Adjust our `lib-a`'s `package.json` to point to the compiled artifacts in `dist`.
- Setting up a pre-compilation step.
- Ensure all projects are compiled in the correct order based on their dependencies.

In our simple setup, the TypeScript project references already establish a dependency graph. Running `tsc --build` from the root of the workspace ensures that projects are compiled in the correct order based on their dependencies.

> In a more complex setup you might need to rely on additional tooling such as Nx that has [a task pipelines functionality](/concepts/task-pipeline-configuration) built-in.

The resulting structure of the `dist` folder looks like this: (notice the `*.js` and `*.d.ts` files)

```
ts-monorepo-linking
   ├─ apps
   │  └─ myapp
   │     ├─ ...
   │     ├─ package.json
   │     └─ tsconfig.json
   ├─ package.json
   ├─ packages
   │  └─ lib-a
   │     ├─ dist
   │     │  ├─ index.d.ts
   │     │  ├─ index.d.ts.map
   │     │  ├─ index.js
   │     │  ├─ index.js.map
   │     │  └─ tsconfig.tsbuildinfo
   │     ├─ package.json
   │     ├─ src
   │     │  └─ index.ts
   │     └─ tsconfig.json
   ├─ tsconfig.base.json
   └─ tsconfig.json
```

To make the compiled `lib-a` usable for other packages, we need to update its `package.json` to point to the compiled artifacts in `dist`. Here's the updated version:

```json {% fileName="packages/lib-a/package.json" %}
{
  "name": "@ts-monorepo-linking/lib-a",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "module": "./dist/index.js"
}
```

### Observations: Pre-building Packages

**Dependency resolution:**  
Precompiling dependent packages allows the application bundler to rely on prebuilt outputs, avoiding the need to compile package dependencies during application bundling. A [task pipeline](/concepts/task-pipeline-configuration) ensures that packages are compiled beforehand, streamlining the workflow.

**Modularity:**  
Compared to the previous approach of directly referencing TypeScript source files, this setup slightly increases modularity. Each package is now self-contained, with its compiled outputs and defined entry points in the `package.json`. By precompiling and packaging the library, it can be distributed outside the monorepo if needed, which enhances its modularity and reusability. However, the primary focus remains internal use within the monorepo.

**Performance:**  
This setup can slightly improve type-checking performance, especially within code editors. Since the type information is already generated as `.d.ts` files during precompilation, the editor can directly rely on these instead of processing TypeScript source files through project references. While cached project references can achieve similar speeds, precompiled declaration files might potentially reduce some overhead.

## Which One Should I Choose?

Here are some thoughts on which approach to use.

**TypeScript Path Aliases: A Simple Option**

TypeScript path aliases have been a reliable way to manage package resolution, particularly before package managers introduced the workspaces feature. They're straightforward to set up, requiring only a global `tsconfig.json` without additional. However, there are limitations to consider as they require additional bundling support/alias resolvers at runtime and might come with some performance degradation in large workspaces.

{% callout type="deepdive" title="Isn't Nx using TS Path Aliases?" %}
Yes and no. Nx has been around since before package managers introduced workspaces. As a result, the default setup in Nx traditionally leveraged a root-level `tsconfig.base.json` containing path aliases to link packages within the monorepo.

That said, Nx can also be used in combination with NPM/Yarn/PNPM/Bun workspaces, as [shown here](/recipes/adopting-nx/adding-to-monorepo). This led to two distinct setups for monorepos with Nx: one using TypeScript path aliases and the other leveraging workspaces. To address the confusion this created, the Nx team has spent the last year enhancing Nx to unify these approaches. The goal is to align with "the platform" by adopting and promoting package manager workspaces, while updating Nx plugins to fully support it, preserving the developer experience (DX) benefits Nx users have come to love.

If you're currently using the TypeScript path aliases approach, there's no need to worry. The Nx team is working on comprehensive documentation and semi-automated tools to help with migration. Additionally, it's possible to migrate manually and even incrementally, allowing you to adopt the workspaces at your own pace.
{% /callout %}

**Workspaces: The Recommended Approach**

With widespread support in modern package managers (NPM, PNPM, Yarn, Bun), the workspaces feature has become the preferred method for managing package resolution. It aligns closely with the Node.js platform, leveraging native package resolution mechanisms that also work at runtime. This eliminates the portability issues inherent to TypeScript path aliases.

When combined with **TypeScript project references**, this method becomes even more powerful. Workspaces handles package linking such that Node can resolve them properly, while TypeScript project references optimize type-checking and enable incremental builds (for TypeScript). Together, they improve performance, reduce memory usage, and simplify dependency management in larger workspaces. This combination is the recommended way to structure and manage TypeScript packages in a monorepo.

**To Prebuild or Not to Prebuild?**

Prebuilding packages isn't always necessary. Modern bundlers like Vite and Rspack are optimized for speed, often making in-place compilation sufficient. Some things to consider:

- **Cost of Prebuilding:** Precompiling packages introduces a small overhead, as each package must be built individually. Tools like Nx mitigate this cost with [computation caching](/features/cache-task-results), allowing you to skip redundant builds. If cache results are available, builds can be significantly faster.
- **Selective Prebuilding:** Prebuilding doesn't have to be applied universally. You can start without prebuilding and add it for specific subsets of your projects, such as the leaf nodes in your monorepo's project graph.
- **External Publishing:** Prebuilding is essential if your packages need to be published outside the monorepo with tools like [Nx release](/features/manage-releases).

## Are There Any Downsides to TypeScript Project References?

While TypeScript project references offer significant benefits, they can be maintenance-heavy, especially in large workspaces where their incremental type-checking capabilities are most valuable. The challenge lies in keeping the references array in each `tsconfig.json` file up to date, ensuring all project dependencies are correctly linked.

This is where Nx comes in, eliminating much of the manual effort involved in maintaining TypeScript project references:

- **Automated Setup with Generators:** Nx provides generators for scaffolding applications and library packages. These generators handle the `tsconfig.json` setup automatically, ensuring that TypeScript project references are correctly configured from the start.
- **Automatic Synchronization:** Nx includes a [sync command](/concepts/sync-generators) that is automatically triggered before critical operations like building or serving a project. This command verifies whether the TypeScript project references are in sync across the workspace. If discrepancies are found, Nx automatically updates the references arrays, keeping your configuration consistent and accurate without manual intervention.

## Wrapping Up

We've explored various strategies for configuring TypeScript-based packages in a monorepo, starting with relative imports, moving to TS path aliases, and finally leveraging the workspaces in combination with TypeScript project references.

If you want to try these approaches, check out the companion GitHub repository at [https://github.com/juristr/ts-monorepo-linking](https://github.com/juristr/ts-monorepo-linking), or create a new workspace with Nx:

```shell
npx create-nx-workspace mymonorepo --workspaces
```

> Note `--workspaces` is a temporary flag to instruct Nx to generate a workspaces based monorepo setup.

Also check out our docs:

- [TypeScript Project Linking](/concepts/typescript-project-linking)
- [Switching to Workspaces and Project References](/technologies/typescript/recipes/switch-to-workspaces-project-references)

---

## Learn More

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
