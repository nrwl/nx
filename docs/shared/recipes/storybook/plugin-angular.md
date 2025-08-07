---
title: Set up Storybook for Angular Projects
description: This guide explains how to set up Storybook for Angular projects in your Nx workspace.
---

# Set up Storybook for Angular Projects

This guide will walk you through setting up [Storybook](https://storybook.js.org) for Angular projects in your Nx workspace.

{% callout type="warning" title="Set up Storybook in your workspace" %}
You first need to set up Storybook for your Nx workspace, if you haven't already. You can read the [Storybook plugin overview guide](/technologies/test-tools/storybook/introduction) to get started.
{% /callout %}

## Generate Storybook Configuration for an Angular project

You can generate Storybook configuration for an individual Angular project by using the [`@nx/angular:storybook-configuration` generator](/technologies/angular/api/generators/storybook-configuration), like this:

```shell
nx g @nx/angular:storybook-configuration project-name
```

## Auto-generate Stories

The [`@nx/angular:storybook-configuration` generator](/technologies/angular/api/generators/storybook-configuration) has the option to automatically generate `*.stories.ts` files for each component declared in the library. The stories will be generated using [Component Story Format 3 (CSF3)](https://storybook.js.org/blog/storybook-csf3-is-here/).

```text
<some-folder>/
├── my-component.ts
└── my-component.stories.ts
```

If you add more components to your project, and want to generate stories for all your (new) components at any point, you can use the [`@nx/angular:stories` generator](/technologies/angular/api/generators/stories):

```shell
nx g @nx/angular:stories --project=<project-name>
```

{% callout type="note" title="Example" %}
Let's take for a example a library in your workspace, under `libs/feature/ui`, called `feature-ui`. This library contains a component, called `my-button`.

The command to generate stories for that library would be:

```shell
nx g @nx/angular:stories --project=feature-ui
```

and the result would be the following:

```text
<workspace name>/
├── apps/
├── libs/
│   ├── feature/
│   │   ├── ui/
|   |   |   ├── .storybook/
|   |   |   ├── src/
|   |   |   |   ├──lib
|   |   |   |   |   ├──my-button
|   |   |   |   |   |   ├── my-button.ts
|   |   |   |   |   |   ├── my-button.stories.ts
|   |   |   |   |   |   └── etc...
|   |   |   |   |   └── etc...
|   |   |   ├── README.md
|   |   |   ├── tsconfig.json
|   |   |   └── etc...
|   |   └── etc...
|   └── etc...
├── nx.json
├── package.json
├── README.md
└── etc...
```

{% /callout %}

## Example Files

Let's take for example a library in your workspace, under `libs/feature/ui`, called `feature-ui` with a component, called `my-button`.

Let's say that the template for that component looks like this:

```html {% fileName="libs/feature/ui/src/lib/my-button/my-button.html" %}
<button [disabled]="disabled" [ngStyle]="{ 'padding.px': padding }">
  {{ text }}
</button>
```

and the component looks like this:

```typescript {% fileName="libs/feature/ui/src/lib/my-button/my-button.ts" %}
import { Component, Input } from '@angular/core';

@Component({
  selector: 'feature-ui-my-button',
  standalone: true,
  templateUrl: './my-button.html',
  styleUrls: ['./my-button.css'],
})
export class MyButton {
  @Input() text = 'Click me!';
  @Input() padding = 10;
  @Input() disabled = true;
}
```

### Story file

The [`@nx/angular:storybook-configuration` generator](/technologies/angular/api/generators/storybook-configuration) would generate a Story file that looks like this:

```typescript {% fileName="libs/feature/ui/src/lib/my-button/my-button.stories.ts" %}
import type { Meta, StoryObj } from '@storybook/angular';
import { MyButton } from './my-button';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<MyButton> = {
  component: MyButton,
  title: 'MyButton',
};
export default meta;

type Story = StoryObj<MyButton>;

export const Primary: Story = {
  args: {
    text: 'Click me!',
    padding: 10,
    disabled: true,
  },
};

export const Heading: Story = {
  args: {
    text: 'Click me!',
    padding: 10,
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/my-button/gi)).toBeTruthy();
  },
};
```

Notice the interaction test on the second story, inside the `play` function. This just tests if the default text that appears on generated components exists in the rendered component. You can edit this test to suit your needs. You can read more about interaction tests [here](https://storybook.js.org/docs/angular/writing-tests/interaction-testing).

## Understanding the role of `browserTarget`

You will notice that `browserTarget` is specified for the `storybook` and `build-storybook` targets, much like it is done for `serve` or other targets. Angular needs the `browserTarget` for Storybook in order to know which configuration to use for the build. If your project is buildable (it has a `build` target, and uses the main Angular builder - `@angular-devkit/build-angular:browser`, `@angular-devkit/build-angular:application` or `@angular-devkit/build-angular:browser-esbuild`) the `browserTarget` for Storybook will use the `build` target, if it's not buildable (or is using another Angular builder) it will use the `build-storybook` target.
You do not have to do anything manually. Nx will create the configuration for you. Even if you are migrating from an older version of Nx, Nx will make sure to change your `package.json` Storybook targets to match the new schema.

You can read more about the `browserTarget` in the [official Angular documentation](https://angular.dev/cli/serve).

Your Storybook targets in your `project.json` (or if you run `nx show project my-project --web`) will look like this:

```jsonc {% fileName="project.json" %}
    "storybook": {
      "executor": "@storybook/angular:start-storybook",
      "options": {
         ...
        "browserTarget": "my-project:build"
      },
      ...
    },
    "build-storybook": {
      "executor": "@storybook/angular:build-storybook",
       ...
      "options": {
         ...
        "browserTarget": "my-project:build"
      },
     ...
    }
```

This setup instructs Nx to use the configuration under the `build` target of `my-project` when using the `storybook` and `build-storybook` executors.

## More Documentation

- [Set up Compodoc for Storybook on Nx](/technologies/test-tools/storybook/recipes/angular-storybook-compodoc)
- [Configuring styles and preprocessor options](/technologies/test-tools/storybook/recipes/angular-configuring-styles)

You can find all Storybook-related Nx topics [here](/technologies/test-tools/storybook/introduction).

For more on using Storybook, see the [official Storybook documentation](https://storybook.js.org/docs/angular/get-started/introduction).

### Migration Scenarios

Here's more information on common migration scenarios for Storybook with Nx. For Storybook specific migrations that are not automatically handled by Nx please refer to the [official Storybook page](https://storybook.js.org/)

- [Set up Storybook version 9](/technologies/test-tools/storybook/recipes/storybook-9-setup)
- [Migrate to Storybook version 9](/technologies/test-tools/storybook/api/generators/migrate-9)
