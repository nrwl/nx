• `Const` **cacheDir**: `string`

Path to the directory where Nx stores its cache.

Normally the shared per-user directory, so every checkout of the workspace
uses one cache. A configured `cacheDirectory` is honored instead, resolved
against the root that asks -- so two checkouts share a configured location
only when the value is absolute. See `resolveSharedDataLocation`.
