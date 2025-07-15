---
title: Set up Storybook for React Projects
description: This guide explains how to set up Storybook for React projects in your Nx workspace.
---

# Set up Storybook for React Projects

This guide will walk you through setting up [Storybook](https://storybook.js.org) for React projects in your Nx workspace.

{% callout type="warning" title="Set up Storybook in your workspace" %}
You first need to set up Storybook for your Nx workspace, if you haven't already. You can read the [Storybook plugin overview guide](/technologies/test-tools/storybook/introduction) to get started.
{% /callout %}

## Generate Storybook Configuration for a React project

You can generate Storybook configuration for an individual React project by using the [`@nx/react:storybook-configuration` generator](/technologies/react/api/generators/storybook-configuration), like this:

```shell
nx g @nx/react:storybook-configuration project-name
```

## Auto-generate Stories

The [`@nx/react:storybook-configuration` generator](/technologies/react/api/generators/storybook-configuration) has the option to automatically generate `*.stories.ts|tsx` files for each component declared in the library. The stories will be generated using [Component Story Format 3 (CSF3)](https://storybook.js.org/blog/storybook-csf3-is-here/).

```text
<some-folder>/
├── my-component.tsx
└── my-component.stories.tsx
```

If you add more components to your project, and want to generate stories for all your (new) components at any point, you can use the [`@nx/react:stories` generator](/technologies/react/api/generators/stories):

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

## Example Files

Let's take for a example a library in your workspace, under `libs/feature/ui`, called `feature-ui` with a component, called `my-button`.

Let's say that your component code looks like this:

```typescript {% fileName="libs/feature/ui/src/lib/my-button/my-button.tsx" %}
export interface MyButtonProps {
  text: string;
  padding: number;
  disabled: boolean;
}

export function MyButton(props: MyButtonProps) {
  return (
    <button disabled={props.disabled} style={{ padding: props.padding }}>
      {props.text}
    </button>
  );
}

export default MyButton;
```

### Story file

The [`@nx/react:storybook-configuration` generator](/technologies/react/api/generators/storybook-configuration) would generate a Story file that looks like this:

```typescript {% fileName="libs/feature/ui/src/lib/my-button/my-button.stories.tsx" %}
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MyButton } from './my-button';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: MyButton,
  title: 'MyButton',
} satisfies Meta<typeof MyButton>;
export default meta;

type Story = StoryObj<typeof MyButton>;

export const Primary = {
  args: {
    text: '',
    padding: 0,
    disabled: false,
  },
} satisfies Story;

export const Heading = {
  args: {
    text: '',
    padding: 0,
    disabled: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/MyButton!/gi)).toBeTruthy();
  },
} satisfies Story;
```

Notice the interaction test on the second story, inside the `play` function. This just tests if the default text that appears on generated components exists in the rendered component. You can edit this test to suit your needs. You can read more about interaction tests [here](https://storybook.js.org/docs/react/writing-tests/interaction-testing).

## More Documentation

You can find all Storybook-related Nx topics [here](/technologies/test-tools/storybook/introduction).

For more on using Storybook, see the [official Storybook documentation](https://storybook.js.org/docs/react/get-started/introduction).

### Migration Scenarios

Here's more information on common migration scenarios for Storybook with Nx. For Storybook specific migrations that are not automatically handled by Nx please refer to the [official Storybook page](https://storybook.js.org/)

- [Set up Storybook version 9](/technologies/test-tools/storybook/recipes/storybook-9-setup)
- [Migrate to Storybook version 9](/technologies/test-tools/storybook/api/generators/migrate-9)
