# Resolve Circular Dependencies

A circular dependency is when a project transitively depends on itself. This can cause problems in the design of your software and also makes Nx's affected algorithm less effective. The lint rule, `@nx/enforce-module-boundaries`, will produce an error if any circular dependencies are created and ensures that any `import` statements going across projects only `import` from the defined public apis in a project's root `index.ts` file.

When migrating a new codebase into an nx workspace, you'll likely begin to uncover existing circular dependencies. Let's look at the simplest possible circular dependency, where `projectA` depends on `projectB` and vice versa.

**To resolve circular dependencies:**

First, identify the `import` statements causing the dependency. Search in the source folder of `projectA` for references to `@myorg/projectB` and search in the source folder of `projectB` for references to `@myorg/projectA`.

Then there are three strategies you can use:

1. Look for small pieces of code that can be moved from one project to the other.
2. Look for code that both libraries depend on and move that code into a new shared library.
3. Combine `projectA` and `projectB` into one library.
