---
title: Setting up Storybook Interaction Tests with Nx
description: This guide shows you how to set up Storybook interaction tests in your Nx workspace and how to run them.
sidebar:
  label: Setting up Storybook Interaction Tests with Nx
filter: 'type:Guides'
topics:
  - 'Storybook'
---

[Storybook interaction tests](https://storybook.js.org/docs/writing-tests/interaction-testing) let you test user interactions inside your stories. They enhance your [Storybook](https://storybook.js.org/) setup, so that your components not only look right but also behave correctly when interacted with.

## Setting up Storybook interaction tests

### Prerequisites

You need Storybook already set up in your Nx workspace. If you don't have Storybook set up yet, read the [Storybook plugin overview guide](/docs/technologies/test-tools/storybook/introduction).

### Generate Storybook configuration with interaction tests

When generating your Storybook configuration, answer `Yes` to the `Do you want to set up Storybook interaction tests?` prompt, or pass the `--interactionTests=true` flag.

```shell
nx g @nx/storybook:configuration my-project --interactionTests=true
```

This installs [`@storybook/test-runner`](https://storybook.js.org/docs/writing-tests/integrations/test-runner) at a version that matches your Storybook major, and the `@nx/storybook/plugin` then infers a `test-storybook` target for the project.

### Writing interaction tests

Write interaction tests in your stories using the `play` function:

```typescript
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'Example/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
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

{% aside type="note" %}
Storybook 8 replaced `@storybook/testing-library` and `@storybook/jest` with a single `@storybook/test` package, and Storybook 9 moved that into the `storybook` package as the `storybook/test` entry point and folded in `@storybook/addon-interactions`. On Storybook 9 and later, import `expect`, `userEvent`, and `within` from `storybook/test`.
{% /aside %}

### Running interaction tests

The test runner drives a Storybook that is already serving.
Start Storybook in one terminal and leave it running:

```shell
nx storybook my-project
```

Run the interaction tests from a second terminal:

```shell
nx test-storybook my-project
```

You can also point the test runner at a published Storybook with `--url`.

### Using the Vitest addon instead

Storybook recommends [`@storybook/addon-vitest`](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon) for Vite-powered frameworks.
Nx doesn't configure it for you.
Use Storybook 10 or later.
On Storybook 9 the installer writes its Vitest config next to the directory you run it from, not next to the project.
The inferred target runs from the project root, so it doesn't find the `storybook` Vitest project.

From the workspace root, replace `<project-root>` with the project's root directory and run:

```shell
npx storybook add @storybook/addon-vitest --config-dir <project-root>/.storybook
```

This command registers the addon, creates the `storybook` Vitest project, and installs the required browser dependencies. Once the addon is installed, `@nx/storybook/plugin` infers `test-storybook` as a Vitest run against that project rather than a test-runner command, for projects whose Storybook framework uses the Vite builder.

### Debugging interaction tests

During development, watch your interaction tests run in the Storybook UI:

1. Start your Storybook: `nx storybook my-project`
2. Open the Interactions panel in the Storybook UI
3. Run individual story tests by clicking the play button

Step through the tests from that panel to debug any failures.
