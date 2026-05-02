#### Split `@nx/angular:ngrx` generator defaults across the replacement generators

Splits any `@nx/angular:ngrx` generator defaults set in `nx.json` or in project-level `project.json` files across the two replacement generators: `@nx/angular:ngrx-root-store` (for root state) and `@nx/angular:ngrx-feature-store` (for feature state). The `@nx/angular:ngrx` generator was removed in Nx v23.

Shared options apply to both keys; `barrels` and `parent` are written only to `@nx/angular:ngrx-feature-store` (the `@nx/angular:ngrx-root-store` schema doesn't accept them). The `minimal` option is written only to `@nx/angular:ngrx-root-store` because its semantics differ between the two new generators (see Notes). The deprecated `module` option is renamed to `parent`. The obsolete `root` toggle is dropped — intent is now expressed by which generator is invoked. Existing defaults already set under the new keys are preserved.

#### Examples

##### Before

```json title="nx.json"
{
  "generators": {
    "@nx/angular:ngrx": {
      "facade": true,
      "minimal": true,
      "barrels": true,
      "module": "libs/my-lib/src/lib/my-lib-module.ts"
    }
  }
}
```

##### After

```json title="nx.json"
{
  "generators": {
    "@nx/angular:ngrx-root-store": {
      "facade": true,
      "minimal": true
    },
    "@nx/angular:ngrx-feature-store": {
      "facade": true,
      "barrels": true,
      "parent": "libs/my-lib/src/lib/my-lib-module.ts"
    }
  }
}
```

#### Notes

The `minimal` option is intentionally not propagated to `@nx/angular:ngrx-feature-store`. In the deprecated `@nx/angular:ngrx` generator, `minimal` only gated root-state file generation and was a no-op for feature-state usage. In `@nx/angular:ngrx-feature-store`, `minimal: true` skips template generation while still wiring imports to the (now missing) files, which would produce broken modules.

The split is otherwise intentionally inclusive: shared options are written to both new keys so users can trim the ones they don't want. CLI invocations of `@nx/angular:ngrx` (in shell scripts, CI, or `package.json`) are not migrated — update those manually to call `@nx/angular:ngrx-root-store` or `@nx/angular:ngrx-feature-store`.
