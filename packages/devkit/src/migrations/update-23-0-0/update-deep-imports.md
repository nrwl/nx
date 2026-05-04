#### Update `@nx/devkit` deep imports

`@nx/devkit` now ships a strict `exports` map, so deep imports like `@nx/devkit/src/utils/...` and `@nx/devkit/src/generators/...` are no longer reachable through Node module resolution.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites those deep imports to one of the supported entry points:

- Symbols that are part of the stable `@nx/devkit` public API are routed to `@nx/devkit`.
- Symbols that were previously only reachable through deep imports are routed to `@nx/devkit/internal`.

After rewriting, the migration **collapses duplicate imports** so a file never ends up with two `import ... from '@nx/devkit'` (or `@nx/devkit/internal`) lines — including merging into any matching import you already had.

#### Sample Code Changes

##### Before

```ts
import { Tree } from '@nx/devkit';
import { dasherize, names } from '@nx/devkit/src/utils/string-utils';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
```

##### After

```ts
import { Tree, names } from '@nx/devkit';
import { dasherize, addPlugin } from '@nx/devkit/internal';
```

`names` was already in the public API, so it joins the existing `@nx/devkit` import. `dasherize` and `addPlugin` move to `@nx/devkit/internal`, and the two `/internal` imports are collapsed into one.

#### Limitations

The migration only rewrites named `import { ... } from '@nx/devkit/src/...'` declarations. Default imports, namespace imports, side-effect imports, `require(...)` calls, and dynamic `import(...)` calls are left untouched and need to be migrated by hand to either `@nx/devkit` or `@nx/devkit/internal` depending on the symbol.
