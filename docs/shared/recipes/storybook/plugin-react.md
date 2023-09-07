---
title: Set up Storybook for React Projects
description: This guide explains how to set up Storybook for React projects in your Nx workspace.
---

# Set up Storybook for React Projects

This guide will walk you through setting up [Storybook](https://storybook.js.org) for React projects in your Nx workspace.

{% callout type="warning" title="Set up Storybook in your workspace" %}
You first need to set up Storybook for your Nx workspace, if you haven't already. You can read the [Storybook plugin overview guide](/packages/storybook) to get started.
{% /callout %}

## Generate Storybook Configuration for a React project

You can generate Storybook configuration for an individual React project by using the [`@nx/react:storybook-configuration` generator](/packages/react/generators/storybook-configuration), like this:

```shell
nx g @nx/react:storybook-configuration project-name
```

## Nx React Storybook Preset

The [`@nx/react`](/packages/react) package ships with a Storybook addon to make sure it uses the very same configuration as your Nx React application. When you generate a Storybook configuration for a project, it'll automatically add the addon to your configuration.

```typescript
module.exports = {
  ...
  addons: ['@storybook/addon-essentials', ..., '@nx/react/plugins/storybook'],
  ...
};
```

## Auto-generate Stories

The [`@nx/react:storybook-configuration` generator](/packages/react/generators/storybook-configuration) has the option to automatically generate `*.stories.ts|tsx` files for each component declared in the library. The stories will be generated using [Component Story Format 3 (CSF3)](https://storybook.js.org/blog/storybook-csf3-is-here/).

```text
<some-folder>/
├── my-component.tsx
└── my-component.stories.tsx
```

If you add more components to your project, and want to generate stories for all your (new) components at any point, you can use the [`@nx/react:stories` generator](/packages/react/generators/stories):

```shell
nx g @nx/react:stories --project=<project-name>
```

{% callout type="note" title="Example" %}
Let's take for a example a library in your workspace, under `libs/feature/ui`, called `feature-ui`. This library contains a component, called `my-button`.

The command to generate stories for that library would be:

```shell
nx g @nx/react:stories --project=feature-ui
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
|   |   |   |   |   |   ├── my-button.tsx
|   |   |   |   |   |   ├── my-button.stories.tsx
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

## Cypress tests for Stories

The [`@nx/react:storybook-configuration` generator](/packages/react/generators/storybook-configuration) gives the option to set up an e2e Cypress app that is configured to run against the project's Storybook instance.

To launch Storybook and run the Cypress tests against the iframe inside of Storybook:

```shell
nx run project-name-e2e:e2e
```

The url that Cypress points to should look like this:

`'/iframe.html?id=mybutton--primary&args=text:Click+me!;padding;style:default'`

- `buttoncomponent` is a lowercase version of the `Title` in the `*.stories.tsx` file.
- `primary` is the name of an individual story.
- `style=default` sets the `style` arg to a value of `default`.

Changing args in the url query parameters allows your Cypress tests to test different configurations of your component. You can [read the documentation](https://storybook.js.org/docs/react/writing-stories/args#setting-args-through-the-url) for more information.

## Example Files

Let's take for a example a library in your workspace, under `libs/feature/ui`, called `feature-ui` with a component, called `my-button`.

### Story file

The [`@nx/react:storybook-configuration` generator](/packages/react/generators/storybook-configuration) would generate a Story file that looks like this:

```typescript {% fileName="libs/feature/ui/src/lib/my-button/my-button.stories.tsx" %}
import type { Meta } from '@storybook/react';
import { MyButton } from './my-button';

const Story: Meta<typeof MyButton> = {
  component: MyButton,
  title: 'MyButton',
};
export default Story;

export const Primary = {
  args: {
    text: 'Click me!',
    padding: 10,
    disabled: true,
  },
};
```

### Cypress test file

For the library described above, Nx would generate an E2E project called `feature-ui-e2e` with a Cypress test file that looks like this:

```typescript {% fileName="apps/feature-ui-e2e/src/e2e/my-button/my-button.cy.ts" %}
describe('feature-ui: MyButton component', () => {
  beforeEach(() =>
    cy.visit(
      '/iframe.html?id=mybutton--primary&args=text:Click+me!;padding;style:default'
    )
  );

  it('should contain the right text', () => {
    cy.get('button').should('contain', 'Click me!');
  });
});
```

Depending on your Cypress version, the file will end with `.spec.ts` or `.cy.ts`.

## More Documentation

You can find all Storybook-related Nx topics [here](/packages#storybook).

For more on using Storybook, see the [official Storybook documentation](https://storybook.js.org/docs/react/get-started/introduction).

### Migration Scenarios

Here's more information on common migration scenarios for Storybook with Nx. For Storybook specific migrations that are not automatically handled by Nx please refer to the [official Storybook page](https://storybook.js.org/)

- [Set up Storybook version 7](/packages/storybook/documents/storybook-7-setup)
- [Migrate to Storybook version 7](/packages/storybook/generators/migrate-7)

#### Older migration scenarios

- [Upgrading to Storybook 6](/deprecated/storybook/upgrade-storybook-v6-react)
- [Migrate to the Nx React Storybook Addon](/deprecated/storybook/migrate-webpack-final-react)
