# Prepare applications for deployment via CI

A common approach to deploying applications is via docker containers. Some applications can be built into bundles that are environment agnostic, while others depend on OS-specific packages being installed. For these situations, having just bundled code is not enough, we also need to have `package.json`.

Nx packages' executors support the `generatePackageJson` flag which tells the builder to also identify all dependencies and add them to `package.json` which is created next to the built artifacts (usually at `dist/apps/name-of-the-app`). Since version [15.3.3](https://github.com/nrwl/nx/releases/tag/15.3.3), the `package.json` generation will also include the appropriate lock file. This makes the installation in the container significantly faster.

## Using a custom executor

If you are using a custom executor, you can still use Nx to generate `package.json` and the lock file. The `createPackageJson` and `createLockFile` functions are exported from `@nrwl/devkit`:

```typescript
import { createPackageJson, createLockFile } from '@nrwl/devkit';
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
