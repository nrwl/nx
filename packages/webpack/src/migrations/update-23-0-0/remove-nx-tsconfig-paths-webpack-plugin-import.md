#### Rewrite `NxTsconfigPathsWebpackPlugin` Imports to the `@nx/webpack/tsconfig-paths-plugin` Sub-path

The deprecated re-export of `NxTsconfigPathsWebpackPlugin` from `@nx/webpack` is removed in v23. The migration rewrites both ES module imports and CJS `require()` calls to use the `@nx/webpack/tsconfig-paths-plugin` sub-path. Imports that combine the deprecated symbol with other named imports are split into two declarations so the rest of the original import still resolves from `@nx/webpack`. Aliases (`as Plugin`, `: Plugin`) are preserved.

#### Sample Code Changes

ES module import.

##### Before

```ts title="apps/my-app/webpack.config.ts" {1}
import { NxTsconfigPathsWebpackPlugin } from '@nx/webpack';

export default { plugins: [new NxTsconfigPathsWebpackPlugin()] };
```

##### After

```ts title="apps/my-app/webpack.config.ts"
import { NxTsconfigPathsWebpackPlugin } from '@nx/webpack/tsconfig-paths-plugin';

export default { plugins: [new NxTsconfigPathsWebpackPlugin()] };
```

ES module import combined with other named imports.

##### Before

```ts title="apps/my-app/webpack.config.ts" {1}
import { NxTsconfigPathsWebpackPlugin, NxAppWebpackPlugin } from '@nx/webpack';
```

##### After

```ts title="apps/my-app/webpack.config.ts"
import { NxTsconfigPathsWebpackPlugin } from '@nx/webpack/tsconfig-paths-plugin';
import { NxAppWebpackPlugin } from '@nx/webpack';
```

CJS `require()`.

##### Before

```js title="apps/my-app/webpack.config.js" {1}
const { NxTsconfigPathsWebpackPlugin } = require('@nx/webpack');
```

##### After

```js title="apps/my-app/webpack.config.js"
const {
  NxTsconfigPathsWebpackPlugin,
} = require('@nx/webpack/tsconfig-paths-plugin');
```
