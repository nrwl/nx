# Storybook

![Storybook logo](/shared/storybook-logo.png)

Storybook is a development environment for UI components. It allows you to browse a component library, view the different states of each component, and interactively develop and test components.

This guide will briefly walk you through using Storybook within an Nx workspace.

## Setting Up Storybook

### Add the Storybook plugin

```bash
yarn add --dev @nrwl/storybook
```

## Using Storybook

### Generating Storybook Configuration

You can generate Storybook configuration for an individual project with this command:

```bash
nx g @nrwl/angular:storybook-configuration project-name
```

### Running Storybook

Serve Storybook using this command:

```bash
nx run project-name:storybook
```

### Anatomy of the Storybook setup

When running the Nx Storybook generator, it'll configure the Nx workspace to be able to run Storybook seamlessly. It'll create

- a global Storybook configuration
- a project specific Storybook configuration

The **global** Storybook configuration allows to set addon-ons or custom webpack configuration at a global level that applies to all Storybook's within the Nx workspace. You can find that folder at `.storybook/` at the root of the workspace.

```treeview
<workspace name>/
├── .storybook/
│   ├── main.js
│   ├── tsconfig.json
├── apps/
├── libs/
├── nx.json
├── package.json
├── README.md
└── etc...
```

The project-specific Storybook configuration is pretty much similar to what you would have for a non-Nx setup of Storybook. There's a `.storybook` folder within the project root folder.

```treeview
<project root>/
├── .storybook/
│   ├── main.js
│   ├── preview.js
│   ├── tsconfig.json
├── src/
├── README.md
├── tsconfig.json
└── etc...
```

### Using Addons

