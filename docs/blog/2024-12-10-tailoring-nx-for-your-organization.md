---
title: Tailoring Nx for your organization
slug: tailoring-nx-for-your-organization
authors: ['Philip Fulcher']
tags: [nx]
cover_image: /blog/images/2024-12-10/header.avif
---

# Tailoring Nx for your organization

Monorepos enable consistent use of tooling across your organization's many projects. Nx provides an array of plugins with generators and task inference that simplify tool use and configuration. But these plugins are general-use by design: we can’t foresee your exact use case, but we _do_ provide the materials to tailor Nx for your organization.

[Custom plugins](/extending-nx/intro/getting-started) allow you to provide tools, configurations, and utilities to craft Nx for your organization’s specific needs.

## Getting started with custom plugins

Creating a custom plugin couldn’t be easier. [@nx/plugin](/nx-api/plugin) is our plugin for creating new Nx plugins, and it provides a generator for getting started:

```bash
nx g plugin nx-plugin --directory=plugins --importPath=@org/nx-plugin
```

We have an [extensive instructions in our docs for building plugins](/extending-nx/intro/getting-started), or you can jump right to the API for [@nx/plugin](/nx-api/plugin).

## Setting up custom generators

Creating custom generators is the biggest bang-for-your-buck change you can make using custom plugins. The generators distributed with Nx plugins have a wide set of options that allow you to fine-tune their output to meet your needs. But if you have decided on certain rules for your organization, such as a directory structure or project tag schema, it can be easy to forget some of your options when running a generator.

Custom generators are an easy way to enforce how generators from Nx plugins are used. For example:

```bash
nx generate @nx/react:library --name shared-util --directory libs/shared/util --importPath="@org/shared/util" --tags=type:util,scope:shared
```

To understand the right options for this generator, the engineer needs to remember:

- the project naming convention based on the type of library and its scope
- the directory structure based on nested folders for scope
- the import naming convention
- tag name convention based on type and scope

This is a lot to remember! Even the most diligent engineer will forget one of these or miss a typo. **A custom generator** can solve this problem. Consider a custom generator for your organization that accepts options like this:

```bash
nx generate @org/plugin:library --name util --scope shared --type util
```

This custom generator takes well-defined options for your org and translates them into the options needed for the underlying generator. A snippet of that would look something like this:

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
  //determine directory based on scope and project name
  const directory = joinPathFragments('libs', options.scope, projectName);
  // determine import path based on scope and project name
  const importPath = `@org/${scope}/${projectName}`;
  // run the @nx/react library generator with options set
  const callbackAfterFilesUpdated = await reactLibraryGenerator(tree, {
    name: projectName,
    directory,
    importPath,
    tags: [`type:${options.type}`, `scope:${shared}`],
    linter: Linter.EsLint,
    style: 'css',
    unitTestRunner: 'vitest',
  });

  return callbackAfterFilesUpdated;
}

export default libraryGenerator;
```

This example of a generator doesn’t do much but pass in options to an existing generator. However, it will consistently:

- Name the project appropriately
- Create the correct import path
- Place new projects in the correct directory
- Add the proper tags to the project
- Select the correct set of tools

All of that without having to refer to your documentation on how to run the generator the right way. And most of the functionality is provided by Nx! You just need to provide some logic specific to your organization.

These generators will also show up in [Nx Console](/getting-started/editor-setup) alongside the other generators from Nx plugins, so engineers will have quick access.

{% youtube src="https://www.youtube.com/watch?v=myqfGDWC2go" /%}

## Configure your tools in one place with custom inferred tasks

[Inferred tasks](/concepts/inferred-tasks) are a powerful option for reducing the configuration of tasks in your monorepo. Each plugin with inferred tasks offers some configuration, but what if you need to adjust something that’s not configurable out of the box? What if there’s a tool that we don’t have a plugin for?

Writing your own task inference plugin allows you handle these situations. Let’s say the hottest, coolest new tool hits the ecosystem, and you need to use it today. You could drop an issue in GitHub asking for the core team to support it. Or you could write it yourself and use it today. Imagine this new tool is named `zebra` and has a config file `zebra.json` for each project. The inferred task function for this could look something like this:

```typescript
export const createNodes: CreateNodes = [
  '**/zebra.json', // search workspace for files named zebra.json
  (fileName: string, opts, context: CreateNodesContext) => {
    // nodes on the project graph are set by a source root
    const root = dirname(fileName);

    // add a zebra task to that project
    return {
      projects: {
        [root]: {
          targets: {
            zebra: {
              command: `zebra .`,
            },
          },
        },
      },
    };
  },
];
```

This is a very naive implementation, but it gives you an idea of what implementing these task inference plugins looks like. [Check out this much more developed example.](/extending-nx/tutorials/tooling-plugin)

## Publish to your org with `nx release`

Plugins can also be bundled and published for your organization. Since we’re the monorepo people, it might seem wild to suggest that you would have multiple monorepos in your organization; but this is a common scenario, and we whole-heartedly support it.

To support consistency across your org, you can publish this plugin so that all of your Nx workspaces share the same generators and inferred tasks you just created. This makes onboarding any new Nx workspace easier and more consistent. The generator for your plugin will include configuration for [`nx release`](/features/manage-releases) so that you’re ready to publish immediately.

## Presets to create your workspace the way you want it, every time

If you’re publishing a plugin for multiple workspaces in your organization, you’ll want those new workspaces to be created as consistently as your projects. When you create an Nx workspace, you might use a preset like so:

```bash
npx create-nx-workspace@latest react-monorepo --preset=react-monorepo
```

You can [create this same type of preset for your org](/extending-nx/recipes/create-preset), so that new workspaces are setup the same way each time:

```bash
npx create-nx-workspace@latest react-monorepo --preset=org-react
```

Better yet, you can [create your own install package](/extending-nx/recipes/create-install-package), so calling `create-org-workspace` becomes your new standard instead of calling `create-nx-workspace:`

```bash
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
- [Nx Docs](https://www.notion.so/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools)
- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Bluesky](https://bsky.app/profile/nx.dev)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](https://www.notion.so/nx-cloud)
