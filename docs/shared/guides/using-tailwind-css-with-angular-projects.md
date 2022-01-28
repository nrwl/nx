# Using Tailwind CSS with Angular projects

The purpose of this guide is to cover how to use and configure [Tailwind CSS](https://tailwindcss.com/) with [Angular](https://angular.io/) projects. It shows the different options available to set it up in existing projects or new projects, and it also contains a set of our recommended setups for using Tailwind CSS in different scenarios that can be found on an Nx workspace.

For an in-depth look on this topic, be sure to check out our blog post [Set up Tailwind CSS with Angular in an Nx workspace](https://medium.com/nrwl/set-up-tailwind-css-with-angular-in-an-nx-workspace-6f039a0f4479).

## Tailwind CSS support by the Nx Angular plugin

The Nx Angular plugin provides support for Tailwind CSS v2 and v3. The support includes the following features:

- A generator called `@nrwl/angular:setup-tailwind` that configures Tailwind CSS in an existing project.
- An option `--add-tailwind` for the `@nrwl/angular:app` generator to create an application with Tailwind CSS pre-configured.
- An option `--add-tailwind` for the `@nrwl/angular:lib` generator to create a library with Tailwind CSS pre-configured. This option can only be used with buildable and publishable libraries.
- Ability to build buildable libraries with Tailwind CSS using the `@nrwl/angular:ng-packagr-lite` executor.
- Ability to build publishable libraries with Tailwind CSS using the `@nrwl/angular:package` executor.

The generation for existing or new projects will perform the following steps:

- Check if the `tailwindcss` package is already installed and if not installed, it will install the necessary packages (`tailwindcss`, `postcss` and `autoprefixer`)
- Create a `tailwind.config.js` file in the project root with the default configuration to get started (specific to the installed version) and set up to scan the content (or purge for v2) of the project's source and its dependencies (using the [`createGlobPatternsForDependencies` utility function](#createglobpatternsfordependencies-utility-function))
- Based on the project type, it will perform the following actions:
  - Applications: update the application styles entry point file located at `apps/app1/src/styles.css` by including the Tailwind CSS base styles
  - Libraries: add the `tailwind.config.js` file path to the `build` target configuration

> **Note**: When Tailwind CSS has not been installed yet, the generator will install Tailwind CSS v3. Only if Tailwind CSS v2 is installed, the generator will use it and generate the configuration accordingly.

> All the examples in this guide will use Tailwind CSS v3, but the guide will work the same for v2. To convert the examples to v2, check the [Tailwind CSS upgrade guide](https://tailwindcss.com/docs/upgrade-guide#migrating-to-the-jit-engine) to understand the differences between the configuration for both versions.

### `createGlobPatternsForDependencies` utility function

When using the Tailwind CSS JIT mode (the only mode available for v3, optional for v2), the configuration will have the glob patterns that Tailwind CSS will scan to identify which utility classes are used in the project and generate the CSS for them. In an Nx workspace is very common for a project to have other projects as dependencies so you need to include the glob patterns for all its dependencies. Doing this manually can be cumbersome. Fortunately, the `createGlobPatternsForDependencies` utility function automates this for us.

The function receives a directory path that is used to identify the project for which the dependencies are going to be identified (therefore it needs to be a directory path within a project). It can also receive an optional glob pattern to append to each dependency source root path to conform the final glob pattern. If the glob pattern is not provided, it will default to `/**/!(*.stories|*.spec).{ts,html}`.

The following is an example of it being used in an application called `app1`:

```javascript
// apps/app1/tailwind.config.js
const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
const { join } = require('path');

module.exports = {
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

In the above, you are invoking the `createGlobPatternsForDependencies` utility function with the `__dirname` of the project root. The utility function will identify the project `app1` and obtain its dependencies from the project graph. It will then create the glob patterns for each dependency and return them as an array. If `app1` were to have `lib1` and `lib2` as dependencies, the utility function will return the following glob patterns:

```javascript
[
  'libs/lib1/src/**/!(*.stories|*.spec).{ts,html}',
  'libs/lib2/src/**/!(*.stories|*.spec).{ts,html}',
];
```

## Generating or adding Tailwind CSS support to Angular projects

### Generate an Angular application with Tailwind CSS pre-configured

To generate an Angular application with Tailwind CSS configured by default, you can use the following command:

```bash
npx nx g @nrwl/angular:app my-app --add-tailwind
```

### Generate an Angular buildable library with Tailwind CSS pre-configured

To generate an Angular buildable library with Tailwind CSS configured by default, you can use the following command:

```bash
npx nx g @nrwl/angular:lib my-lib --buildable --add-tailwind
```

### Generate an Angular publishable library with Tailwind CSS pre-configured

To generate an Angular publishable library with Tailwind CSS configured by default, you can use the following command:

```bash
npx nx g @nrwl/angular:lib my-lib --publishable --importPath=@my-org/my-lib --add-tailwind
```

### Add Tailwind CSS to an existing Angular application, buildable library or publishable library

To add Tailwind CSS to an existing Angular application, buildable library or publishable library, you can use the following command:

```bash
npx nx g @nrwl/angular:setup-tailwind my-project
```

You can see the available options for the above generator in [its docs](/angular/setup-tailwind).

## Tailwind CSS setup scenarios

### Configure Tailwind CSS for an application with non-buildable libraries as dependencies

In workspaces with a single application that's consuming non-buildable libraries (libraries without a `build` target), you only need to configure Tailwind CSS in the application. You can do so by either [generating the application with Tailwind CSS already configured](#generate-an-angular-application-with-tailwind-css-pre-configured) or by [adding Tailwind CSS to an existing application](#add-tailwind-css-to-an-existing-angular-application-buildable-library-or-publishable-library).

In this scenario, the libraries will be processed as part of the application build process and therefore, the application's configuration for Tailwind CSS will be used.

### Configure Tailwind CSS for an application with buildable or publishable libraries as dependencies

In workspaces where an application depends on buildable and/or publishable libraries, the application and those libraries need to share the same Tailwind CSS configuration because the libraries have a `build` target and therefore, they are set to be built on its own. When building the libraries, they need a Tailwind CSS configuration and to avoid inconsistencies, they all (the application and the libraries) need to share the same configuration.

To do so, we recommend using a [Tailwind CSS preset](https://tailwindcss.com/docs/presets) and place it in a shared library.

Create a new folder `libs/tailwind-preset` with a `tailwind.config.js` file in it with your shared configuration:

```javascript
// libs/tailwind-preset/tailwind.config.js
module.exports = {
  theme: {
    colors: {
      primary: {
        light: '#5eead4',
        DEFAULT: '#14b8a6',
        dark: '#0f766e',
      },
      secondary: {
        light: '#bae6fd',
        DEFAULT: '#0ea5e9',
        dark: '#0369a1',
      },
      white: '#ffffff',
      black: '#000000',
    },
    spacing: {
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
    },
  },
  plugins: [],
};
```

> **Note**: The `content` property shouldn't be specified in the preset because its value is not common for multiple projects.

Add the project configuration for the project:

If using the workspace configuration v2:

```json
// angular.json or workspace.json
{
  "version": 2,
  "projects": {
    ...
    "tailwind-preset": "libs/tailwind-preset"
  }
}
```

```json
// libs/tailwind-preset/project.json
{
  "projectType": "library",
  "root": "libs/tailwind-preset",
  "sourceRoot": "libs/tailwind-preset",
  "targets": {},
  "tags": []
}
```

If using the workspace configuration v1:

```json
// angular.json
{
  "version": 1,
  "projects": {
    ...
    "tailwind-preset": {
      "projectType": "library",
      "root": "libs/tailwind-preset",
      "sourceRoot": "libs/tailwind-preset",
      "architect": {},
      "tags": []
    }
  }
}
```

Adjust the application's `tailwind.config.js` file to use the preset and remove the configuration that's already included in the preset:

```javascript
// apps/app1/tailwind.config.js
const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
const { join } = require('path');
const sharedTailwindConfig = require('../../libs/tailwind-preset/tailwind.config');

module.exports = {
  presets: [sharedTailwindConfig],
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
};
```

Do the same with any buildable or publishable library `tailwind.config.js` file:

```javascript
// libs/lib1/tailwind.config.js
const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
const { join } = require('path');
const sharedTailwindConfig = require('../../libs/tailwind-preset/tailwind.config');

module.exports = {
  presets: [sharedTailwindConfig],
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
};
```

If you're using a publishable library, you want to distribute it with a generated CSS that can be used by the consuming applications. To do so, take a look at [this section](#distribute-publishable-libraries-themes).

### Configure Tailwind CSS for multiple applications sharing the same theme

To configure Tailwind CSS for multiple applications sharing the same theme, our recommendation is to also use a Tailwind CSS preset and place it in a shared library. Please refer to [the previous scenario setup](#configure-tailwind-css-for-an-application-with-buildable-or-publishable-libraries-as-dependencies) and do the same configuration. You'll have to use the shared Tailwind CSS preset in the applications sharing the same theme.

### Configure Tailwind CSS for multiple applications with different themes and sharing common buildable or publishable libraries

To configure Tailwind CSS for multiple applications that use different themes and share common buildable or publishable libraries, our recommendation is still to use a Tailwind CSS preset and place it in a shared library. The difference is that instead of using literal CSS values for the configuration values, you would use CSS variables to allow each application to provide different values.

A key aspect in this scenario is that because the same buildable libraries are shared by multiple applications, you need to make sure those libraries use Tailwind CSS utility classes and/or theme keys that are common to all the applications that consume them.

> **Note**: Different applications can still have some extra configuration unique to them, but the unique configuration can't be used by shared libraries, because it's not going to be available for other applications.

> **Note**: As explained in [this section](#configure-tailwind-css-for-an-application-with-non-buildable-libraries-as-dependencies), non-buildable libraries are processed as part of the application build process and therefore, they just use the same configuration the application uses.

Create a new folder `libs/tailwind-preset` with a `tailwind.config.js` file in it with your shared configuration:

```javascript
// libs/tailwind-preset/tailwind.config.js
module.exports = {
  theme: {
    colors: {
      primary: {
        light: 'var(--primary-light)',
        DEFAULT: 'var(--primary)',
        dark: 'var(--primary-dark)',
      },
      secondary: {
        light: 'var(--secondary-light)',
        DEFAULT: 'var(--secondary)',
        dark: 'var(--secondary-dark)',
      },
      white: 'var(--white)',
      black: 'var(--black)',
    },
    spacing: {
      sm: 'var(--spacing-sm)',
      md: 'var(--spacing-md)',
      lg: 'var(--spacing-lg)',
      xl: 'var(--spacing-xl)',
    },
  },
  plugins: [],
};
```

> **Note**: The `content` property shouldn't be specified in the preset because its value is not common for multiple projects.

Add the project configuration for the project:

If using the workspace configuration v2:

```json
// angular.json or workspace.json
{
  "version": 2,
  "projects": {
    ...
    "tailwind-preset": "libs/tailwind-preset"
  }
}
```

```json
// libs/tailwind-preset/project.json
{
  "projectType": "library",
  "root": "libs/tailwind-preset",
  "sourceRoot": "libs/tailwind-preset",
  "targets": {},
  "tags": []
}
```

If using the workspace configuration v1:

```json
// angular.json
{
  "version": 1,
  "projects": {
    ...
    "tailwind-preset": {
      "projectType": "library",
      "root": "libs/tailwind-preset",
      "sourceRoot": "libs/tailwind-preset",
      "architect": {},
      "tags": []
    }
  }
}
```

Adjust the `tailwind.config.js` file of the different applications to use the preset and remove the configuration that's already included in the preset:

```javascript
// apps/app1/tailwind.config.js
// apps/app2/tailwind.config.js
const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
const { join } = require('path');
const sharedTailwindConfig = require('../../libs/tailwind-preset/tailwind.config');

module.exports = {
  presets: [sharedTailwindConfig],
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
};
```

Do the same with any shared buildable or publishable library `tailwind.config.js` file:

```javascript
// libs/lib1/tailwind.config.js
const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
const { join } = require('path');
const sharedTailwindConfig = require('../../libs/tailwind-preset/tailwind.config');

module.exports = {
  presets: [sharedTailwindConfig],
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
};
```

Add the CSS variable values to the different application styles entry point:

```css
/* apps/app1/src/styles.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Colors */
  --primary-light: #5eead4;
  --primary: #14b8a6;
  --primary-dark: #0f766e;
  --secondary-light: #bae6fd;
  --secondary: #0ea5e9;
  --secondary-dark: #0369a1;
  --white: #ffffff;
  --black: #000000;

  /* Spacing */
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
}
```

```css
/* apps/app2/src/styles.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Colors */
  --primary-light: #a5b4fc;
  --primary: #6366f1;
  --primary-dark: #4338ca;
  --secondary-light: #e9d5ff;
  --secondary: #a855f7;
  --secondary-dark: #7e22ce;
  --white: #ffffff;
  --black: #000000;

  /* Spacing */
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 3rem;
}
```

If you're using a publishable library, you want to distribute it with a generated CSS that can be used by the consuming applications. To do so, take a look at [this section](#distribute-publishable-libraries-themes).

### Distribute publishable libraries themes

The purpose of publishable libraries is to distribute them outside of the workspace. As such, they should provide the CSS for their components so they can be used by the applications consuming them.

To build and share a theme, you can create a theme file in the library like the following:

```css
/* libs/lib1/src/styles/my-theme.css */
@tailwind components;
@tailwind utilities;

/* You can omit this if you're not using CSS variables */
:root {
  /* Colors */
  --primary-light: #5eead4;
  --primary: #14b8a6;
  --primary-dark: #0f766e;
  --secondary-light: #bae6fd;
  --secondary: #0ea5e9;
  --secondary-dark: #0369a1;
  --white: #ffffff;
  --black: #000000;

  /* Spacing */
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
}
```

> **Note**: This section assume you've already followed one of the previous sections setup and have the library with Tailwind CSS configured.

Next, you need to configure your project to build the theme when you build the library. Edit the project configuration to have the following targets:

```json
...
"build-angular": {
  "executor": "@nrwl/angular:package",
  "outputs": ["dist/libs/lib1"],
  "options": {
    "project": "libs/lib1/ng-package.json",
    "tailwindConfig": "libs/lib1/tailwind.config.js"
  },
  "configurations": {
    "production": {
      "tsConfig": "libs/lib1/tsconfig.lib.prod.json"
    },
    "development": {
      "tsConfig": "libs/lib1/tsconfig.lib.json"
    }
  },
  "defaultConfiguration": "production"
},
"build-lib": {
  "executor": "@nrwl/workspace:run-commands",
  "outputs": ["dist/libs/lib1"],
  "configurations": {
    "production": {
      "commands": [
        "nx run lib1:build-angular:production",
        "tailwindcss -c libs/lib1/tailwind.config.js -i ./libs/lib1/src/styles/my-theme.css -o ./dist/libs/lib1/themes/my-theme.css -m"
      ]
    },
    "development": {
      "commands": [
        "nx run lib1:build-angular:development",
        "tailwindcss -c libs/lib1/tailwind.config.js -i ./libs/lib1/src/styles/my-theme.css -o ./dist/libs/lib1/themes/my-theme.css"
      ]
    }
  },
  "defaultConfiguration": "production"
},
"build": {
  "executor": "@nrwl/workspace:run-commands",
  "outputs": ["dist/libs/lib1"],
  "configurations": {
    "production": {
      "commands": [
        "rm -rf dist/libs/lib1",
        "nx run lib1:build-lib:production"
      ],
      "parallel": false
    },
    "development": {
      "commands": [
        "rm -rf dist/libs/lib1",
        "nx run lib1:build-lib:development"
      ],
      "parallel": false
    }
  },
  "defaultConfiguration": "production"
},
...
```

In the above, you are configuring the library build and the Tailwind CSS processing to happen in parallel. Also, you are going to disable the automatic deletion of the output folder that `ng-packagr` does because that can cause the theme to be deleted. Instead, you configured the `build` target to delete the output folder and then kick off the library build.

> **Note**: You can have more themes and simply add them to be built in the `build-lib` target commands.

Update the `libs/lib1/ng-package.json` file to set the `deleteDestPath` property to `false`:

```json
{
  ...
  "deleteDestPath": false
}
```

You can now build the library and the theme CSS will be generated in the output folder as expected.

One important thing to keep in mind is that if you use the default Tailwind CSS utility classes and distribute your theme with them, there can be conflicts with consumer applications that also use Tailwind CSS. To avoid this, you have a couple of options:

- Add a unique [prefix](https://tailwindcss.com/docs/configuration#prefix) to your Tailwind CSS utility classes.
- Create unique CSS classes for your components and theme in general using a Tailwind CSS directive like [`@apply`](https://tailwindcss.com/docs/functions-and-directives#apply) or a function like [`theme()`](https://tailwindcss.com/docs/functions-and-directives#theme).

> **Note**: If you decide to use a unique prefix, remember to change the utility classes used in your components to use the prefix.
