# Add a New Solid Project

The code for this example is available on GitHub:

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/solidjs" /%}

**Supported Features**

Because we are not using an Nx plugin for Solid, there are a few items we'll have to configure manually. We'll have to
configure our own build system. There are no pre-created Solid-specific code generators. And we'll have to take care of
updating any framework dependencies as needed.

{% pill url="/features/run-tasks" %}✅ Run Tasks{% /pill %}
{% pill url="/features/cache-task-results" %}✅ Cache Task Results{% /pill %}
{% pill url="/ci/features/remote-cache" %}✅ Share Your Cache{% /pill %}
{% pill url="/features/explore-graph" %}✅ Explore the Graph{% /pill %}
{% pill url="/ci/features/distribute-task-execution" %}✅ Distribute Task Execution{% /pill %}
{% pill url="/getting-started/editor-setup" %}✅ Integrate with Editors{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Nx{% /pill %}
{% pill url="/features/enforce-module-boundaries" %}✅ Enforce Module Boundaries{% /pill %}
{% pill url="/features/generate-code" %}🚫 Use Code Generators{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}🚫 Automate Updating Framework Dependencies{% /pill %}

## Install Solid and Other Dependencies

{% tabs %}
{% tab label="npm" %}

```shell
npm add solid-js
npm add -D solid-devtools vite-plugin-solid
nx add @nx/web
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn add solid-js
yarn add -D solid-devtools vite-plugin-solid
nx add @nx/web
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm add solid-js
pnpm add -D solid-devtools vite-plugin-solid
nx add @nx/web
```

{% /tab %}
{% /tabs %}

## Create an Application

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, omit the `--directory` flag. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

We'll start with a web application and then tweak the settings to match what we need. Add a new web application to your
workspace with the following command:

```shell
nx g @nx/web:app my-solid-app --directory=apps/my-solid-app --bundler=vite
```

The `@nx/web:app` generator will create some files that are unnecessary for our Solid application.

The files and folders to be deleted are:

- `apps/my-solid-app/public/`
- `apps/my-solid-app/src/app/`
- `apps/my-solid-app/src/main.ts`
- `apps/my-solid-app/src/styles.css`
- `apps/my-solid-app/.babelrc`

### Turn the Application into a Solid Application

Now we'll create the files that are necessary to turn our application into a Solid application.

**Add the following files**

```tsx {% fileName="apps/my-solid-app/src/App.tsx" %}
import type { Component } from 'solid-js';

const App: Component = () => {
  return (
    <div>
      <header>
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          href="https://github.com/solidjs/solid"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn Solid Now
        </a>
      </header>
    </div>
  );
};

export default App;
```

```tsx {% fileName="apps/my-solid-app/src/index.tsx" %}
/* @refresh reload */
import { render } from 'solid-js/web';

import App from './App';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?'
  );
}

render(() => <App />, root!);
```

**Update the following files**

```html {% fileName="apps/my-solid-app/index.html" %}
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <title>Solid App</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>

    <script src="src/index.tsx" type="module"></script>
  </body>
</html>
```

```ts {% fileName="apps/my-solid-app/vite.config.ts" %}
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
// import devtools from 'solid-devtools/vite';

import viteTsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/apps/my-solid-app',

  server: {
    port: 3000,
  },

  build: {
    target: 'esnext',
  },

  plugins: [
    viteTsConfigPaths({
      root: '../../',
    }),
    /*
                                                                        Uncomment the following line to enable solid-devtools.
                                                                        For more info see https://github.com/thetarnav/solid-devtools/tree/main/packages/extension#readme
                                                                        */
    // devtools(),
    solidPlugin(),
  ],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [
  //    viteTsConfigPaths({
  //      root: '../../',
  //    }),
  //  ],
  // },

  test: {
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest/apps/my-solid-app',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
});
```

```json {% fileName="apps/my-solid-app/tsconfig.json" %}
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ESNext", "DOM"],
    "moduleResolution": "Node",
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "strict": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "skipLibCheck": true,
    "types": ["vite/client", "vitest"]
  },
  "include": ["src"],
  "references": [
    {
      "path": "./tsconfig.app.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ]
}
```

You can now run `nx serve my-solid-app` and your Solid application can be viewed in your browser!

## Create a Library

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, omit the `--directory` flag. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

Let's create a library that our Solid application is going to consume. To create a new library, install the `@nx/js`
package and run:

```shell
nx g @nx/js:lib my-lib --directory=libs/my-lib
```

Once the library is created, update the following files.

Rename `libs/my-lib/src/lib/my-lib.ts` -> `libs/my-lib/src/lib/my-lib.tsx`, then edit the contents to:

```tsx {% fileName="libs/my-lib/src/lib/my-lib.tsx" %}
export function MyLibComponent(props: { name: string }) {
  return <h1>Hello {props.name} from MyLib</h1>;
}
```

```json {% fileName="libs/my-lib/tsconfig.json" %}
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "types": ["vitest"]
  },
  "files": [],
  "include": [],
  "references": [
    {
      "path": "./tsconfig.lib.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ]
}
```

```tsx {% fileName="apps/my-solid-app/src/App.tsx" %}
import type { Component } from 'solid-js';
import { MyLibComponent } from '@acme/my-lib';

const App: Component = () => {
  return (
    <div>
      <header>
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <MyLibComponent name={'there'} />
        <a
          href="https://github.com/solidjs/solid"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn Solid Now
        </a>
      </header>
    </div>
  );
};

export default App;
```

Now when you serve your application, you'll see the content from the library being displayed.

## More Documentation

- [@nx/vite](/nx-api/vite)
- [@nx/js](/nx-api/js)
- [@nx/web](/nx-api/web)
- [Solid](https://www.solidjs.com/)
