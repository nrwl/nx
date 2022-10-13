# Set up Storybook for Angular Projects

This guide will walk you through setting up [Storybook](https://storybook.js.org) for Angular projects in your Nx workspace.

{% callout type="warning" title="Set up Storybook in your workspace" %}
You first need to set up Storybook for your Nx workspace, if you haven't already. You can read the [Storybook plugin overview guide](/packages/storybook) to get started.
{% /callout %}

## Generate Storybook Configuration for an Angular project

You can generate Storybook configuration for an individual Angular project with this command:

```shell
nx g @nrwl/angular:storybook-configuration project-name
```

## Auto-generate Stories

The `@nrwl/angular:storybook-configuration` generator has the option to automatically generate `*.stories.ts` files for each component declared in the library.

```text
<some-folder>/
├── my.component.ts
└── my.component.stories.ts
```

You can re-run it at a later point using the following command:

```shell
nx g @nrwl/angular:stories <project-name>
```

{% callout type="note" title="Example" %}

Let's take for a example a library in your workspace, under `libs/feature/ui`, called `feature-ui`. This library contains a component, called `my-button`.

The command to generate stories for that library would be:

```shell
nx g @nrwl/angular:stories feature-ui
```

and the result would be the following:

```text
<workspace name>/
├── .storybook/
├── apps/
├── libs/
│   ├── feature/
│   │   ├── ui/
|   |   |   ├── .storybook/
|   |   |   ├── src/
|   |   |   |   ├──lib
|   |   |   |   |   ├──my-button
|   |   |   |   |   |   ├── my-button.component.ts
|   |   |   |   |   |   ├── my-button.component.stories.ts
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

The `storybook-configuration` generator gives the option to set up an e2e Cypress app that is configured to run against the project's Storybook instance.

To launch Storybook and run the Cypress tests against the iframe inside of Storybook:

```shell
nx run project-name-e2e:e2e
```

The url that Cypress points to should look like this:

`'/iframe.html?id=buttoncomponent--primary&args=text:Click+me!;padding;style:default'`

- `buttoncomponent` is a lowercase version of the `Title` in the `*.stories.ts` file.
- `primary` is the name of an individual story.
- `style=default` sets the `style` arg to a value of `default`.

Changing args in the url query parameters allows your Cypress tests to test different configurations of your component. You can [read the documentation](https://storybook.js.org/docs/angular/writing-stories/args#setting-args-through-the-url) for more information.

## Example Files

```typescript {% fileName="*.component.stories.ts" %}
import { moduleMetadata, Story, Meta } from '@storybook/angular';
import { ButtonComponent } from './button.component';

export default {
  title: 'ButtonComponent',
  component: ButtonComponent,
  decorators: [
    moduleMetadata({
      imports: [],
    }),
  ],
} as Meta<ButtonComponent>;

const Template: Story<ButtonComponent> = (args: ButtonComponent) => ({
  props: args,
});

export const Primary = Template.bind({});
Primary.args = {
  text: 'Click me!',
  padding: 0,
  style: 'default',
};
```

**Cypress test file**

> Depending on your Cypress version, the file will end with .spec.ts or .cy.ts

```typescript
describe('shared-ui', () => {
  beforeEach(() =>
    cy.visit(
      '/iframe.html?id=buttoncomponent--primary&args=text:Click+me!;padding;style:default'
    )
  );

  it('should render the component', () => {
    cy.get('storybook-trial-button').should('exist');
  });
});
```

## More Documentation

- [Set up Compodoc for Storybook on Nx](/storybook/angular-storybook-compodoc)
- [Information about the `storybook` targets](/storybook/angular-storybook-targets)
- [Configuring styles and preprocessor options](/storybook/angular-configuring-styles)
- [The `browserTarget`](/storybook/angular-browser-target)

You can find all Storybook-related Nx topics [here](/packages#storybook).

For more on using Storybook, see the [official Storybook documentation](https://storybook.js.org/docs/react/get-started/introduction).

### Migration Scenarios

Here's more information on common migration scenarios for Storybook with Nx. For Storybook specific migrations that are not automatically handled by Nx please refer to the [official Storybook page](https://storybook.js.org/)

- [Upgrading to Storybook 6](/storybook/upgrade-storybook-v6-angular)
- [Migrate to the new Storybook `webpackFinal` config](/storybook/migrate-webpack-final-angular)
