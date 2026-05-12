#### Rewrite `NxReactWebpackPlugin` Imports to the `@nx/react/webpack-plugin` Sub-path

The deprecated re-export of `NxReactWebpackPlugin` from `@nx/react` is removed in v23. The migration rewrites both ES module imports and CJS `require()` calls to use the `@nx/react/webpack-plugin` sub-path. Imports that combine the deprecated symbol with other named imports are split into two declarations so the rest of the original import still resolves from `@nx/react`. Aliases (`as Plugin`, `: Plugin`) are preserved.

#### Sample Code Changes

ES module import.

##### Before

```ts title="apps/my-app/webpack.config.ts" {1}
import { NxReactWebpackPlugin } from '@nx/react';

export default { plugins: [new NxReactWebpackPlugin()] };
```

##### After

```ts title="apps/my-app/webpack.config.ts"
import { NxReactWebpackPlugin } from '@nx/react/webpack-plugin';

export default { plugins: [new NxReactWebpackPlugin()] };
```

ES module import combined with other named imports.

##### Before

```ts title="apps/my-app/webpack.config.ts" {1}
import { NxReactWebpackPlugin, withReact } from '@nx/react';
```

##### After

```ts title="apps/my-app/webpack.config.ts"
import { NxReactWebpackPlugin } from '@nx/react/webpack-plugin';
import { withReact } from '@nx/react';
```

CJS `require()`.

##### Before

```js title="apps/my-app/webpack.config.js" {1}
const { NxReactWebpackPlugin } = require('@nx/react');
```

##### After

```js title="apps/my-app/webpack.config.js"
const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
```
