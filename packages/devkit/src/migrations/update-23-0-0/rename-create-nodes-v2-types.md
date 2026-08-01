#### Rename deprecated CreateNodes `V2` types from `@nx/devkit`

The canonical plugin API types lost their `V2` suffix in Nx 23. The `V2` names are kept as `@deprecated` aliases, but new code should use the canonical names:

| Deprecated (`@nx/devkit`) | Canonical                |
| ------------------------- | ------------------------ |
| `CreateNodesV2`           | `CreateNodes`            |
| `CreateNodesContextV2`    | `CreateNodesContext`     |
| `CreateNodesResultV2`     | `CreateNodesResultArray` |
| `CreateNodesFunctionV2`   | `CreateNodesFunction`    |
| `NxPluginV2`              | `NxPlugin`               |

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of these types from `@nx/devkit` to their canonical names.

#### Sample Code Changes

##### Before

```ts
import type { CreateNodesV2, CreateNodesContextV2 } from '@nx/devkit';
```

##### After

```ts
import type { CreateNodes, CreateNodesContext } from '@nx/devkit';
```

Aliases are preserved (`CreateNodesV2 as CN` becomes `CreateNodes as CN`), and if a file already imports both names (`{ CreateNodes, CreateNodesV2 }`) the redundant binding is dropped. The unrelated `CreateNodesResult` type is left untouched.
