import {
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  newProject,
  runCLI,
  updateJson,
  updateFile,
} from '@nx/e2e/utils';

describe('Nx Import', () => {
  let proj: string;
  beforeAll(
    () =>
      (proj = newProject({
        packages: ['@nx/vue'],
        unsetProjectNameAndRootFormat: false,
      }))
  );
  afterAll(() => cleanupProject());

  it('should be able to import a vite app', () => {
    const remote = 'https://github.com/nrwl/nx.git';
    const ref = 'e2e-test/import-vite';
    const source = '.';
    const directory = 'projects/vite-app';

    if (getSelectedPackageManager() === 'pnpm') {
      updateFile(
        'pnpm-workspaces.yaml',
        `packages:
  - 'projects/*'
`
      );
    } else {
      updateJson('package.json', (json) => {
        json.workspaces = ['projects/*'];
        return json;
      });
    }

    runCLI(
      `import ${remote} ${directory} --ref ${ref} --source ${source} --no-interactive`,
      {
        env: {
          NX_IMPORT_SKIP_SOURCE_PREPARATION: 'true',
        },
        verbose: true,
      }
    );

    checkFilesExist(
      'projects/vite-app/.gitignore',
      'projects/vite-app/package.json',
      'projects/vite-app/index.html',
      'projects/vite-app/vite.config.ts',
      'projects/vite-app/src/main.tsx',
      'projects/vite-app/src/App.tsx'
    );
    runCLI(`vite:build created-vite-app`);
  });
});
