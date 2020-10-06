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
nx g @nrwl/react:storybook-configuration project-name
```

If there's no `.storybook` folder at the root of the workspace, one is created.

```treeview
<workspace name>/
├── .storybook/
│   ├── main.js
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
│   ├── main.js
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

**\*.stories.tsx file**

```ts
import React from 'react';
import { text, number } from '@storybook/addon-knobs';
import { Button } from './button';

export default { title: 'Button' };

export const primary = () => (
  <Button padding={number('Padding', 0)} text={text('Text', 'Click me')} />
);
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

1. In `/.storybook/main.js`, in the `addons` array of the `module.exports` object, add the new addon:
   ```
   module.exports = {
   stories: [...],
   ...,
   addons: [..., '@storybook/addon-knobs/register'],
   };
   ```
2. If a decorator is required, in each project's `<project-path>/.storybook/preview.js` use the `addDecorator` function.

   ```
   import { configure, addDecorator } from '@storybook/angular';
   import { withKnobs } from '@storybook/addon-knobs';

   addDecorator(withKnobs);
   ```

**-- OR --**

To register an [addon](https://storybook.js.org/addons/) for a single storybook instance, go to that project's `.storybook` folder:

1. In `main.js`, in the `addons` array of the `module.exports` object, add the new addon:
   ```
   module.exports = {
   stories: [...],
   ...,
   addons: [..., '@storybook/addon-knobs/register'],
   };
   ```
2. If a decorator is required, in `preview.js` use the `addDecorator` function.

   ```
   import { configure, addDecorator } from '@storybook/angular';
   import { withKnobs } from '@storybook/addon-knobs';

   addDecorator(withKnobs);
   ```

### More Information

For more on using Storybook, see the [official Storybook documentation](https://storybook.js.org/docs/basics/introduction/).

## Upgrading to Storybook 6 (and Nx versions >10.1.x)

Nx now comes with [Storybook version 6](https://storybook.js.org/releases/6.0). Chances are, if you used Nx version `10.1.x` or older with Storybook, you are using [Storybook version 5.3](https://storybook.js.org/releases/5.3) with configuration files of [Storybook version 5.2](https://storybook.js.org/releases/5.2).

Nx version `10.2.x` will continue to support Storybook version `5.2.x`, however newer versions of Nx will only support Storybook version `6` (and on).

We chose not to provide an automatic migration script for your Storybook instances and configurations across your apps and libraries, since there a number of breaking changes that Storybook introduced in versions `5.3` and `6.0`, and making decisions on what to migrate automatically would risk the integrity of your code. Instead, when you choose to migrate from Nx versions `<10.1.x` to Nx versions `>10.2.x` we will keep your Storybook packages and Storybook instances and configurations intact. We suggest that you do the migration on your own, manually, using the guide below, with all the references to the official Storybook migration guides. Look at the use cases below, and follow the one that matches your case.

### Use cases:

#### Use case 1: Create an Nx workspace from scratch using the latest version of Nx

If you are creating an Nx workspace using the latest version of Nx, the latest version of Storybook (version 6) will be used as well. You do not need to do anything.

#### Use case 2: I already have an Nx workspace that does NOT use Storybook and I want to migrate to the latest Nx

If you already have an Nx workspace with a previous version of Nx that does NOT use Storybook, and you migrate to the latest Nx using the migrate scripts provided by Nx, and then, after the migration to the latest Nx, you choose to add Storybook, the latest version of Storybook will be used. You do not need to do anything.

#### Use case 3: I already have an Nx workspace with Storybook and I want to migrate to the latest Nx

In that case, when you run the Nx migration scripts, the scripts will ignore the Storybook packages, the Storybook configuration files, the Storybook instances in your apps and libraries, and all the generated stories. If you continue to add Storybook configurations and Storybook instances to new libraries and applications, then the version of Storybook that you already have will be used (most probably, if you have not changed anything manually, that version will be `5.3.9` using, however, the configuration files of `5.2`). You will have to do the [upgrade to the latest Storybook on your own, manually](#upgrading-to-storybook-6-manually). After that, Nx will use that version, and configure all new Storybook instances using the new version.

### Upgrading to Storybook 6 manually

#### Step 0:

**Commit any changes you have locally**. We would suggest that you start the migration with a clean git history, in case anything goes wrong.

#### Step 1: Changing the configuration files from version 5.2 to 5.3

The most noticeable change in Storybook versions newer than `5.2` is that the configuration files have changed names and content.
Quoting from the [official Storybook migration guide](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-52x-to-53x):

- `presets.js` has been renamed to `main.js`. `main.js` is the main point of configuration for storybook.
- `config.js` has been renamed to `preview.js`. `preview.js` configures the "preview" iframe that renders your components.
- `addons.js` has been renamed to `manager.js`. `manager.js` configures Storybook's "manager" UI that wraps the preview, and also configures addons panel.

Please follow the [official Storybook version 5.2.x to 5.3.x migration guide](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-52x-to-53x) to change your files accordingly.

#### Step 2: Going from version 5.3 to 6.0

Please check out this official [Storybook 6 Migration Guide](https://medium.com/storybookjs/storybook-6-migration-guide-200346241bb5) article, as well as the [detailed guides here](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-53x-to-60x).

- One big change in Storybook version `6` is that it has **built-in Typescript support**. This means that you can remove Typescript configurations from your configuration files.
- Please also **check that your stories match any differences in syntax** introduced in versions `5.3` and `6.0`.

#### Step 3: Upgrade all `@storybook/*` packages in your project

Check your `package.json` file for all `@storybook` packages. Install the latest versions of these, usign `yarn`:

For example:

```
yarn add --dev @storybook/react@latest
```

#### Step 4: Check that everything works as expected

Check that everything works as expected. If you are still having trouble, you can submit you issue in the [GitHub Nx repo](https://github.com/nrwl/nx). We wish you luck!

### Sample files for manual upgrade

If you have not changed the content of the files which the `storybook-configuration` schematic produced, you can use the following samples to migrate to Storybook `6`:

#### Configuring the root `./storybook` directory

- In the root `./storybook` directory, create a new file named `main.js` with the following content:

```
module.exports = {
  stories: [],
  addons: ['@storybook/addon-knobs/register'],
};
```

- If you have any addons in the `addons.js` file, add them in the `addons` array in the `main.js` file. If you are using the default generated files without any changes, you should only have the `@storybook/addon-knobs/register` addon, which we already put in the array. You can now delete the `addons.js` file.

- The other two files remain unchanged.

#### Configuring the Storybook instances across apps and libraries - the library-specific `./storybook` directories

- In the library `./storybook` directory, create a new file named `main.js` with the following content:

```
const lib_main_module = require('../../.storybook/main');

lib_main_module.stories.push('../src/lib/**/*.stories.mdx');
lib_main_module.stories.push('../src/lib/**/*.stories.@(js|jsx|ts|tsx)');
module.exports = lib_main_module;
```

Please take extra care making sure that the path to the root `./storybook` directory provided in the first line is correct.

- If you have any addons in the `addons.js` file, add them in the `addons` array in the `main.js` file. You can add any addons in the `addons` module array using the following syntax:

```
lib_main_module.addons.push('<YOUR_ADDON_HERE>');
```

After you add any addons in the `main.js` file, you can safely delete the `addons.js` file. If you are using the default generated files without any changes, your `addons.js` file should be empty (but an import line, referencing the root `addons.js` file).

- Rename the file `config.js` to `preview.js` and remove the last line where your stories paths are configured. Now, the contents of the `preview.js` file will look like this:

```
import { addDecorator } from '<%= uiFramework %>';
import { withKnobs } from '@storybook/addon-knobs';

