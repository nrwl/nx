# Using Tailwind CSS with Angular projects

The purpose of this page is to cover how to use and configure [Tailwind CSS](https://tailwindcss.com/)
with [Angular](https://angular.io/) projects. It shows the different options available to set it up in existing projects
or new projects, and it also contains a set of our recommended setups for using Tailwind CSS in different scenarios that
can be found on an Nx workspace.

For an in-depth look on this topic, be sure to check out our blog
post [Set up Tailwind CSS with Angular in an Nx workspace](https://medium.com/nrwl/set-up-tailwind-css-with-angular-in-an-nx-workspace-6f039a0f4479).

## Generating or adding Tailwind CSS support to Angular projects

To generate an Angular application with Tailwind CSS configured run:

```shell
npx nx g @nx/angular:app my-app --add-tailwind
```

To generate an Angular buildable library with Tailwind CSS configured run:

```shell
npx nx g @nx/angular:lib my-lib --buildable --add-tailwind
```

To generate an Angular publishable library with Tailwind CSS configured run:

```shell
npx nx g @nx/angular:lib my-lib --publishable --importPath=@my-org/my-lib --add-tailwind
```

To add Tailwind CSS to an existing Angular application, buildable library or publishable library, run:

```shell
npx nx g @nx/angular:setup-tailwind my-project
```

You can see the available options for the above generator in [its docs](/packages/angular/generators/setup-tailwind).

## Configuring the content sources for a project and its dependencies

Tailwind CSS scans files looking for class names to generate only the CSS needed by what's being used in those files.
To configure which files should be processed, the `tailwind.config.js` has a `content` property (formerly called `purge`
in v2). You can find more details on Tailwind's
[official documentation](https://tailwindcss.com/docs/content-configuration#configuring-source-paths).

The `content` property usually consists of a glob pattern to include all the necessary files that should be processed.
In an Nx workspace it is very common for a project to have other projects as its dependencies. Setting and updating the
glob to reflect those dependencies and their files is cumbersome and error prone.

Nx has a utility function (`createGlobPatternsForDependencies`) that can be used to construct the glob representation of
all files a project depends on (based on the Nx Project Graph).

The function receives a directory path that is used to identify the project for which the dependencies are going to be
identified (therefore it needs to be a directory path within a project). It can also receive an optional glob pattern to
append to each dependency source root path to conform the final glob pattern. If the glob pattern is not provided, it
will default to `/**/!(*.stories|*.spec).{ts,html}`.

The following is an example of it being used in an application called `app1`:

```javascript {% fileName="apps/app1/tailwind.config.js" %}
const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
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

In the above, you are invoking the `createGlobPatternsForDependencies` utility function with the `__dirname` of the
project root. The utility function will identify the project `app1` and obtain its dependencies from the project graph.
It will then create the glob patterns for each dependency and return them as an array. If `app1` were to have `lib1`
and `lib2` as dependencies, the utility function will return the following glob patterns:

```javascript
[
  'libs/lib1/src/**/!(*.stories|*.spec).{ts,html}',
  'libs/lib2/src/**/!(*.stories|*.spec).{ts,html}',
];
```

{% callout type="note" title="Usage with Module Federation" %}
When using Tailwind with Module Federation, Tailwind starts scanning files at the host application, and only includes direct
dependencies of that application. As the other applications in the Module Federation are not direct dependencies, but
rather runtime dependencies, this can lead to missing classes from being included in your generated Tailwind css file.

This can be fixed in two manners:

1. Add an implicit dependency between the host application and the remote applications. This is beneficial because when
   you make a change to the remote application, the host will know to rebuild to allow Tailwind to find any new Tailwind
   classes to include.
2. Add a path to the `content` array to include the remote application and its dependencies. This means that when the
   host is rebuilt it will search for new Tailwind classes to include. It will not mark the host application as affected
   when you change a remote application, however, so you need to be more proactive on rebuilding the host application.

{% /callout %}

## Tailwind CSS setup scenarios

### Configure Tailwind CSS for an application with non-buildable libraries as dependencies

In workspaces with a single application that's consuming non-buildable libraries (libraries without a `build` target),
you only need to configure Tailwind CSS in the application. You can do so by either generating the application with
Tailwind CSS already configured or by adding Tailwind CSS to an existing application as shown in a
[previous section](#generating-or-adding-tailwind-css-support-to-angular-projects).

In this scenario, the libraries will be processed as part of the application build process and therefore, the
application's configuration for Tailwind CSS will be used.

### Configure Tailwind CSS for an application with buildable or publishable libraries as dependencies

In workspaces where an application depends on buildable and/or publishable libraries, the application and those
libraries need to share the same Tailwind CSS configuration because the libraries have a `build` target and therefore,
they are set to be built on its own. When building the libraries, they need a Tailwind CSS configuration and to avoid
inconsistencies, they all (the application and the libraries) need to share the same configuration.

To do so, we recommend using a [Tailwind CSS preset](https://tailwindcss.com/docs/presets) and place it in a shared
library.

Create a new folder `libs/tailwind-preset` with a `tailwind.config.js` file in it with your shared configuration:

```javascript {% fileName="libs/tailwind-preset/tailwind.config.js" %}
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

{% callout type="note" title="More details" %}
The `content` property shouldn't be specified in the preset because its value is not common for multiple projects.
{% /callout %}

Add the project configuration for the project:

```jsonc {% fileName="libs/tailwind-preset/project.json" %}
{
  "projectType": "library",
  "sourceRoot": "libs/tailwind-preset",
  "targets": {},
  "tags": []
}
```

Adjust the application's `tailwind.config.js` file to use the preset and remove the configuration that's already
included in the preset:

```javascript {% fileName="apps/app1/tailwind.config.js" %}
const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
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

```javascript {% fileName="libs/lib1/tailwind.config.js" %}
const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
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

If you're using a publishable library, you want to distribute it with a generated CSS that can be used by the consuming
applications. To do so, take a look at [this section](#distribute-publishable-libraries-themes).

### Configure Tailwind CSS for multiple applications sharing the same theme

To configure Tailwind CSS for multiple applications sharing the same theme, our recommendation is to also use a Tailwind
CSS preset and place it in a shared library. Please refer
to [the previous scenario setup](#configure-tailwind-css-for-an-application-with-buildable-or-publishable-libraries-as-dependencies)
and do the same configuration. You'll have to use the shared Tailwind CSS preset in the applications sharing the same
theme.

### Configure Tailwind CSS for multiple applications with different themes and sharing common buildable or publishable libraries

To configure Tailwind CSS for multiple applications that use different themes and share common buildable or publishable
libraries, our recommendation is still to use a Tailwind CSS preset and place it in a shared library. The difference is
that instead of using literal CSS values for the configuration values, you would use CSS variables to allow each
application to provide different values.

A key aspect in this scenario is that because the same buildable libraries are shared by multiple applications, you need
to make sure those libraries use Tailwind CSS utility classes and/or theme keys that are common to all the applications
that consume them.

{% callout type="note" title="Configuration" %}
Different applications can still have some extra configuration unique to them, but the unique configuration can't be
used by shared libraries, because it's not going to be available for other applications.
{% /callout %}

{% callout type="note" title="Non buildable libraries" %}
As explained in [this section](#configure-tailwind-css-for-an-application-with-non-buildable-libraries-as-dependencies),
non-buildable libraries are processed as part of the application build process and therefore, they just use the same
configuration the application uses.
{% /callout %}

Create a new folder `libs/tailwind-preset` with a `tailwind.config.js` file in it with your shared configuration:

```javascript {% fileName="libs/tailwind-preset/tailwind.config.js" %}
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

> **Note**: The `content` property shouldn't be specified in the preset because its value is not common for multiple
> projects.

Add the project configuration for the project:

```json {% fileName="libs/tailwind-preset/project.json" %}
{
  "projectType": "library",
  "sourceRoot": "libs/tailwind-preset",
  "targets": {},
  "tags": []
}
```

Adjust the `tailwind.config.js` file of the different applications to use the preset and remove the configuration that's
already included in the preset:

```javascript {% fileName="apps/app1/tailwind.config.js" %}
const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
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

```javascript {% fileName="apps/app2/tailwind.config.js" %}
const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
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

```javascript {% fileName="libs/lib1/tailwind.config.js" %}
const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
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

```css {% fileName="apps/app1/src/styles.css" %}
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

```css {% fileName="apps/app2/src/styles.css" %}
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

If you're using a publishable library, you want to distribute it with a generated CSS that can be used by the consuming
applications. To do so, take a look at [the next section](#distribute-publishable-libraries-themes).

### Distribute publishable libraries themes

The purpose of publishable libraries is to distribute them outside of the workspace. As such, they should provide the
CSS for their components so they can be used by the applications consuming them.

To build and share a theme, you can create a theme file in the library like the following:

```css {% fileName="libs/lib1/src/styles/my-theme.css" %}
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

{% callout type="note" title="More details" %}
This section assume you've already followed one of the previous sections setup and have the library with Tailwind CSS
configured.
{% /callout %}

Next, you need to configure your project to build the theme when you build the library. Edit the project configuration
to have the following targets:

```jsonc {% fileName="libs/lib1/project.json" %}
...
"build-angular": {
  "executor": "@nx/angular:package",
  "outputs": ["{workspaceRoot}/dist/libs/lib1"],
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
  "executor": "nx:run-commands",
  "outputs": ["{workspaceRoot}/dist/libs/lib1"],
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
  "executor": "nx:run-commands",
  "outputs": ["{workspaceRoot}/dist/libs/lib1"],
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

In the above, you are configuring the library build and the Tailwind CSS processing to happen in parallel. Also, you are
going to disable the automatic deletion of the output folder that `ng-packagr` does because that can cause the theme to
be deleted. Instead, you configured the `build` target to delete the output folder and then kick off the library build.

{% callout type="note" title="Need more?" %}
You can have more themes and simply add them to be built in the `build-lib` target commands.
{% /callout %}

Update the `libs/lib1/ng-package.json` file to set the `deleteDestPath` property to `false`:

```jsonc {% fileName="libs/lib1/ng-package.json" %}
{
  ...
  "deleteDestPath": false
}
```

You can now build the library and the theme CSS will be generated in the output folder as expected.

One important thing to keep in mind is that if you use the default Tailwind CSS utility classes and distribute your
theme with them, there can be conflicts with consumer applications that also use Tailwind CSS. To avoid this, you have a
couple of options:

- Add a unique [prefix](https://tailwindcss.com/docs/configuration#prefix) to your Tailwind CSS utility classes.
- Create unique CSS classes for your components and theme in general using a Tailwind CSS directive
  like [`@apply`](https://tailwindcss.com/docs/functions-and-directives#apply) or a function
  like [`theme()`](https://tailwindcss.com/docs/functions-and-directives#theme).

{% callout type="note" title="Prefix" %}
If you decide to use a unique prefix, remember to change the utility classes used in your components to use the prefix.
{% /callout %}
