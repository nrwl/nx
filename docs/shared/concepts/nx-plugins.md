---
title: What Are Nx Plugins?
description: Learn how Nx plugins help developers integrate tools and frameworks with Nx by providing automated configuration, code generation, and dependency management.
---

# What Are Nx Plugins?

Nx plugins help developers use a tool or framework with Nx. They allow the plugin author who knows the best way to use a tool with Nx to codify their expertise and allow the whole community to reuse those solutions.

For example, plugins can accomplish the following:

- [Configure Nx cache settings](/concepts/inferred-tasks) for a tool. The [`@nx/webpack`](/technologies/build-tools/webpack/introduction) plugin can automatically configure the [inputs](/recipes/running-tasks/configure-inputs) and [outputs](/recipes/running-tasks/configure-outputs) for a `build` task based on the settings in the `webpack.config.js` file it uses.
- [Update tooling configuration](/features/automate-updating-dependencies) when upgrading the tool version. When Storybook 7 introduced a [new format](https://storybook.js.org/blog/storybook-csf3-is-here) for their configuration files, anyone using the [`@nx/storybook`](/technologies/test-tools/storybook/introduction) plugin could automatically apply those changes to their repository when upgrading.
- [Set up a tool](/features/generate-code) for the first time. With the [`@nx/playwright`](/technologies/test-tools/playwright/introduction) plugin installed, you can use the `@nx/playwright:configuration` code generator to set up Playwright tests in an existing project.
- [Run a tool in an advanced way](/concepts/executors-and-configurations). The [`@nx/js`](/technologies/typescript/introduction) plugin's [`@nx/js:tsc` executor](/technologies/typescript/api/executors/tsc) combines Nx's understanding of your repository with Typescript's native batch mode feature to make your builds [even more performant](/technologies/typescript/recipes/enable-tsc-batch-mode).

## Plugin Features

{% cards %}
{% card title="Infer tasks" description="Automatically configure Nx settings for tasks based on tooling configuration" type="documentation" url="/concepts/inferred-tasks" /%}
{% card title="Generate Code" description="Generate and modify code to set up and use the tool or framework" type="documentation" url="/features/generate-code" /%}
{% card title="Maintain Dependencies" description="Automatically update package versions and tooling configuration" type="documentation" url="/features/generate-code" /%}
{% card title="Enhance Tooling with Executors" description="Run a tool in an advanced way that may not be possible from the command line" type="documentation" url="/concepts/executors-and-configurations" /%}
{% /cards %}

## Types of Plugins

{% cards %}
{% card title="Official and Community Plugins" description="Browse the plugin registry to discover plugins created by the Nx core team and the community" type="documentation" url="/plugin-registry" /%}
{% card title="Build Your Own Plugin" description="Build your own plugin to use internally or share with the community" type="documentation" url="/extending-nx/tutorials/organization-specific-plugin" /%}
{% /cards %}
