import {
  checkFilesExist,
  cleanupProject,
  getPackageManagerCommand,
  getSelectedPackageManager,
  newProject,
  readJson,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

// Update with each 7.1 prerelease until 7.1.0 is published.
const typescriptVersion = '7.1.0-beta';

describe('TypeScript 7.1', () => {
  const parent = uniq('parent');
  const child = uniq('child');

  beforeAll(() => {
    newProject({
      preset: 'ts',
      packages: ['@nx/js', '@nx/vitest', '@nx/oxlint'],
      typescriptVersion,
    });
    // The suite also passes on TypeScript 6, so check which one is installed.
    expect(readJson('node_modules/typescript/package.json').version).toBe(
      typescriptVersion
    );
  });

  afterAll(() => cleanupProject());

  it('should generate, sync, build, typecheck, test and lint libraries', () => {
    runCLI(
      `generate @nx/js:lib packages/${parent} --bundler=tsc --linter=oxlint --unitTestRunner=vitest`
    );
    runCLI(
      `generate @nx/js:lib packages/${child} --bundler=tsc --linter=oxlint --unitTestRunner=vitest`
    );
    updateFile(
      `packages/${parent}/src/index.ts`,
      (content) => `export * from '@proj/${child}';\n${content}`
    );
    const pm = getSelectedPackageManager();
    updateJson(`packages/${parent}/package.json`, (json) => {
      json.dependencies ??= {};
      json.dependencies[`@proj/${child}`] = pm === 'pnpm' ? 'workspace:*' : '*';
      return json;
    });
    runCommand(getPackageManagerCommand({ packageManager: pm }).install);

    runCLI('sync');
    expect(
      readJson(`packages/${parent}/tsconfig.lib.json`).references
    ).toContainEqual({ path: `../${child}/tsconfig.lib.json` });

    expect(runCLI(`build @proj/${parent}`)).toContain(
      `Successfully ran target build for project @proj/${parent}`
    );
    expect(runCLI(`typecheck @proj/${parent}`)).toContain(
      `Successfully ran target typecheck for project @proj/${parent}`
    );
    expect(runCLI(`test @proj/${parent}`)).toContain(
      `Successfully ran target test for project @proj/${parent}`
    );
    expect(runCLI(`lint @proj/${parent}`)).toContain(
      `Successfully ran target lint for project @proj/${parent}`
    );
    checkFilesExist(
      `packages/${parent}/dist/index.js`,
      `packages/${parent}/dist/index.d.ts`,
      `packages/${child}/dist/index.js`
    );
  });

  it('should load a local plugin that Node cannot strip types from', () => {
    // An enum is not erasable syntax, so Nx transpiles the plugin.
    updateFile(
      'tools/echo-plugin.ts',
      `import { dirname } from 'node:path';

enum TargetName {
  Echo = 'echo',
}

export const createNodes = [
  'packages/*/package.json',
  (files: string[]) =>
    files.map((file) => [
      file,
      {
        projects: {
          [dirname(file)]: {
            targets: { [TargetName.Echo]: { command: 'echo hello' } },
          },
        },
      },
    ]),
];
`
    );
    updateJson('nx.json', (json) => {
      json.plugins = [...(json.plugins ?? []), './tools/echo-plugin.ts'];
      return json;
    });

    expect(runCLI(`run @proj/${parent}:echo`)).toContain('hello');
  });
});
