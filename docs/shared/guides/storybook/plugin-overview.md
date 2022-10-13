[Storybook](https://storybook.js.org) is a development environment for UI components. It allows you to browse a component library, view the different states of each component, and interactively develop and test components.

This guide will briefly walk you through using Storybook within an Nx workspace.

## Setting Up Storybook

### Add the Storybook plugin

```shell
yarn add --dev @nrwl/storybook
```

## Using Storybook

### Generating Storybook Configuration

You can generate Storybook configuration for an individual project with this command:

```shell
nx g @nrwl/storybook:configuration project-name
```

You can choose to use Storybook for one of the supported frameworks:

- `@storybook/angular`
- `@storybook/react`
- `@storybook/react-native`
- `@storybook/html`
- `@storybook/web-components`
- `@storybook/vue`
- `@storybook/vue3`
- `@storybook/svelte`

Choosing one of these frameworks will have the following effects on your workspace:

1. Nx will install all the required Storybook packages that go with it.

2. Nx will generate a root `.storybook` folder and a project-level `.storybook` folder (located under `libs/your-project/.storybook` or `apps/your-project/.storybook`) containing the essential configuration files for Storybook.

3. If you are working on an Angular, a React or a React Native project (and you choose `@storybook/angular`, `@storybook/react` or `@storybook/react-native`) the Nx generator will also generate stories for all the components in your project.

4. Nx will create new `targets` in your project's `project.json`, called `storybook` and `build-storybook`, containing all the necessary configuration to serve and build Storybook.

5. Nx will generate a new Cypress e2e app for your project (if there isn't one already) to run against the Storybook instance.

### Configure your project using TypeScript

You can choose to configure your project using TypeScript instead of JavaScript. To do that, just add the `--tsConfiguration=true` flag to the above command, like this:

```shell
nx g @nrwl/storybook:configuration project-name --tsConfiguration=true
```

[Here is the Storybook documentation](https://storybook.js.org/docs/react/configure/overview#configure-your-project-with-typescript) if you want to learn more.

### Running Storybook

Serve Storybook using this command:

```shell
nx run project-name:storybook
```

or

```shell
nx storybook project-name
```

### Building Storybook

Build Storybook using this command:

```shell
nx run project-name:build-storybook
```

or

```shell
nx build-storybook project-name
```

### Anatomy of the Storybook setup

When running the Nx Storybook generator, it'll configure the Nx workspace to be able to run Storybook seamlessly. It'll create

- a global Storybook configuration
- a project specific Storybook configuration

The **global** Storybook configuration allows to set addon-ons or custom webpack configuration at a global level that applies to all Storybook's within the Nx workspace. You can find that folder at `.storybook/` at the root of the workspace.

```text
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

The project-specific Storybook configuration is pretty much similar what you would have for a non-Nx setup of Storybook. There's a `.storybook` folder within the project root folder.

```text
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
   ```typescript {% fileName="/.storybook/main.js" %}
   module.exports = {
   stories: [...],
   ...,
   addons: [..., '@storybook/addon-essentials'],
   };
   ```
2. If a decorator is required, in each project's `<project-path>/.storybook/preview.js`, you can export an array called `decorators`.

   ```typescript {% fileName="<project-path>/.storybook/preview.js" %}
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

## More Documentation

You can find dedicated information for React and Angular:

- [Set up Storybook for Angular Projects](/storybook/overview-angular)
- [Set up Storybook for React Projects](/storybook/overview-react)

You can find all Storybook-related Nx documentation [here](/packages#storybook).

For more on using Storybook, see the [official Storybook documentation](https://storybook.js.org/docs/basics/introduction/).

### Migration Scenarios

Here's more information on common migration scenarios for Storybook with Nx. For Storybook specific migrations that are not automatically handled by Nx please refer to the [official Storybook page](https://storybook.js.org/)

- [Upgrading to Storybook 6](/storybook/upgrade-storybook-v6-react)
- [Migrate to the Nrwl React Storybook Preset](/storybook/migrate-webpack-final-react)
