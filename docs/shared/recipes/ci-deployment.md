# Prepare applications for deployment via CI

A common approach to deploying applications is via docker containers. Some applications can be built into bundles that are environment agnostic, while others depend on OS-specific packages being installed. For these situations, having just bundled code is not enough, we also need to have `package.json`.

Nx supports the generation of the project's `package.json` by identifying all the project's dependencies. The generated `package.json` is created next to the built artifacts (usually at `dist/apps/name-of-the-app`).

Additionally, we should generate pruned lock file according to the generated `package.json`. This makes the installation in the container significantly faster as we only need to install a subset of the packages.

## Supported executors

The `@nx/webpack:webpack` executor supports the `generatePackageJson` flag which generates both `package.json` as well as the lock file.

Some executors automatically generate output `package.json` and the lock file generation is supported using the `generateLockfile` flag:

- `@nx/js:swc`
- `@nx/js:tsc`
- `@nx/next:build`

## Using a custom executor

If you are using a custom executor or an executor that does not support `generatePackgeJson` or `generateLockfile` flags, you can still use Nx to generate `package.json` and the lock file. The `createPackageJson` and `createLockFile` functions are exported from `@nx/devkit`:

```typescript
import { createPackageJson, createLockFile } from '@nx/devkit';
import { writeFileSync } from 'fs';

export default async function buildExecutor(
  options: Schema,
  context: ExecutorContext
) {
  // ...your executor code

  const packageJson = createPackageJson(
    context.projectName,
    context.projectGraph,
    {
      root: context.root,
      isProduction: true, // We want to strip any non-prod dependencies
    }
  );

  // do any additional manipulations to "package.json" here

  const lockFile = createLockFile(packageJson);
  writeJsonFile(`${options.outputPath}/package.json`, builtPackageJson);
  writeFileSync(`${options.outputPath}/${packageLockFileName}}`, lockFile, {
    encoding: 'utf-8',
  });

  // any subsequent executor code
}
```
