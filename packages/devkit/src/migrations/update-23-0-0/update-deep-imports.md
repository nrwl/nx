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

#### Fallback for non-named imports

For deep-import shapes that can't be split by symbol — default imports, namespace imports, side-effect imports, `require(...)` calls, dynamic `import(...)`, and `jest.mock(...)` / `vi.mock(...)`-style mock-helper calls — the migration rewrites the specifier to `@nx/devkit/internal` as a best guess, since most symbols that previously lived under `@nx/devkit/src/...` ended up there.

```ts
// Before
const { dasherize } = require('@nx/devkit/src/utils/string-utils');

// After
const { dasherize } = require('@nx/devkit/internal');
```

If the symbol you're after is part of the stable public API instead, the rewritten import will fail to resolve against `@nx/devkit/internal` — switch it to `@nx/devkit` by hand. The migration also leaves `typeof import('@nx/devkit/src/...')` type queries and any deep-import strings inside template literals or comments untouched, so you'll need to update those by hand.
