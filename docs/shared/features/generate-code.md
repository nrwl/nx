---
title: 'Generate Code'
description: 'Learn how to use Nx code generators to automate repetitive tasks, scaffold new projects, and maintain consistency in your codebase.'
---

# Generate Code

{% youtube src="https://youtu.be/hSM6MgWOYr8" title="Generate Code" /%}

Code generators are like automation scripts designed to streamline your workflow. Essentially, they are TypeScript functions that accept parameters and help boost your productivity by:

- Allowing you to **scaffold new projects** or **augment existing projects** with new features, like [adding Storybook support](/technologies/test-tools/storybook/introduction#generating-storybook-configuration)
- **Automating repetitive tasks** in your development workflow
- Ensuring your **code is consistent and follows best practices**

## Invoke Generators

Generators come as part of [Nx plugins](/concepts/nx-plugins) and can be invoked using the `nx generate` command (or `nx g`) using the following syntax: `nx g <plugin-name>:<generator-name> [options]`.

Here's an example of generating a React library:

```shell
nx g @nx/react:lib packages/mylib
```

You can also specify just the generator name and Nx will prompt you to pick between the installed plugins that provide a generator with that name.

```shell
nx g lib packages/mylib
```

When running this command, you could be prompted to choose between the `@nx/react` and `@nx/js` plugins that each provide a library generator.

To see a list of available generators in a given plugin, run `nx list <plugin-name>`. As an example, to list all generators in the @nx/react plugin:

```shell
nx list @nx/react
```

### Use Nx Console

If you prefer a visual interface, then [Nx Console](/getting-started/editor-setup) is an excellent alternative. It provides a way to visually find and run generators:

![Using Nx Console to run generators](/shared/images/nx-console/nx-console-gen-code.avif)

Nx Console is an IDE extension that can be [installed here](/getting-started/editor-setup).

## Build Your Own Generator

You can also customize existing generators by overwriting their behavior or create completely new ones. This is a powerful mechanism as it allows you to:

- **automate** your organization's specific processes and workflows
- **standardize** how and where projects are created in your workspace to make sure they reflect your organization's best practices and coding standards
- **ensure** that your codebase follows your organization's best practices and style guides

At their core, generators are just functions with a specific signature and input options that get invoked by Nx. Something like the following:

```typescript
import { Tree, formatFiles, installPackagesTask } from '@nx/devkit';

export default async function (tree: Tree, schema: any) {
  // Your implementation here
  // ...

  await formatFiles(tree);
  return () => {
    installPackagesTask(tree);
  };
}
```

To help build generators, Nx provides the `@nx/devkit` package containing utilities and helpers. Learn more about creating your own generators on [our docs page](/extending-nx/recipes/local-generators) or watch the video below:

{% youtube src="https://www.youtube.com/embed/myqfGDWC2go" title="Scaffold new Pkgs in a PNPM Workspaces Monorepo" caption="Demonstrates how to use Nx generators in a PNPM workspace to automate the creation of libraries" /%}
