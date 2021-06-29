# Installing TailwindCss in Web/React/Next.js Apps

This guide will serve as a quickstart to installing TailwindCss in your Web/React/Next.js app.

For more in-depth look on this topic, be sure to check out our blog post on [Setting up Next.js to use Tailwind with Nx](https://blog.nrwl.io/setup-next-js-to-use-tailwind-with-nx-849b7e21d8d0).

## Step 1: Install Tailwind Dependencies

`npm install tailwindcss@latest postcss@latest autoprefixer@latest`

This will install the requisite tailwind dependencies.

## Step 2: Intialize Tailwind

In this step, we'll create a `postcss.config.js` and a `tailwind.config.js` file specific to the application we'd like to introduce tailwind to.

The simplest way to do this uses the Tailwind CLI, and can be done via:

```bash
cd apps/{your app here}
npx tailwindcss init -p
```

This will create the needed files for you with a general boilerplate implementation.

### Pointing PostCss to Tailwind Config

We'll need to adjust the `postcss.config.js` as follows:

```js
module.exports = {
  plugins: {
    tailwindcss: { config: './apps/{your app here}/tailwind.config.js' },
    autoprefixer: {},
  },
};
```

### Introducing Nx Utility for Better Tailwind Purging

In a typical `tailwind.config.js` file, you'd set the `purge` property of your tailwind config to an array that includes all templates that would mention tailwind class names (you can find more details on tailwind's [official documentation](https://tailwindcss.com/docs/optimizing-for-production#basic-usage)).

Nx has a utility function for determining the glob representation of all files that your application depends on (based on the Nx Dependency Graph) that allows us to easily set this purge property without additional manual maintenance down the road:

```js
const { createGlobPatternsForDependencies } = require('@nrwl/react/tailwind');

module.exports = {
  purge: createGlobPatternsForDependencies(__dirname),
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

_NOTE:_ To ensure proper purging for custom configurations, be sure that the `NODE_ENV` environment variable is set to `production`. By default, Nx will only purge on prod build (e.g. `nx build --prod`).

## Step 3: Import TailwindCss Styles

Next, we'll need to import tailwind styles to your application's base `styles.css` or `styles.scss` file. This can be done by adding the following lines:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```
