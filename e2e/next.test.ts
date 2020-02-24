import { stringUtils } from '@nrwl/workspace';
import {
  checkFilesExist,
  ensureProject,
  forEachCli,
  readFile,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile
} from './utils';

forEachCli('nx', () => {
  describe('Next.js Applications', () => {
    it('should be able to serve with a proxy configuration', async () => {
      ensureProject();
      const appName = uniq('app');

      runCLI(`generate @nrwl/next:app ${appName} --no-interactive`);

      const proxyConf = {
        '/external-api': {
          target: 'http://localhost:4200',
          pathRewrite: {
            '^/external-api/hello': '/api/hello'
          }
        }
      };
      updateFile(`apps/${appName}/proxy.conf.json`, JSON.stringify(proxyConf));

      updateFile(
        `apps/${appName}-e2e/src/integration/app.spec.ts`,
        `
        describe('next-app', () => {
          beforeEach(() => cy.visit('/'));
        
          it('should ', () => {
            cy.get('h1').contains('Hello Next.js!');
          });
        });
        `
      );

      updateFile(
        `apps/${appName}/pages/index.tsx`,
        `
        import React, { useEffect, useState } from 'react';

        export const Index = () => {
          const [greeting, setGreeting] = useState('');
        
          useEffect(() => {
            fetch('/external-api/hello')
              .then(r => r.text())
              .then(setGreeting);
          }, []);
        
          return <h1>{greeting}</h1>;
        };
        export default Index;        
      `
      );

      updateFile(
        `apps/${appName}/pages/api/hello.js`,
        `
        export default (_req, res) => {
          res.status(200).send('Hello Next.js!');
        };            
      `
      );

      const e2eResults = runCLI(`e2e ${appName}-e2e --headless`);
      expect(e2eResults).toContain('All specs passed!');
    }, 120000);

    it('should be able to consume a react lib', async () => {
      ensureProject();
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(`generate @nrwl/next:app ${appName} --no-interactive`);

      runCLI(`generate @nrwl/react:lib ${libName} --no-interactive`);

      const mainPath = `apps/${appName}/pages/index.tsx`;
      updateFile(mainPath, `import '@proj/${libName}';\n` + readFile(mainPath));
      updateFile(
        `apps/${appName}/next.config.js`,
        `
module.exports = {
  generateBuildId: function () {
    return 'fixed';
  }
};
      `
      );

      await checkApp(appName, { checkLint: true });

      // check that the configuration was consumed
      expect(readFile(`dist/apps/${appName}/BUILD_ID`)).toEqual('fixed');
    }, 120000);

    it('should be able to dynamically load a lib', async () => {
      ensureProject();
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(`generate @nrwl/next:app ${appName} --no-interactive`);
      runCLI(`generate @nrwl/react:lib ${libName} --no-interactive`);

      const mainPath = `apps/${appName}/pages/index.tsx`;
      updateFile(
        mainPath,
        `
        import dynamic from 'next/dynamic';
        const DynamicComponent = dynamic(
            () => import('@proj/${libName}').then(d => d.${stringUtils.capitalize(
          libName
        )})
          );
      ` + readFile(mainPath)
      );

      await checkApp(appName, { checkLint: false });
    }, 120000);

    it('should compile when using a workspace and react lib written in TypeScript', async () => {
      ensureProject();
      const appName = uniq('app');
      const tsLibName = uniq('tslib');
      const tsxLibName = uniq('tsxlib');

      runCLI(`generate @nrwl/next:app ${appName} --no-interactive`);
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

    it('should support --style=styled-components', async () => {
      const appName = uniq('app');

      runCLI(
        `generate @nrwl/next:app ${appName} --no-interactive --style=styled-components`
      );

      await checkApp(appName, { checkLint: false });
    }, 120000);

    it('should support --style=@emotion/styled', async () => {
      const appName = uniq('app');

      runCLI(
        `generate @nrwl/next:app ${appName} --no-interactive --style=@emotion/styled`
      );

      await checkApp(appName, { checkLint: false });
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

  const e2eResults = runCLI(`e2e ${appName}-e2e --headless`);
  expect(e2eResults).toContain('All specs passed!');

  const buildResult = runCLI(`build ${appName}`);
  expect(buildResult).toContain(`Compiled successfully`);
  checkFilesExist(`dist/apps/${appName}/build-manifest.json`);

  const exportResult = runCLI(`export ${appName}`);
  expect(exportResult).toContain('Exporting (3/3)');
  checkFilesExist(`dist/apps/${appName}/exported/index.html`);
}

forEachCli('angular', () => {
  describe('next', () => {
    it('is not supported', () => {});
  });
});
