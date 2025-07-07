---
title: Setting up Storybook Interaction Tests with Nx
description: This guide explains how you can set up Storybook interaction tests on your Nx workspace.
---

# Setting up Storybook Interaction Tests with Nx

[Storybook interaction tests](https://storybook.js.org/docs/react/writing-tests/interaction-testing) allow you to test user interactions within your Storybook stories. It enhances your [Storybook](https://storybook.js.org/) setup, ensuring that not only do your components look right, but they also work correctly when interacted with.

{% youtube
src="https://youtu.be/SaHoUx-TUs8"
title="Storybook can do...WHAT???" /%}

You can read more about Storybook interaction tests in the following sections of the Storybook documentation:

- [Storybook interaction tests for React](https://storybook.js.org/docs/react/writing-tests/interaction-testing)
- [Storybook interaction tests for Angular](https://storybook.js.org/docs/angular/writing-tests/interaction-testing)
- [Storybook interaction tests for Vue](https://storybook.js.org/docs/vue/writing-tests/interaction-testing)
- [Storybook test runner](https://storybook.js.org/docs/react/writing-tests/test-runner)
- [The `play` function](https://storybook.js.org/docs/react/writing-stories/play-function)

{% callout type="warning" title="Set up Storybook in your workspace" %}
You first need to set up Storybook for your Nx workspace, if you haven't already. You can read the [Storybook plugin overview guide](/technologies/test-tools/storybook/introduction) to get started.
{% /callout %}

## Setup Storybook Interaction Tests

During the setup, you'll be prompted about setting up interaction tests. Choose `yes` when asked if you want to set up Storybook interaction tests.

The `--interactionTests` flag is `true` by default, so when you're setting up Storybook, you can just press **Enter** to accept the default value, or even pass the flag directly. Make sure to use the framework-specific generators, so that you also get your stories set up correctly:

{% tabs %}
{% tab label="Angular" %}

```shell
nx g @nx/angular:storybook-configuration project-name --interactionTests=true
```

{% /tab %}
{% tab label="React" %}

```shell
nx g @nx/react:storybook-configuration project-name --interactionTests=true
```

{% /tab %}
{% tab label="Vue" %}

```shell
nx g @nx/vue:storybook-configuration project-name --interactionTests=true
```

{% /tab %}
{% tab label="No framework" %}

```shell
nx g @nx/storybook:configuration project-name --interactionTests=true
```

{% /tab %}
{% /tabs %}

This command will:

- [Set up Storybook for your project](/technologies/test-tools/storybook/introduction) - including the `@storybook/addon-interactions` addon.
- Add a `play` function to your stories.
- Install the necessary dependencies.
- [Infer the task](/concepts/inferred-tasks) `test-storybook` for the project, which has a command to invoke the Storybook test runner.

{% callout type="note" title="Using explicit tasks" %}
If you're on an Nx version lower than 18 or have opted out of using inferred tasks, the `test-storybook` target will be explicitly defined in the project's `project.json` file.
{% /callout %}

## Writing an Interaction Test

The Nx generator will create a very simple interaction test for you. You can find it in the `.stories.ts` file for your component. This test will only be asserting if some text exists in your component.
You can modify it to suit your needs.

Let's take an example of a simple React component for a button:

```typescript
import React, { useState } from 'react';

export function Button() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(count + 1);
  };

  return (
    <button role="button" onClick={handleClick}>
      You've clicked me {count} times
    </button>
  );
}

export default Button;
```

In your `.stories.ts` file for that component, you can use the `play` function to simulate interactions. For example:

```typescript
export const ButtonClicked: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.click(button);
    expect(canvas.getByRole('button').innerText).toBe(
      "You've clicked me 1 times"
    );
    await userEvent.click(button);
    expect(canvas.getByRole('button').innerText).toBe(
      "You've clicked me 2 times"
    );
  },
};
```

Here, the `play` function is simulating a click on the button using the `userEvent.click` method. It is then asserting that the button's text has changed to reflect the number of times it has been clicked.

You can read more about how to write interaction tests in the [Storybook documentation](https://storybook.js.org/docs/react/writing-tests/interaction-testing).

## Running Interaction Tests

To run the interaction tests, you can use the `test-storybook` target that was generated for your project:

```shell
nx test-storybook project-name
```

Make sure you have Storybook running in another tab, so that the test runner can connect to it:

```shell
nx storybook project-name
```

## Interaction Tests vs. Cypress E2E Tests

As the landscape of testing has evolves, we are also adjusting our approach to testing in Nx, and the Storybook generators. Nx has been consistently suggesting the use of Cypress for e2e tests in conjunction with Storybook. This approach, while effective, had its own challenges. A new, separate e2e project would be generated, and setup specifically to work with Storybook, leading to a bifurcated setup: your component stories in one place, and the e2e tests that validated them in another.

However, with the introduction of Storybook Interaction Tests, this approach can be simplified. This new feature allows developers to integrate tests directly within the stories they are already creating, making the development and testing process more straightforward. Why maintain two separate projects or setups when you can do everything in one place?

Choosing to promote Storybook Interaction Tests over the previous Cypress e2e setup was not a decision made lightly. Here's why we believe it's a beneficial shift:

- **Unified Workflow:** Interaction tests allow developers to keep their focus on one tool. Instead of juggling between Storybook and a separate e2e project, everything is integrated. This means quicker iterations and a simplified dev experience.

- **Leaner Project Structure:** Avoiding the need to generate a separate e2e project means fewer files, less configuration, and a more straightforward project structure. This can make onboarding new developers or navigating the codebase simpler.

- **Optimized Performance:** Interaction tests are lightweight and quick to execute compared to traditional e2e tests. They run directly in the context of the component story, ensuring that tests are precise and fast.

- **Consistency:** Keeping the stories and their associated tests together ensures a tighter bond between what's developed and what's tested. It reduces the chances of tests becoming outdated or misaligned with the component's actual behavior.

Because of these benefits, it made sense for our Storybook configuration generator to switch from the Cypress e2e + Storybook combination to the integrated approach of Storybook Interaction Tests. By integrating e2e-like tests into the existing Storybook setup, we offer developers a smoother, more efficient, and simpler setup and testing experience.
