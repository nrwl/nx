---
title: 'createConfig - @nx/angular-rspack'
description: 'API Reference for createConfig from @nx/angular-rspack'
---

# createConfig

```bash
import { createConfig } from '@nx/angular-rspack';
```

The `createConfig` function is used to create an Rspack configuration object setup for Angular applications.

It takes an optional `Configuration` object as an argument, which allows for customization of the Rspack configuration.

```ts
function createConfig(
  options: Partial<AngularRspackPluginOptions>,
  rspackConfigOverrides?: Partial<Configuration>
);
```

---

## Examples

{% tabs %}

{% tab label="Server-Side Rendering (SSR)" %}
The following example shows how to create a configuration for a SSR application:

```ts {% fileName="myapp/rspack.config.ts" %}
import { createConfig } from '@nx/angular-rspack';

export default createConfig({
  browser: './src/main.ts',
  server: './src/main.server.ts',
  ssrEntry: './src/server.ts',
});
```

{% /tab %}

{% tab label="Client-Side Rendering (CSR)" %}
The following example shows how to create a configuration for a CSR application:

```ts {% fileName="myapp/rspack.config.ts" %}
import { createConfig } from '@nx/angular-rspack';

export default createConfig({
  browser: './src/main.ts',
});
```

{% /tab %}

{% tab label="Modify Rspack Configuration" %}
The following example shows how to modify the base Rspack configuration:

```ts {% fileName="myapp/rspack.config.ts" %}
import { createConfig } from '@nx/angular-rspack';

export default createConfig(
  {
    browser: './src/main.ts',
    server: './src/main.server.ts',
    ssrEntry: './src/server.ts',
  },
  {
    mode: 'development',
  }
);
```

{% /tab %}

{% tab label="File Replacements" %}
The following example shows how to use file replacements:

```ts {% fileName="myapp/rspack.config.ts" %}
import { createConfig } from '@nx/angular-rspack';

export default createConfig({
  browser: './src/main.ts',
  server: './src/main.server.ts',
  ssrEntry: './src/server.ts',
  fileReplacements: [
    {
      replace: './src/environments/environment.ts',
      with: './src/environments/environment.prod.ts',
    },
  ],
});
```

{% /tab %}

{% /tabs %}

---

## AngularRspackPluginOptions

The `AngularRspackPluginOptions` object is an object that contains the following properties:

```ts
export interface AngularRspackPluginOptions {
  root: string;
  index: string;
  browser: string;
  server?: string;
  ssrEntry?: string;
  polyfills: string[];
  assets: string[];
  styles: string[];
  scripts: string[];
  fileReplacements: FileReplacement[];
  jit: boolean;
  inlineStylesExtension: InlineStyleExtension;
  stylePreprocessorOptions: StylePreprocessorOptions;
  tsconfigPath: string;
  hasServer: boolean;
  skipTypeChecking: boolean;
  useTsProjectReferences?: boolean;
}

export type InlineStyleExtension = 'css' | 'scss' | 'sass' | 'less';
export interface FileReplacement {
  replace: string;
  with: string;
}
export interface StylePreprocessorOptions {
  includePaths?: string[];
  sass?: Sass;
}
export interface Sass {
  fatalDeprecations?: DeprecationOrId[];
  futureDeprecations?: DeprecationOrId[];
  silenceDeprecations?: DeprecationOrId[];
}
```

---

### `root`

`string`
The root directory of the project. This is the directory where the rspack.config.ts file is located.

### `index`

`string`
The path to the index.html file. This is used to determine the base html template to use.

### `browser`

string
The path to the browser entry file. This is used to determine the entry point for the browser build. It is usually ./src/main.ts

### `server`

`string`
The path to the server entry file. This is used to determine the entry point for the server build. It is usually ./src/main.server.ts

### `ssrEntry`

`string`
The path to the node server entry file. This contains the express server setup. It is usually ./src/server.ts

### `polyfills`

`Array<string>`
An array of polyfills to include in the build. Can be either a path to a polyfill file or a package name.

### `assets`

`Array<string>`
An array of assets to include in the build. Can be a path to a directory or a file. Resolved from the path provided in root.

### `styles`

`Array<string>`
An array of styles to include in the build. Resolved from the path provided in root.

### `scripts`

`Array<string>`
An array of scripts to include in the build. Resolved from the path provided in root.

### `fileReplacements`

`Array<FileReplacement>`
An array of file replacements to be used in the build. This is used to replace files during the build process.

### `jit`

`boolean`
`Default: false`
A boolean value indicating whether to use the JIT mode. This is used to tell the Angular compiler to use Just-In-Time Compilation. **Not Recommended**

### `inlineStylesExtension`

`InlineStylesExtension`
The inline styles extension to use. This is used to inform the compiler how to handle inline styles, setting up Sass compilation if required.

### `stylePreprocessorOptions`

`StylePreprocessorOptions`
The options to pass to the style preprocessor. Configure the include paths and sass options.

### `tsconfigPath`

`string`
`Default: ./tsconfig.app.json`
The path to the TypeScript configuration file. This is used to set compilerOptions for the Angular compilation.

### `hasServer`

`boolean`
`internal`
A boolean value indicating whether the project has a server. This is inferred based on the presence of ssrEntry and server and does not need to be set manually.

### `skipTypeChecking`

`boolean`
`Default: false`
A boolean value indicating whether to skip type checking. This is used to skip the type checking process during the build process.

### `useTsProjectReferences`

`boolean`
`Default: false`
A boolean value indicating whether to use TypeScript project references.
