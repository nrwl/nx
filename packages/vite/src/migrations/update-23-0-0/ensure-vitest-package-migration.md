# ensure-vitest-package-migration (Nx v23)

Migration that runs automatically when upgrading to Nx 23. It is a safety net for workspaces that still have `@nx/vite` vitest artifacts in place after the optional v22 migration.

## What it does

1. **Installs `@nx/vitest`**: added to `devDependencies` when vitest is detected in the workspace (skipped when already present or when the workspace does not use vitest at all).
2. **Swaps `@nx/vite:test` to `@nx/vitest:test`**: updates every `project.json` target and every `targetDefaults` entry that still references the removed executor.
3. **Splits `@nx/vite/plugin` registrations**: vitest-related options (`testTargetName`, `ciTargetName`, `ciGroupName`) are extracted from each `@nx/vite/plugin` entry and moved to a new `@nx/vitest` plugin entry. The vite entry is updated to retain only build/serve/preview options.
4. **Registers `@nx/vitest` plugin**: for workspaces that used `@nx/vite/plugin` in its default configuration (no vitest options), a matching `@nx/vitest` plugin entry is added automatically so vitest targets continue to be inferred.

## Why this migration exists

The vitest support that previously lived in `@nx/vite` (the `@nx/vite:test` executor, the `@nx/vite:vitest` generator, and the vitest target inference in `@nx/vite/plugin`) was removed in Nx 23 and is now exclusively provided by the `@nx/vitest` package. See the [Migrating from @nx/vite guide](/technologies/test-tools/vitest/guides/migrating-from-nx-vite).

## No action required

Run `nx migrate` and this migration will handle the conversion automatically. To verify the result, check `nx.json`, your `project.json` files, and `package.json` after running migrations.
