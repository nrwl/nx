---
title: Setting up Storybook Interaction Tests with Nx
description: This guide shows you how to set up Storybook interaction tests in your Nx workspace and how to run them.
sidebar:
  label: Setting up Storybook Interaction Tests with Nx
filter: 'type:Guides'
---

[Storybook interaction tests](https://storybook.js.org/docs/react/writing-tests/interaction-testing) allow you to test user interactions within your Storybook stories. It enhances your [Storybook](https://storybook.js.org/) setup, ensuring that not only do your components look right, but they also work correctly when interacted with.

## Setting up Storybook interaction tests

### Prerequisites

You need to have Storybook already set up in your Nx workspace. If you don't have Storybook set up yet, you can read the [Storybook plugin overview guide](/docs/technologies/test-tools/storybook/introduction).

### Generate Storybook configuration with interaction tests

When generating your Storybook configuration, make sure to answer `Yes` to the `Do you want to set up Storybook interaction tests?` prompt, or pass the `--interactionTests=true` flag when generating your Storybook configuration.

```shell
nx g @nx/storybook:configuration my-project --interactionTests=true
```

This will set up:

- The `@storybook/addon-interactions` addon
- The `@storybook/testing-library` and `@storybook/jest` dependencies
- A `test-storybook` target for running the interaction tests

### Writing interaction tests

You can now write interaction tests in your stories by using the `play` function. Here's an example:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'Example/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    primary: true,
    label: 'Button',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');

    await expect(button).toBeInTheDocument();
    await userEvent.click(button);
    await expect(button).toHaveFocus();
  },
};
```

### Running interaction tests

You can run your interaction tests using:

```shell
nx test-storybook my-project
```

This will run all the interaction tests in your Storybook stories.

You can also run the tests in headless mode for CI:

```shell
nx test-storybook my-project --ci
```

### Debugging interaction tests

During development, you can watch your interaction tests run in the Storybook UI by:

1. Starting your Storybook: `nx storybook my-project`
2. Opening the Interactions panel in the Storybook UI
3. Running individual story tests by clicking the play button

This allows you to see the tests run step by step and debug any issues.
