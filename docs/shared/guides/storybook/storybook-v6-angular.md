# Upgrading to Storybook 6 (and Nx versions >10.1.x and <14.0.0)

_Disclaimer: From Nx 14.0.0 and on, Nx does not support Storybook v.5. If your workspace is on a version of Nx older than Nx 14, then you will be able to use the generators described in this guide. If you're using Nx >14, then you will already have been automatically migrated to Storybook 6._

Nx now comes with [Storybook version 6](https://storybook.js.org/releases/6.0). Chances are, if you used Nx version `10.1.x` or older with Storybook, you are using [Storybook version 5.3](https://storybook.js.org/releases/5.3) with configuration files of [Storybook version 5.2](https://storybook.js.org/releases/5.2).

Nx version `10.2.x` will continue to support Storybook version `5.2.x`, however newer versions of Nx will only support Storybook version `6` (and on).

When you are running the Nx workspace migration script, your Storybook instances and configurations across your apps and libraries will NOT be migrated automatically. We chose not to migrate your Storybook instances and configurations across your apps and libraries automatically, since there a number of breaking changes that Storybook introduced in versions `5.3` and `6.0`, and making decisions on what to migrate automatically would risk the integrity of your code.

Instead, when you choose to migrate from Nx versions `<10.1.x` to Nx versions `>10.2.x` (using the Nx migration script - `nx migrate`) we will keep your Storybook packages and Storybook instances and configurations intact. We suggest that you do the migration on your own, using the guide below, with all the references to the official Storybook migration guides. Look at the use cases below, and follow the one that matches your case.

## Use Cases

### Use case 1: Create an Nx workspace from scratch using the latest version of Nx

If you are creating an Nx workspace using the latest version of Nx, the latest version of Storybook (version 6) will be used as well. You do not need to do anything.

### Use case 2: I already have an Nx workspace that does NOT use Storybook and I want to migrate to the latest Nx

If you already have an Nx workspace with a previous version of Nx that does NOT use Storybook, and you migrate to the latest Nx using the migrate scripts provided by Nx, and then, after the migration to the latest Nx, you choose to add Storybook, the latest version of Storybook will be used. You do not need to do anything.

### Use case 3: I already have an Nx workspace with Storybook and I want to migrate to the latest Nx

In that case, when you run the Nx migration scripts, the scripts will ignore the Storybook packages, the Storybook configuration files, the Storybook instances in your apps and libraries, and all the generated stories. If you continue to add Storybook configurations and Storybook instances to new libraries and applications, then the version of Storybook that you already have will be used (most probably, if you have not changed anything manually, that version will be `5.3.9` using, however, the configuration files of `5.2`). You will have to do the [upgrade to the latest Storybook on your own, manually](#upgrading-to-storybook-6-manually). After that, Nx will use that version, and configure all new Storybook instances using the new version.

## Upgrading to Storybook 6 using the Nx migration generator

### Some info about the generator

The `@nrwl/angular:storybook-migrate-defaults-5-to-6` generator will not exactly do a migration. It will perform the following actions:

- It will generate new Storybook configuration files using the new (`>6.x`) Storybook way. The way it will do that is, it will look in all the `project.json` files and it will find all the projects that have a `Storybook` configuration. Using the `configFolder` path provided there, it will go and generate new Storybook instances in all these paths. Finally, it will generate a new Storybook instance at the root directory.

- If you choose to `keepOld`, then it will add all your existing Storybook configuration files into another folder labeled `.old_storybook`.

- It will update all the Storybook-related (`@storybook/*`) packages in your `package.json`.

### How to use the generator

That way, you can have working Storybook instances for all your projects just by running

```bash
nx g @nrwl/angular:storybook-migrate-defaults-5-to-6
```

### What if I had made changes to the defaults?

In case you had made customizations to the default Storybook configurations, you can then manually change each of your Storybook instance configuration files using the official [Storybook 6 Migration Guide](https://medium.com/storybookjs/storybook-6-migration-guide-200346241bb5) to make sure you use the new syntax. Your old configuration files are available to you to use as a reference.

Please check out this official [Storybook 6 Migration Guide](https://medium.com/storybookjs/storybook-6-migration-guide-200346241bb5) article, as well as the [detailed guides here](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-53x-to-60x).

### What if I am not ready to change everything at once?

The generator gives you the option to migrate one project at a time. You can provide the `--name=PROJECT_NAME` flag, and then the generator will **only** generate new files for the specified project.

Please note that this option will NOT update all the Storybook-related (`@storybook/*`) packages in your `package.json`, or the root Storybook folder. The reason is that if you want to do the migration gradually, one project at a time, you want your old, existing, projects, to still work. That way, you will still be able to run your old, non-migrated Storybook projects. However, you will not be able to run any migrated Storbook projects. Once you have migrated all your Storybook projects, you can run `nx g @nrwl/angular:storybook-migrate-defaults-5-to-6` once again, and the generator will take care of updating all the Storybook-related (`@storybook/*`) packages in your `package.json` and it will also generate the new Storybook files for the root Storybook directory.

### General tip:

**Commit any changes you have locally**. We would suggest that you start the migration with a clean git history, in case anything goes wrong.

## Upgrading to Storybook 6 manually

There is really no great reason for doing the migration completely manually. The `@nrwl/angular:storybook-migrate-defaults-5-to-6` generator [will take care of Steps 1, 2 and 3](#upgrading-to-storybook-6-using-the-nx-migration-generator). What you will need to do after running the generator is that you have to manually migrate any custom changes you had done to the default Storybook configuration files that were automatically generated by Nx when you first used Nx Storybook. To do the manual migration you should use the official [Storybook 6 Migration Guide](https://medium.com/storybookjs/storybook-6-migration-guide-200346241bb5) article, as well as the [detailed guides here](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-53x-to-60x).

However, if you still want to do everything manually, these are the steps you should follow:

### Step 0:

**Commit any changes you have locally**. We would suggest that you start the migration with a clean git history, in case anything goes wrong.

### Step 1: Changing the configuration files from version 5.2 to 5.3

The most noticeable change in Storybook versions newer than `5.2` is that the configuration files have changed names and content.
Quoting from the [official Storybook migration guide](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-52x-to-53x):

- `presets.js` has been renamed to `main.js`. `main.js` is the main point of configuration for storybook.
- `config.js` has been renamed to `preview.js`. `preview.js` configures the "preview" iframe that renders your components.
- `addons.js` has been renamed to `manager.js`. `manager.js` configures Storybook's "manager" UI that wraps the preview, and also configures addons panel.

Please follow the [official Storybook version 5.2.x to 5.3.x migration guide](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-52x-to-53x) to change your files accordingly.

If you are using Storybook using only the generated files after running the `storybook-configuration` generator, things might be easier for you. Please check the [sample files for a manual upgrade](#sample-files-for-manual-upgrade).

### Step 2: Going from version 5.3 to 6.0

Please check out this official [Storybook 6 Migration Guide](https://medium.com/storybookjs/storybook-6-migration-guide-200346241bb5) article, as well as the [detailed guides here](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-53x-to-60x).

- One big change in Storybook version `6` is that it has **built-in Typescript support**. This means that you can remove Typescript configurations from your configuration files.
- Please also **check that your stories match any differences in syntax** introduced in versions `5.3` and `6.0`.

### Step 3: Upgrade all `@storybook/*` packages in your project

Check your `package.json` file for all `@storybook` packages. Install the latest versions of these, using `yarn`:

For example:

```bash
yarn add --dev @storybook/angular@latest
```

### Step 4: Check that everything works as expected

Check that everything works as expected. If you are still having trouble, you can submit you issue in the [GitHub Nx repo](https://github.com/nrwl/nx). We wish you luck!

## Sample files for manual upgrade

If you have not changed the content of the files which the `storybook-configuration` generator produced, you can use the following samples to migrate to Storybook `6`:

### Configuring the root `./storybook` directory

- In the root `./storybook` directory, create a new file named `main.js` with the following content:

```typescript
module.exports = {
  stories: [],
  addons: ['@storybook/addon-essentials'],
};
```

- If you have any addons in the `addons.js` file, add them in the `addons` array in the `main.js` file. If you are using the default generated files without any changes, you should not have any addons. You can now delete the `addons.js` file.

- The other two files remain unchanged.

### Configuring the Storybook instances across apps and libraries - the library-specific `./storybook` directories

- In the library `./storybook` directory, create a new file named `main.js` with the following content:

```typescript
const lib_main_module = require('../../.storybook/main');

lib_main_module.stories.push('../src/lib/**/*.stories.mdx');
lib_main_module.stories.push('../src/lib/**/*.stories.@(js|jsx|ts|tsx)');
module.exports = lib_main_module;
```

Please take extra care making sure that the path to the root `./storybook` directory provided in the first line is correct.

- If you have any addons in the `addons.js` file, add them in the `addons` array in the `main.js` file. You can add any addons in the `addons` module array using the following syntax:

```typescript
lib_main_module.addons.push('<YOUR_ADDON_HERE>');
```

After you add any addons in the `main.js` file, you can safely delete the `addons.js` file. If you are using the default generated files without any changes, your `addons.js` file should be empty (but an import line, referencing the root `addons.js` file).

- Rename the file `config.js` to `preview.js` and remove the last line where your stories paths are configured. Now, the contents of the `preview.js` file will look like this:

```typescript
import { addDecorator } from '@storybook/angular';
import { YourDecorator } from '@storybook/<something>';

addDecorator(YourDecorator);
```

- Modify the contents of `webpack.config.js`. Remove the following lines, which are the TypeScript configuration, which is not needed by Storybook any more:

```typescript
config.resolve.extensions.push('.ts', '.tsx');
config.module.rules.push({
  test: /\.(ts|tsx)$/,
  loader: require.resolve('babel-loader'),
  options: {
    presets: [
      '@babel/preset-env',
      '@babel/preset-react',
      '@babel/preset-typescript',
    ],
  },
});
```

### Check final folder structure

Your folder structure should now look like this:

```treeview
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
