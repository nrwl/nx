# Using Tailwind CSS in React and Next.js

This guide serves as a quickstart to installing [Tailwind CSS](https://tailwindcss.com) in your React and Next.js app.

For more in-depth look on this topic, be sure to check out our blog post on [Setting up Next.js to use Tailwind with Nx](https://blog.nrwl.io/setup-next-js-to-use-tailwind-with-nx-849b7e21d8d0).

## Automated Setup

The easiest way to set up Tailwind is using the `@nx/react:setup-tailwind` generator.

```shell
nx g @nx/react:setup-tailwind --project=<your app here>
```

This generator will install the necessary dependencies and add `postcss.config.js` and `tailwind.config.js` files.

You will now be able to use Tailwind class names and utilities in your app. For example,

```jsx
function Hello() {
  return <div className="bg-indigo-500 p-2 font-mono">Hello!</div>;
}
```

If you are having issues with the generator, or want to perform the steps manually, then follow the instructions in the next section.

## Manual Setup Instructions

These manual steps are not required if you use the generator from the previous section.

### Step 1: Install Tailwind Dependencies

```shell
npm install -D tailwindcss@latest postcss@latest autoprefixer@latest

# or with yarn
yarn add -D tailwindcss@latest postcss@latest autoprefixer@latest
```

This installs the requisite tailwind dependencies.

### Step 2: Initialize Tailwind

The simplest way to initialize Tailwind is to use their CLI.

```shell
cd {path to your app}
npx tailwindcss init -p
```

This creates the required files with a general boilerplate implementation.

#### Pointing PostCSS to Tailwind Config

Next, adjust the `postcss.config.js` as follows:

```javascript {% fileName="postcss.config.js" %}
const { join } = require('path');

module.exports = {
  plugins: {
    tailwindcss: {
      config: join(__dirname, 'tailwind.config.js'),
    },
    autoprefixer: {},
  },
};
```

#### Introducing Nx Utility for Better Tailwind Purging

One of the advantages of Tailwind is that it post-processes your CSS removing (also called "purging") all the parts that are not being used. In order to configure which file should be processed, the `tailwind.config.js` has a `content` property (formerly called `purge` in v2). You can find more details on Tailwind's [official documentation](https://tailwindcss.com/docs/content-configuration#configuring-source-paths).

The `content` property usually consists of a glob pattern to include all the necessary files that should be processed. In a Nx workspace it is very common for a project to have other projects as its dependencies. Setting and updating the glob to reflect those dependencies and their files is cumbersome and error-prone.

Nx has a utility function that can be used to construct the glob representation of all files a project depends on (based on the Nx Project Graph).

The function receives a directory path that is used to identify the project for which the dependencies are going to be identified (therefore it needs to be a directory path within a project). It can also receive an optional glob pattern to append to each dependency source root path to conform the final glob pattern. If the glob pattern is not provided, it will default to `/**/!(*.stories|*.spec).{ts,html}`.

```javascript {% fileName="apps/app1/tailwind.config.js" %}
const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

module.exports = {
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'
    ),
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
  'libs/lib1/src/**/!(*.stories|*.spec).{ts,tsx,html}',
  'libs/lib2/src/**/!(*.stories|*.spec).{ts,tsx,html}',
];
```

### Step 3: Import Tailwind CSS Styles

Next, import tailwind styles to the application's base `styles.css` or `styles.scss` file. This can be done by adding the following lines:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 4: Applying configuration to libraries

Lastly, let's update the application's project configuration to point to the `postcss.config.js` file that we created in [step 2](#step-2:-initialize-tailwind).

Open up the `apps/{your app here}/project.json` file and add the following to the build target.

```json lines {% fileName="apps/{your app here}/project.json" %}
{
  // ...
  "targets": {
    "build": {
      "executor": "@nx/web:webpack",
      "options": {
        // ...
        "postcssConfig": "apps/{your app here}/postcss.config.js"
      }
    }
  }
  // ...
}
```

By specifying the `postcssConfig` option, the PostCSS and Tailwind configuration will be applied to all libraries used by the application as well.

{% callout type="note" title="Using library-specific configuration files" %}
If your libraries have their own `postcss.config.js` and `tailwind.config.js` files then you should not use the `postcssConfig` option. Doing so will ignore the library-specific configuration and apply the application's configuration to everything.
{%/ callout %}
