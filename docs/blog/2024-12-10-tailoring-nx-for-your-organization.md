---
title: Tailoring Nx for Your Organization
slug: tailoring-nx-for-your-organization
authors: ['Philip Fulcher']
tags: [nx]
cover_image: /blog/images/2024-12-10/header.avif
description: Create custom Nx plugins to enforce standards and automate workflows, making your monorepo more maintainable and efficient.
---

Maintaining a scalable and maintainable monorepo is one of the biggest challenges for growing teams. Standards are essential for keeping code consistent, but relying on documentation and human diligence often falls short. The real challenge is _how_ to enforce those standards effectively and sustainably.

This is where Nx comes in. Nx provides ["drop-in" plugins](/plugin-registry) that enhance the developer experience in monorepos, offering solutions for everything from code generation to automating caching and task execution. One of the biggest benefits is how easily you can **create [custom plugins](/extending-nx/intro/getting-started)** which allow you to **automate your standards based on your organization's needs**.

In this article, we'll explore how Nx plugins, including custom ones, can help you maintain scalable monorepos while simplifying workflows for your team.

## What are Nx Plugins and why do you need them?

Nx plugins reduce the overhead of using specific tools or frameworks in a monorepo by automating common workflows. They are essentially NPM packages with a structure and metadata that Nx can interpret. A plugin may include:

- **Generators**: For scaffolding code.
- **Executors**: For automating tasks like building, testing, or deploying.
- **Migrations**: For updating codebases, similar to codemods.

You're not required to use Nx plugins, but they can significantly simplify your workflows. For example, they automate repetitive tasks and enforce consistency across your projects. You can explore the [Nx Plugin Registry](/plugin-registry) to see the available plugins, including those built by the Nx core team and contributions from the community.

Installing a plugin is straightforward. Use the `nx add` command to integrate a plugin into your workspace. For example:

```shell
nx add @nx/playwright
```

The plugins provided by the Nx team are usually designed to cover general use cases, like setting up popular frameworks or tools. However, the real power of lies in **creating your own plugins—or extending existing ones—to** automate your organization's specific workflows.

Creating a custom plugin might sound intimidating, but it's simpler than you think. The `@nx/devkit` package provides utilities to help you build functionality just like the Nx core team. You're not starting from scratch; you're leveraging an established API designed to make the process accessible and efficient.

## Getting started with custom plugins

First, install the `@nx/plugin` package which provides useful code scaffolding features for creating a new custom plugin.

```shell
nx add @nx/plugin
```

Once installed, run the following generator that ships with the `@nx/plugin` package:

```shell
nx g plugin packages/nx-plugin --importPath=@org/nx-plugin
```

Also, make sure to check out our [extensive instructions in our docs for building plugins](/extending-nx/intro/getting-started), or you can jump right to the API for [@nx/plugin](/nx-api/plugin).

## Setting up custom generators

Creating custom generators is the biggest bang-for-your-buck change you can make using custom plugins. The generators distributed with Nx plugins have a wide set of options that allow you to fine-tune their output to meet your needs. But if you have decided on certain rules for your organization, such as a directory structure or project tag schema, it can be easy to forget some of your options when running a generator.

Custom generators are an easy way to enforce how generators from Nx plugins are used. For example:

```shell
nx generate @nx/react:library --name shared-util --directory libs/shared/util --importPath="@org/shared/util" --tags=type:util,scope:shared
```

To understand the right options for this generator, the engineer needs to remember:

- the project naming convention based on the type of library and its scope
- the directory structure based on nested folders for scope
- the import naming convention
- tag name convention based on type and scope

This is a lot to remember! Even the most diligent engineer will forget one of these or miss a typo. **A custom generator** can solve this problem.
Consider a custom generator for your organization that accepts options like this:

```shell
nx generate @org/plugin:library --name util --scope shared --type util
```

This command runs our hypothetical custom generator and provides it with a scope and type for the library. This custom generator takes well-defined options for your org and translates them into the options needed for the underlying generator. A snippet of that would look something like this:

