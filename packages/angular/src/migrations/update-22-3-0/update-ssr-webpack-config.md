#### Updates Webpack-Based SSR Configuration

Updates the TypeScript configuration and import syntax for webpack-based server-side rendering (SSR) projects. This migration sets `module: "preserve"` and `moduleResolution: "bundler"` in `tsconfig.server.json` to align with Angular's build requirements, and updates server file imports from namespace imports (`import * as express`) to default imports (`import express`) to work correctly with the new module format.

#### Examples

For webpack-based SSR projects (using `@nx/angular:webpack-server` or `@angular-devkit/build-angular:server`), the migration updates the `tsconfig.server.json` file:

##### Before

```jsonc {7-8}
// apps/my-app/tsconfig.server.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "target": "es2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "types": ["node"],
  },
  "files": ["src/main.server.ts", "src/server.ts"],
}
```

##### After

```jsonc {7-8}
// apps/my-app/tsconfig.server.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "target": "es2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "types": ["node"],
  },
  "files": ["src/main.server.ts", "src/server.ts"],
}
```

The migration also updates import statements in the `server.ts` file to use default imports instead of namespace imports:

##### Before

```ts {2-4}
// apps/my-app/src/server.ts
import * as express from 'express';
import * as compression from 'compression';
import * as cors from 'cors';

const app = express();
app.use(compression());
app.use(cors());
```

##### After

```ts {2-4}
// apps/my-app/src/server.ts
import express from 'express';
import compression from 'compression';
import cors from 'cors';

const app = express();
app.use(compression());
app.use(cors());
```

Projects that already have the correct TypeScript configuration or projects without a `tsconfig.server.json` file are not modified by this migration.