addDecorator(withKnobs);
```

- Modify the contents of `webpack.config.js`. Remove the following lines, which are the TypeScript configuration, which is not needed by Storybook any more:

```
  config.resolve.extensions.push('.ts', '.tsx');
  config.module.rules.push({
    test: /\.(ts|tsx)$/,
    loader: require.resolve('babel-loader'),
    options: {
      presets: [
        '@babel/preset-env',
        '@babel/preset-react',
        '@babel/preset-typescript'
      ]
    }
  });
```

#### Check final folder structure

Your folder structure should now look like this:

```
<workspace name>/
├── .storybook/
│   ├── main.js
│   ├── tsconfig.json
│   └── webpack.config.js
├── apps/
├── libs/
│    └── <library name>/
│       ├── .storybook/
│       │   ├── main.js
│       │   ├── tsconfig.json
│       │   └── webpack.config.js
│       ├── src/
│       ├── README.md
│       ├── tsconfig.json
│       └── etc...
├── nx.json
├── package.json
├── README.md
└── etc...
```

### Storybook v6 args and controls

Storybook v6 moves from "knobs" to args and controls when it comes to defining and manipulating your storybook
component properties. Feel free to use the new args way of defining stories. More can be found
[on the official Storybook docs](https://storybook.js.org/docs/react/writing-stories/args).

> **Note:** Nx does not yet automatically generate stories that use the args syntax. The main reason is that args don't
> yet support being loaded via the iframe URL which is used in Nx to setup your Storybook based e2e tests. Once support
> is present in Storybook v6, we will provide a way to generate args & controls based stories. More on the progress [here](https://github.com/storybookjs/storybook/issues/12291).