```typescript
import { Tree } from '@nx/devkit';
import { Linter } from '@nx/eslint';
import { libraryGenerator as reactLibraryGenerator } from '@nx/react';
import { LibraryGeneratorSchema } from './schema';

export async function libraryGenerator(
  tree: Tree,
  options: LibraryGeneratorSchema // schema with strong types for scope and type
) {
  // create project name based on submitted name and type
  const projectName = `${options.type}-${options.name}`;

  // determine directory based on scope and project name
  const directory = joinPathFragments('libs', options.scope, projectName);

  // determine import path based on scope and project name
  const importPath = `@org/${scope}/${projectName}`;

  // run the @nx/react library generator with options set
  const callbackAfterFilesUpdated = await reactLibraryGenerator(tree, {
    name: projectName,
    directory,
    importPath,
    tags: [`type:${options.type}`, `scope:${shared}`],
    linter: 'eslint',
    style: 'css',
    unitTestRunner: 'vitest',
  });

  return callbackAfterFilesUpdated;
}

export default libraryGenerator;
```

This example of a generator doesn't do much on its own, but it pre-populates options for the underlying generator. This can already be a huge gain in terms of ensuring consistency as it:

- Names the project appropriately
- Creates the correct import path
- Places new projects in the correct directory
- Adds the proper tags to the project
- Selects the correct set of tools

All of that without having to refer to your documentation on how to run the generator the right way. And most of the functionality is provided by Nx! You only need to provide some logic specific to your organization.

These generators will also show up in [Nx Console](/getting-started/editor-setup) alongside the other generators from Nx plugins, so engineers will have quick access.

{% youtube src="https://www.youtube.com/watch?v=myqfGDWC2go" /%}

## Publish to your org with `nx release`

Nx plugins that are located within an existing Nx workspace can be run directly, without the need to build, bundle, or package. They just work and respond to changes just as quickly as any other project in your workspace.

Since we're the monorepo people, it might seem wild to suggest that you would have multiple monorepos in your organization; but this is a common scenario, and we whole-heartedly support it.

To support consistency across your org, you can publish this plugin so that all of your Nx workspaces share the same generators and inferred tasks you just created. This makes onboarding any new Nx workspace easier and more consistent. The generator for your plugin will include configuration for [`nx release`](/features/manage-releases) so that you're ready to publish immediately:

```bash
nx release --first-release
```

If you want to test your package by publishing locally, your project will also be set up with a [Verdaccio configuration](/nx-api/js/executors/verdaccio) that allows you to run a local registry for testing your new plugin locally:

```bash
nx local-registry
```

## Presets to create your workspace the way you want it, every time

If you're publishing a plugin for multiple workspaces in your organization, you'll want those new workspaces to be created as consistently as your projects. When you create an Nx workspace, you might use a preset like this:

```shell
npx create-nx-workspace@latest react-monorepo --preset=react-monorepo
```

You can [create this same type of preset for your org](/extending-nx/recipes/create-preset), so that new workspaces are set up the same way each time:

```shell
npx create-nx-workspace@latest react-monorepo --preset=org-react
```

Better yet, you can [create your own install package](/extending-nx/recipes/create-install-package), so calling `create-org-workspace` becomes your new standard instead of calling `create-nx-workspace:`

```shell
npx create-org-workspace@latest react-monorepo --framework=react
```

{% youtube src="https://www.youtube.com/watch?v=ocllb5KEXZk" /%}

## What else can a custom plugin provide?

Your plugin can provide _anything an existing Nx plugin provides._ This includes, but is not limited to:

- [Generators](/extending-nx/recipes/local-generators)
- [Task inference](/extending-nx/tutorials/tooling-plugin)
- [Custom eslint rules](/nx-api/eslint/generators/workspace-rule#nxeslintworkspacerule)
- [Migrations](/extending-nx/recipes/migration-generators)
- Shared tool configs
- CI pipeline starters

## Start consistent, stay consistent

Small changes to how Nx is used in your organization can make a big difference. All of these options to tailor Nx to your organization make the right thing to do, the easy thing to do. When your tooling is easier to use than doing it wrong, your engineers are more likely to adopt conventions and maintain them.

## Learn More

- [Enforce Organizational Best Practices with a Local Plugin](/extending-nx/tutorials/organization-specific-plugin)
- [Create a Tooling Plugin](/extending-nx/tutorials/tooling-plugin)

Also, make sure to check out:

- [Nx Docs](https://www.notion.so/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools)
- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Bluesky](https://bsky.app/profile/nx.dev)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)
