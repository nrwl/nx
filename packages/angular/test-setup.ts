import { createRequire } from 'node:module';
// Not the internal-testing-utils barrel: modules a setup file loads are cached
// before a spec's vi.mock applies, so the barrel would defeat spec mocks.
// oxlint-disable-next-line no-restricted-imports
import { mockCjsModule } from 'nx/src/internal-testing-utils/cjs-mock';

const allowedProjectExtensions = [
  'tags',
  'implicitDependencies',
  'configFilePath',
  '$schema',
  'generators',
  'namedInputs',
  'name',
];

const allowedWorkspaceExtensions = [
  'implicitDependencies',
  'affected',
  'tasksRunnerOptions',
  'workspaceLayout',
  'plugins',
  'targetDefaults',
  'files',
  'generators',
  'namedInputs',
];

// The angular-devkit schematics `require` the workspace reader, which vi.mock
// cannot reach. Resolve it from each consumer, since pnpm may install copies.
const readerSpecifier = '@angular-devkit/core/src/workspace/json/reader';
const require = createRequire(import.meta.url);
const readerPaths = new Set<string>();
for (const consumer of [
  '@nx/angular/package.json',
  '@schematics/angular/package.json',
  '@angular-devkit/schematics/package.json',
]) {
  try {
    readerPaths.add(
      createRequire(require.resolve(consumer)).resolve(readerSpecifier)
    );
  } catch {}
}
for (const readerPath of readerPaths) {
  const originalModule = require(
    readerPath
  ) as typeof import('@angular-devkit/core/src/workspace/json/reader');
  const originalReadJsonWorkspace = originalModule.readJsonWorkspace;
  mockCjsModule(import.meta.url, readerPath, {
    ...originalModule,
    readJsonWorkspace: async (path, host, options) =>
      originalReadJsonWorkspace(path, host, {
        ...options,
        allowedProjectExtensions,
        allowedWorkspaceExtensions,
      }),
  });
}