To register a [Storybook addon](https://storybook.js.org/addons/) for all storybook instances in your workspace:

1. In `/.storybook/main.js`, in the `addons` array of the `module.exports` object, add the new addon:
   ```typescript
   module.exports = {
   stories: [...],
   ...,
   addons: [..., '@storybook/addon-essentials'],
   };
   ```
2. If a decorator is required, in each project's `<project-path>/.storybook/preview.js`, you can export an array called `decorators`.

   ```typescript
   import someDecorator from 'some-storybook-addon';
   export const decorators = [someDecorator];
   ```

**-- OR --**

To register an [addon](https://storybook.js.org/addons/) for a single storybook instance, go to that project's `.storybook` folder:

1. In `main.js`, in the `addons` array of the `module.exports` object, add the new addon:
   ```typescript
   module.exports = {
   stories: [...],
   ...,
   addons: [..., '@storybook/addon-essentials'],
   };
   ```
2. If a decorator is required, in `preview.js` you can export an array called `decorators`.

   ```typescript
   import someDecorator from 'some-storybook-addon';
   export const decorators = [someDecorator];
   ```

### Auto-generate Stories

The `@nrwl/angular:storybook-configuration` generator has the option to automatically generate `*.stories.ts` files for each component declared in the library.

```treeview
<some-folder>/
├── my.component.ts
└── my.component.stories.ts
```

You can re-run it at a later point using the following command:

```bash
nx g @nrwl/angular:stories <project-name>
```

### Cypress tests for Stories

Both `storybook-configuration` generator gives the option to set up an e2e Cypress app that is configured to run against the project's Storybook instance.

To launch Storybook and run the Cypress tests against the iframe inside of Storybook:

```bash
nx run project-name-e2e:e2e
```

The url that Cypress points to should look like this:

`'/iframe.html?id=buttoncomponent--primary&args=text:Click+me!;padding;style:default'`

- `buttoncomponent` is a lowercase version of the `Title` in the `*.stories.ts` file.
- `primary` is the name of an individual story.
- `style=default` sets the `style` arg to a value of `default`.

Changing args in the url query parameters allows your Cypress tests to test different configurations of your component. You can [read the documentation](https://storybook.js.org/docs/angular/writing-stories/args#setting-args-through-the-url) for more information.

### Example Files

**\*.component.stories.ts file**

```typescript
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

**Cypress \*.spec.ts file**

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

### Setting up `projectBuildConfig`

Storybook for Angular needs a default project specified in order to run. The reason is that it uses that default project to read the build configuration from (paths to files to include in the build, and other configurations/settings). In Nx workspaces, that project is specified with the `projectBuildConfig` property.

If you're using Nx version `>=13.4.6` either in a new Nx workspace, or you migrated your older Nx workspace to Nx version `>=13.4.6`, Nx will automatically add the `projectBuildConfig` property in your projects `project.json` files, for projects that are using Storybook. It will look like this:

```json
    "storybook": {
      "executor": "@nrwl/storybook:storybook",
      "options": {
         ...
        "projectBuildConfig": "my-project:build-storybook"
      },
      ...
    },
    "build-storybook": {
      "executor": "@nrwl/storybook:build",
       ...
      "options": {
         ...
        "projectBuildConfig": "my-project:build-storybook"
      },
     ...
    }
```

This setup instructs Nx to use the configuration under the `build-storybook` target of `my-project` when using the `storybook` and `build-storybook` executors.

If the `projectBuildConfig` is not set in your `project.json`, you can manually set it up in one of the following ways:

#### Adding the `projectBuildConfig` option directly in the project's `project.json`

In your project's `project.json` file find the `storybook` and `build-storybook` targets. Add the `projectBuildConfig` property under the `options` as shown above.

After you add this property, you can run your `storybook` and `build-storybook` executors as normal:

```bash
nx storybook my-project
```

and

```bash
nx build-storybook my-project
```

#### Using the `projectBuildConfig` flag on the executors

The way you would run your `storybook` and your `build-storybook` executors would be:

```bash
nx storybook my-project --projectBuildConfig=my-project:build-storybook
```

and

```bash
nx build-storybook my-project --projectBuildConfig=my-project:build-storybook
```

**Note:** If your project is buildable (eg. any project that has a `build` target set up in its `project.json`) you can also do `nx storybook my-project --projectBuildConfig=my-project`.

> In a pure Angular/Storybook setup (**not** an Nx workspace), the Angular application/project would have an `angular.json` file. That file would have a property called `defaultProject`. In an Nx workspace the `defaultProject` property would be specified in the `nx.json` file. Previously, Nx would try to resolve the `defaultProject` of the workspace, and use the build configuration of that project. In most cases, the `defaultProject`'s build configuration would not work for some other project set up with Storybook, since there would most probably be mismatches in paths or other project-specific options.

### Configuring styles and preprocessor options

Angular supports including extra entry-point files for styles. Also, in case you use Sass, you can add extra base paths that will be checked for imports. In your project's `project.json` file you can use the `styles` and `stylePreprocessorOptions` properties in your `storybook` and `build-storybook` target `options`, as you would in your Storybook or your Angular configurations. Check out the [Angular Workspace Configuration](https://angular.io/guide/workspace-config#styles-and-scripts-configuration) documentation for more information.

```json
    "storybook": {
      "executor": "@nrwl/storybook:storybook",
      "options": {
         ...
        "styles": ["some-styles.css"],
        "stylePreprocessorOptions": {
          "includePaths": ["some-style-paths"]
        }
      },
      ...
    },
    "build-storybook": {
      "executor": "@nrwl/storybook:build",
       ...
      "options": {
         ...
        "styles": ["some-styles.css"],
        "stylePreprocessorOptions": {
          "includePaths": ["some-style-paths"]
        }
      },
     ...
    }
```

## More Documentation

For more on using Storybook, see the [official Storybook documentation](https://storybook.js.org/docs/basics/introduction/).

### Migration Scenarios

Here's more information on common migration scenarios for Storybook with Nx. For Storybook specific migrations that are not automatically handled by Nx please refer to the [official Storybook page](https://storybook.js.org/)

- [Upgrading to Storybook 6](/storybook/upgrade-storybook-v6-angular)
- [Migrate to the new Storybook `webpackFinal` config](/storybook/migrate-webpack-final-angular)
