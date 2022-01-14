# Analyzing & Visualizing Workspaces

To be able to support the monorepo-style development, the tools must know how different projects in your workspace depend on each other. Nx uses advanced code analysis to construct this project graph. And it gives you a way to explore it:

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/cMZ-ReC-jWU" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

## How the Project Graph is Built

Nx creates a graph of all the dependencies between projects in your workspace using two sources of information:

1. Typescript `import` statements referencing a particular project's path alias

   For instance, if a file in `my-app` has this code:

   ```typescript
   import { something } from '@myorg/awesome-library';
   ```

   Then `my-app` depends on `awesome-library`

2. Manually created `implicitDependencies` in the `nx.json` file.

   If your `nx.json` has this content:

   ```json
   {
     "projects": {
       "my-app": {
         "tags": [],
         "implicitDependencies": ["my-api"]
       }
     }
   }
   ```

   Then `my-app` depends on `my-api`

## Circular Dependencies

A circular dependency is when a project transitively depends on itself. This can cause problems in the design of your software and also makes Nx's affected algorithm less effective. The lint rule, `nx-enforce-module-boundaries`, will produce an error if any circular dependencies are created and ensures that any `import` statements going across projects only `import` from the defined public apis in a project's root `index.ts` file.

When migrating a new codebase into an nx workspace, you'll likely begin to uncover existing circular dependencies. Let's look at the simplest possible circular dependency, where `projectA` depends on `projectB` and vice versa.

**To resolve circular dependencies:**

First, identify the `import` statements causing the dependency. Search in the source folder of `projectA` for references to `@myorg/projectB` and search in the source folder of `projectB` for references to `@myorg/projectA`.

Then there are three strategies you can use:

1. Look for small pieces of code that can be moved from one project to the other.
2. Look for code that both libraries depend on and move that code into a new shared library.
3. Combine `projectA` and `projectB` into one library.
