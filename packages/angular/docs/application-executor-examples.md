This executor is a drop-in replacement for the `@angular-devkit/build-angular:application` builder provided by the Angular CLI. It builds an Angular application using [esbuild](https://esbuild.github.io/) with integrated SSR and prerendering capabilities.

In addition to the features provided by the Angular CLI builder, the `@nx/angular:application` executor also supports the following:

- Providing esbuild plugins
- Providing a function to transform the application's `index.html` file
- Incremental builds

{% callout type="check" title="Dev Server" %}
The [`@nx/angular:dev-server` executor](/nx-api/angular/executors/dev-server) is required to serve your application when using the `@nx/angular:application` to build it. It is a drop-in replacement for the Angular CLI's `@angular-devkit/build-angular:dev-server` builder and ensures the application is correctly served with Vite when using the `@nx/angular:application` executor.
{% /callout %}

## Examples

{% tabs %}
{% tab label="Providing esbuild plugins" %}

The executor accepts a `plugins` option that allows you to provide esbuild plugins that will be used when building your application. It allows providing a path to a plugin file or an object with a `path` and `options` property to provide options to the plugin.

```json {% fileName="apps/my-app/project.json" highlightLines=["8-16"] %}
{
  ...
  "targets": {
    "build": {
      "executor": "@nx/angular:application",
      "options": {
        ...
        "plugins": [
          "apps/my-app/plugins/plugin1.js",
          {
            "path": "apps/my-app/plugins/plugin2.js",
            "options": {
              "someOption": "some value"
            }
          }
        ]
      }
    }
    ...
  }
}
```

```ts {% fileName="apps/my-app/plugins/plugin1.js" %}
const plugin1 = {
  name: 'plugin1',
  setup(build) {
    const options = build.initialOptions;
    options.define.PLUGIN1_TEXT = '"Value was provided at build time"';
  },
};

module.exports = plugin1;
```

```ts {% fileName="apps/my-app/plugins/plugin2.js" %}
function plugin2({ someOption }) {
  return {
    name: 'plugin2',
    setup(build) {
      const options = build.initialOptions;
      options.define.PLUGIN2_TEXT = JSON.stringify(someOption);
    },
  };
}

module.exports = plugin2;
```

Additionally, we need to inform TypeScript of the defined variables to prevent type-checking errors during the build. We can achieve this by creating or updating a type definition file included in the TypeScript build process (e.g. `src/types.d.ts`) with the following content:

```ts {% fileName="apps/my-app/src/types.d.ts" %}
declare const PLUGIN1_TEXT: number;
declare const PLUGIN2_TEXT: string;
```

{% /tab %}

{% tab label="Transforming the 'index.html' file" %}

The executor accepts an `indexHtmlTransformer` option to provide a path to a file with a default export for a function that receives the application's `index.html` file contents and outputs the updated contents.

```json {% fileName="apps/my-app/project.json" highlightLines=[8] %}
{
  ...
  "targets": {
    "build": {
      "executor": "@nx/angular:application",
      "options": {
        ...
        "indexHtmlTransformer": "apps/my-app/index-html.transformer.ts"
      }
    }
    ...
  }
}
```

```ts {% fileName="apps/my-app/index-html.transformer.ts" %}
export default function (indexContent: string) {
  return indexContent.replace(
    '<title>my-app</title>',
    '<title>my-app (transformed)</title>'
  );
}
```

{% /tab %}
{% /tabs %}
