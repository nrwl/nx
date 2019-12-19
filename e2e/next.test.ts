import { capitalize } from '@nrwl/workspace/src/utils/strings';
import * as http from 'http';
import {
  checkFilesExist,
  ensureProject,
  forEachCli,
  readFile,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
  supportUi
} from './utils';
import treeKill = require('tree-kill');

forEachCli('nx', () => {
  describe('Next.js Applications', () => {
    it('should generate a Nest.jx app that consumes a react lib', async () => {
      ensureProject();
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(
        `generate @nrwl/next:app ${appName} --no-interactive --linter=eslint`
      );

      runCLI(`generate @nrwl/react:lib ${libName} --no-interactive`);

      const mainPath = `apps/${appName}/pages/index.tsx`;
      updateFile(mainPath, `import '@proj/${libName}';\n` + readFile(mainPath));

      await checkApp(appName, { checkLint: true });
    }, 120000);

    xit('should generate a Next.js app dynamically loading a lib', async () => {
      ensureProject();
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(
        `generate @nrwl/next:app ${appName} --no-interactive --linter=eslint`
      );
      runCLI(`generate @nrwl/react:lib ${libName} --no-interactive`);

      const mainPath = `apps/${appName}/pages/index.tsx`;
      updateFile(
        mainPath,
        `
        import dynamic from 'next/dynamic';
        const DynamicComponent = dynamic(
            () => import('@proj/${libName}').then(d => d.${capitalize(libName)})
          );
      ` + readFile(mainPath)
      );

      await checkApp(appName, { checkLint: false });
    }, 120000);

    it('should generate a Next.js app that compiles when using a workspace and react lib written in TypeScript', async () => {
      ensureProject();
      const appName = uniq('app');
      const tsLibName = uniq('tslib');
      const tsxLibName = uniq('tsxlib');

      runCLI(
        `generate @nrwl/next:app ${appName} --no-interactive --linter=eslint`
      );
      runCLI(`generate @nrwl/react:lib ${tsxLibName} --no-interactive`);
      runCLI(`generate @nrwl/workspace:lib ${tsLibName} --no-interactive`);

      updateFile(
        `libs/${tsLibName}/src/lib/${tsLibName}.ts`,
        `
        export function testFn(): string {
          return 'Hello Nx';
        };
        `
      );

      updateFile(
        `libs/${tsxLibName}/src/lib/${tsxLibName}.tsx`,
        `
        import React from 'react';

        interface TestComponentProps {
          text: string;
        }

        export const TestComponent = ({ text }: TestComponentProps) => {
          return <span>{text}</span>;
        };

        export default TestComponent;
        `
      );

      const mainPath = `apps/${appName}/pages/index.tsx`;
      const content = readFile(mainPath);

      updateFile(
        mainPath,
        `
        import { testFn } from '@proj/${tsLibName}';
        import { TestComponent } from '@proj/${tsxLibName}';\n\n
        ` +
          content.replace(
            `<main>`,
            `<main>
              <>
                {testFn()}
                <TestComponent text="Hello Next.JS" />
              </>
            `
          )
      );

      await checkApp(appName, { checkLint: true });
    }, 120000);
  });
});

async function checkApp(appName: string, opts: { checkLint: boolean }) {
  if (opts.checkLint) {
    const lintResults = runCLI(`lint ${appName}`);
    expect(lintResults).toContain('All files pass linting.');
  }

  const testResults = await runCLIAsync(`test ${appName}`);
  expect(testResults.stderr).toContain('Test Suites: 1 passed, 1 total');

  // const server = fork(
  //   `./node_modules/@nrwl/cli/bin/nx.js`,
  //   [`serve`, appName],
  //   {
  //     cwd: tmpProjPath(),
  //     silent: true
  //   }
  // );
  // expect(server).toBeTruthy();
  // await new Promise(resolve => {
  //   setTimeout(() => {
  //     getPage().then(page => {
  //       expect(page).toContain(`Here are some things you can do with Nx`);
  //       treeKill(server.pid, 'SIGTERM', err => {
  //         expect(err).toBeFalsy();
  //         resolve();
  //       });
  //     });
  //   }, 5000);
  // });
  // if (supportUi()) {
  //   const e2eResults = runCLI(`e2e ${appName}-e2e`);
  //   expect(e2eResults).toContain('All specs passed!');
  // }

  const buildResult = runCLI(`build ${appName}`);
  expect(buildResult).toContain(`Compiled successfully`);
  checkFilesExist(`dist/apps/${appName}/build-manifest.json`);

  const exportResult = runCLI(`export ${appName}`);
  checkFilesExist(`dist/apps/${appName}/exported/index.html`);
}

function getPage(): Promise<string> {
  return new Promise(resolve => {
    http.get('http://localhost:4200/', res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.once('end', () => {
        resolve(data);
      });
    });
  });
}

forEachCli('angular', () => {
  describe('next', () => {
    it('is not supported', () => {});
  });
});
