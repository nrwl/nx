# Using Tailwind CSS in React and Next.js

This guide serves as a quickstart to installing [Tailwind CSS](https://tailwindcss.com) in your React and Next.js app.

For more in-depth look on this topic, be sure to check out our blog post on [Setting up Next.js to use Tailwind with Nx](https://blog.nrwl.io/setup-next-js-to-use-tailwind-with-nx-849b7e21d8d0).

## Step 1: Install Tailwind Dependencies

```bash
npm install -D tailwindcss@latest postcss@latest autoprefixer@latest

# or with yarn
yarn add -D tailwindcss@latest postcss@latest autoprefixer@latest
```

This installs the requisite tailwind dependencies.

## Step 2: Initialize Tailwind

The simplest way to initialize Tailwind is to use their CLI.

```bash
cd apps/{your app here}
npx tailwindcss init -p
```

This creates the required files with a general boilerplate implementation.

### Pointing PostCSS to Tailwind Config

Next, adjust the `postcss.config.js` as follows:

```javascript
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

### Introducing Nx Utility for Better Tailwind Purging

One of the advantages of Tailwind is that it post-processes your CSS removing (also called "purging") all the parts that are not being used. In order to configure which file should be processed, the `tailwind.config.js` has a `content` property (formerly called `purge` in v2). You can find more details on Tailwind's [official documentation](https://tailwindcss.com/docs/content-configuration#configuring-source-paths).

The `content` property usually consists of a glob pattern to include all the necessary files that should be processed. In a Nx workspace it is very common for a project to have other projects as its dependencies. Setting and updating the glob to reflect those dependencies and their files is cumbersome and error-prone.

Nx has a utility function that can be used to construct the glob representation of all files a project depends on (based on the Nx Project Graph).

The function receives a directory path that is used to identify the project for which the dependencies are going to be identified (therefore it needs to be a directory path within a project). It can also receive an optional glob pattern to append to each dependency source root path to conform the final glob pattern. If the glob pattern is not provided, it will default to `/**/!(*.stories|*.spec).{ts,html}`.

```javascript
// apps/app1/tailwind.config.js
const { createGlobPatternsForDependencies } = require('@nrwl/react/tailwind');
const { join } = require('path');

module.exports = {
  content: [
    join(
      __dirname,
      '{src,pages,components}/**/*!(*.stories|*.spec).{ts,tsx,html}'
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

## Step 3: Import Tailwind CSS Styles

Next, import tailwind styles to the application's base `styles.css` or `styles.scss` file. This can be done by adding the following lines:

```css
@tailwind components;
@tailwind base;
@tailwind utilities;
```
