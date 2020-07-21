# Storybook

![Storybook logo](/shared/storybook-logo.png)

Storybook is a development environment for UI components. It allows you to browse a component library, view the different states of each component, and interactively develop and test components.

## How to Use Storybook in an Nx Repo

### Add the Storybook plugin

```bash
yarn add --dev @nrwl/storybook
```

### Generating Storybook Configuration

You can generate Storybook configuration for an individual project with this command:

```bash
nx g @nrwl/angular:storybook-configuration project-name
```

If there's no `.storybook` folder at the root of the workspace, one is created.

```treeview
<workspace name>/
├── .storybook/
│   ├── addons.js
│   ├── tsconfig.json
│   └── webpack.config.js
├── apps/
├── libs/
├── nx.json
├── package.json
├── README.md
└── etc...
```

Also, a project-specific `.storybook` folder is added in the root of the project.

```treeview
<project root>/
├── .storybook/
│   ├── addons.js
│   ├── config.js
│   ├── tsconfig.json
│   └── webpack.config.js
├── src/
├── README.md
├── tsconfig.json
└── etc...
```

### Running Storybook

Serve Storybook using this command:

```bash
nx run project-name:storybook
```

### Auto-generate Stories

The `@nrwl/angular:storybook-configuration` schematic has the option to automatically generate `*.stories.ts` files for each component declared in the library.

```treeview
<some-folder>/
├── my.component.ts
└── my.component.stories.ts
```

### Run Cypress Tests Against a Storybook Instance

Both `storybook-configuration` schematic gives the option to set up an e2e Cypress app that is configured to run against the project's Storybook instance.

To launch Storybook and run the Cypress tests against the iframe inside of Storybook:

```bash
nx run project-name-e2e:e2e
```

The url that Cypress points to should look like this:

`'/iframe.html?id=buttoncomponent--primary&knob-text=Click me!&knob-padding&knob-style=default'`

- `buttoncomponent` is a lowercase version of the `Title` in the `*.stories.ts` file.
- `primary` is the name of an individual story.
- `knob-style=default` sets the `style` knob to a value of `default`.

Changing knobs in the url query parameters allows your Cypress tests to test different configurations of your component.

### Example Files

**\*.component.stories.ts file**

```ts
import { text, number } from '@storybook/addon-knobs';
import { ButtonComponent } from './button.component';

export default {
  title: 'ButtonComponent',
};

export const primary = () => ({
  moduleMetadata: {
    imports: [],
  },
  component: ButtonComponent,
  props: {
    text: text('text', 'Click me!'),
    padding: number('padding', 0),
    style: text('style', 'default'),
  },
});
```

**Cypress \*.spec.ts file**

```ts
describe('shared-ui', () => {
  beforeEach(() =>
    cy.visit(
      '/iframe.html?id=buttoncomponent--primary&knob-text=Click me!&knob-padding&knob-style=default'
    )
  );

  it('should render the component', () => {
    cy.get('storybook-trial-button').should('exist');
  });
});
```

### Using Addons

To register an [addon](https://storybook.js.org/addons/) for all storybook instances in your workspace:

1. In `/.storybook/addons.js` add the register import statement.
   ```
   import '@storybook/addon-knobs/register';
   ```
2. If a decorator is required, in each project's `<project-path>/.storybook/config.js` use the `addDecorator` function.

   ```
   import { configure, addDecorator } from '@storybook/angular';
   import { withKnobs } from '@storybook/addon-knobs';

   addDecorator(withKnobs);
   ```

**-- OR --**

To register an [addon](https://storybook.js.org/addons/) for a single storybook instance, go to that project's `.storybook` folder:

1. In `addons.js` add the register import statement.
   ```
   import '@storybook/addon-knobs/register';
   ```
2. If a decorator is required, in `config.js` use the `addDecorator` function.

   ```
   import { configure, addDecorator } from '@storybook/angular';
   import { withKnobs } from '@storybook/addon-knobs';

   addDecorator(withKnobs);
   ```

### More Information

For more on using Storybook, see the [official Storybook documentation](https://storybook.js.org/docs/basics/introduction/).
