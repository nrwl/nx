# Using Tailwind CSS in React

This guide serves as a quickstart to installing [Tailwind CSS](https://tailwindcss.com) in your Web/React/Next.js app.

For more in-depth look on this topic, be sure to check out our blog post on [Setting up Next.js to use Tailwind with Nx](https://blog.nrwl.io/setup-next-js-to-use-tailwind-with-nx-849b7e21d8d0).

## Step 1: Install Tailwind Dependencies

`npm install tailwindcss@latest postcss@latest autoprefixer@latest`

This installs the requisite tailwind dependencies.

## Step 2: Intialize Tailwind

In this step, create a `postcss.config.js` and a `tailwind.config.js` file specific to the application to introduce Tailwind to.

The simplest way to do this uses the Tailwind CLI, and can be done with:

```bash
cd apps/{your app here}
npx tailwindcss init -p
```

This creates the needed files with a general boilerplate implementation.

### Pointing PostCss to Tailwind Config

Next, adjust the `postcss.config.js` as follows:

```js
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

In a typical `tailwind.config.js` file, the `purge` property of the tailwind config would be an array that includes all files that could mention tailwind class names (you can find more details on tailwind's [official documentation](https://tailwindcss.com/docs/optimizing-for-production#basic-usage)).

Nx has a utility function for determining the glob representation of all files the application depends on (based on the Nx Dependency Graph), which should be used when setting this purge property. This eliminates additional manual maintenance as your workspace progresses.

```js
const { join } = require('path');
const { createGlobPatternsForDependencies } = require('@nrwl/react/tailwind');

module.exports = {
  purge: [
    // place your own app's glob pattern (for example)
    join(__dirname, '**/*.{js,ts,jsx,tsx}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {},
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
```

`createGlobPatternsForDependencies(..)` uses the Nx dependency graph to generate glob patterns for all the app's **dependencies** (e.g. for all referenced libraries within the Nx workspace).

_NOTE:_ To ensure proper purging for custom configurations, be sure that the `NODE_ENV` environment variable is set to `production`. By default, Nx only purges on prod build (for example: `nx build --prod`).

## Step 3: Import TailwindCss Styles

Next, import tailwind styles to the application's base `styles.css` or `styles.scss` file. This can be done by adding the following lines:

```css
@tailwind components;
@tailwind base;
@tailwind utilities;
```
