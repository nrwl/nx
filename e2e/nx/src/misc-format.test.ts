import {
  cleanupProject,
  isNotWindows,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import * as path from 'path';
import { setupMiscTests } from './misc-setup';

describe('Nx Commands - format', () => {
  const myapp = uniq('myapp');
  const mylib = uniq('mylib');

  beforeAll(() => {
    setupMiscTests();
    runCLI(`generate @nx/web:app apps/${myapp}`);
    runCLI(`generate @nx/js:lib libs/${mylib}`);
  });

  afterAll(() => cleanupProject());

  beforeEach(() => {
    updateFile(
      `apps/${myapp}/src/main.ts`,
      `
       const x = 1111;
  `
    );

    updateFile(
      `apps/${myapp}/src/app/app.element.spec.ts`,
      `
       const y = 1111;
  `
    );

    updateFile(
      `apps/${myapp}/src/app/app.element.ts`,
      `
       const z = 1111;
  `
    );

    updateFile(
      `libs/${mylib}/index.ts`,
      `
       const x = 1111;
  `
    );
    updateFile(
      `libs/${mylib}/src/${mylib}.spec.ts`,
      `
       const y = 1111;
  `
    );

    updateFile(
      `README.md`,
      `
       my new readme;
  `
    );
  });

  it('should check libs and apps specific files', async () => {
    if (isNotWindows()) {
      const stdout = runCLI(
        `format:check --files="libs/${mylib}/index.ts,package.json" --libs-and-apps`,
        { silenceError: true }
      );
      expect(stdout).toContain(path.normalize(`libs/${mylib}/index.ts`));
      expect(stdout).toContain(
        path.normalize(`libs/${mylib}/src/${mylib}.spec.ts`)
      );
      expect(stdout).not.toContain(path.normalize(`README.md`)); // It will be contained only in case of exception, that we fallback to all
    }
  }, 90000);

  it('should check specific project', async () => {
    if (isNotWindows()) {
      const stdout = runCLI(`format:check --projects=${myapp}`, {
        silenceError: true,
      });
      expect(stdout).toContain(path.normalize(`apps/${myapp}/src/main.ts`));
      expect(stdout).toContain(
        path.normalize(`apps/${myapp}/src/app/app.element.ts`)
      );
      expect(stdout).toContain(
        path.normalize(`apps/${myapp}/src/app/app.element.spec.ts`)
      );
      expect(stdout).not.toContain(path.normalize(`libs/${mylib}/index.ts`));
      expect(stdout).not.toContain(
        path.normalize(`libs/${mylib}/src/${mylib}.spec.ts`)
      );
      expect(stdout).not.toContain(path.normalize(`README.md`));
    }
  }, 90000);

  it('should check multiple projects', async () => {
    if (isNotWindows()) {
      const stdout = runCLI(`format:check --projects=${myapp},${mylib}`, {
        silenceError: true,
      });
      expect(stdout).toContain(path.normalize(`apps/${myapp}/src/main.ts`));
      expect(stdout).toContain(
        path.normalize(`apps/${myapp}/src/app/app.element.spec.ts`)
      );
      expect(stdout).toContain(
        path.normalize(`apps/${myapp}/src/app/app.element.ts`)
      );
      expect(stdout).toContain(path.normalize(`libs/${mylib}/index.ts`));
      expect(stdout).toContain(
        path.normalize(`libs/${mylib}/src/${mylib}.spec.ts`)
      );
      expect(stdout).not.toContain(path.normalize(`README.md`));
    }
  }, 90000);

  it('should check all', async () => {
    if (isNotWindows()) {
      const stdout = runCLI(`format:check --all`, { silenceError: true });
      expect(stdout).toContain(path.normalize(`apps/${myapp}/src/main.ts`));
      expect(stdout).toContain(
        path.normalize(`apps/${myapp}/src/app/app.element.spec.ts`)
      );
      expect(stdout).toContain(
        path.normalize(`apps/${myapp}/src/app/app.element.ts`)
      );
      expect(stdout).toContain(path.normalize(`libs/${mylib}/index.ts`));
      expect(stdout).toContain(
        path.normalize(`libs/${mylib}/src/${mylib}.spec.ts`)
      );
      expect(stdout).toContain(path.normalize(`README.md`));
    }
  }, 90000);

  it('should throw error if passing both projects and --all param', async () => {
    if (isNotWindows()) {
      const { stderr } = await runCLIAsync(
        `format:check --projects=${myapp},${mylib} --all`,
        {
          silenceError: true,
        }
      );
      expect(stderr).toContain(
        'Arguments all and projects are mutually exclusive'
      );
    }
  }, 90000);

  it('should reformat the code', async () => {
    if (isNotWindows()) {
      runCLI(
        `format:write --files="apps/${myapp}/src/app/app.element.spec.ts,apps/${myapp}/src/app/app.element.ts"`
      );
      const stdout = runCLI('format:check --all', { silenceError: true });
      expect(stdout).toContain(path.normalize(`apps/${myapp}/src/main.ts`));
      expect(stdout).not.toContain(
        path.normalize(`apps/${myapp}/src/app/app.element.spec.ts`)
      );
      expect(stdout).not.toContain(
        path.normalize(`apps/${myapp}/src/app/app.element.ts`)
      );

      runCLI('format:write --all');
      expect(runCLI('format:check --all')).not.toContain(
        path.normalize(`apps/${myapp}/src/main.ts`)
      );
    }
  }, 300000);
});
