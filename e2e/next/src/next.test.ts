import { stringUtils } from '@nrwl/workspace';
import {
  checkFilesExist,
  newProject,
  readFile,
  readJson,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Next.js Applications', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  it('should be able to serve with a proxy configuration', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/next:app ${appName}`);

    const proxyConf = {
      '/external-api': {
        target: 'http://localhost:4200',
        pathRewrite: {
          '^/external-api/hello': '/api/hello',
        },
      },
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
  }, 120000);

  it('should be able to consume a react lib', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(`generate @nrwl/next:app ${appName} --no-interactive`);

    runCLI(`generate @nrwl/react:lib ${libName} --no-interactive --style=none`);

    const mainPath = `apps/${appName}/pages/index.tsx`;
    updateFile(
      mainPath,
      `import '@${proj}/${libName}';\n` + readFile(mainPath)
    );

    // Update lib to use css modules
    updateFile(
      `libs/${libName}/src/lib/${libName}.tsx`,
      `
        import React from 'react';
        import styles from './style.module.css';
        export function Test() {
          return <div className={styles.container}>Hello</div>;
        }
      `
    );
    updateFile(
      `libs/${libName}/src/lib/style.module.css`,
      `
        .container {}
      `
    );

    await checkApp(appName, {
      checkUnitTest: true,
      checkLint: true,
      checkE2E: false,
    });
  }, 120000);

  it('should be able to dynamically load a lib', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(`generate @nrwl/next:app ${appName} --no-interactive`);
    runCLI(`generate @nrwl/react:lib ${libName} --no-interactive --style=none`);

    const mainPath = `apps/${appName}/pages/index.tsx`;
    updateFile(
      mainPath,
      `
        import dynamic from 'next/dynamic';
        const DynamicComponent = dynamic(
            () => import('@${proj}/${libName}').then(d => d.${stringUtils.capitalize(
        libName
      )})
          );
      ` + readFile(mainPath)
    );

    await checkApp(appName, {
      checkUnitTest: false,
      checkLint: false,
      checkE2E: true,
    });
  }, 120000);

  it('should compile when using a workspace and react lib written in TypeScript', async () => {
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
        import { testFn } from '@${proj}/${tsLibName}';
        import { TestComponent } from '@${proj}/${tsxLibName}';\n\n
        ` +
        content.replace(
          `</h2>`,
          `</h2>
              <div>
                {testFn()}
                <TestComponent text="Hello Next.JS" />
              </div>
            `
        )
    );

    await checkApp(appName, {
      checkUnitTest: true,
      checkLint: true,
      checkE2E: false,
    });
  }, 120000);

  it('should support Less', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/next:app ${appName} --no-interactive --style=less`);

    await checkApp(appName, {
      checkUnitTest: true,
      checkLint: false,
      checkE2E: false,
    });
  }, 120000);

  it('should support Stylus', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/next:app ${appName} --no-interactive --style=styl`);

    await checkApp(appName, {
      checkUnitTest: true,
      checkLint: false,
      checkE2E: false,
    });
  }, 120000);

  it('should support --style=styled-components', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nrwl/next:app ${appName} --no-interactive --style=styled-components`
    );

    await checkApp(appName, {
      checkUnitTest: true,
      checkLint: false,
      checkE2E: false,
    });
  }, 120000);

  it('should support --style=@emotion/styled', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nrwl/next:app ${appName} --no-interactive --style=@emotion/styled`
    );

    await checkApp(appName, {
      checkUnitTest: true,
      checkLint: false,
      checkE2E: false,
    });
  }, 120000);

  it('should build with public folder', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nrwl/next:app ${appName} --no-interactive --style=@emotion/styled`
    );
    updateFile(`apps/${appName}/public/a/b.txt`, `Hello World!`);

    // Shared assets
    const sharedLib = uniq('sharedLib');
    updateFile('workspace.json', (c) => {
      const json = JSON.parse(c);
      json.projects[appName].targets.build.options.assets = [
        {
          glob: '**/*',
          input: `libs/${sharedLib}/src/assets`,
          output: 'shared/ui',
        },
      ];
      return JSON.stringify(json, null, 2);
    });
    updateFile(`libs/${sharedLib}/src/assets/hello.txt`, 'Hello World!');

    runCLI(`build ${appName}`);

    checkFilesExist(
      `dist/apps/${appName}/public/a/b.txt`,
      `dist/apps/${appName}/public/shared/ui/hello.txt`
    );
  }, 120000);

  it('should build with a next.config.js file in the dist folder', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/next:app ${appName} --no-interactive --style=css`);

    updateFile(
      `apps/${appName}/next.config.js`,
      `
    module.exports = {}
    `
    );

    runCLI(`build ${appName}`);

    checkFilesExist(`dist/apps/${appName}/next.config.js`);
  }, 120000);

  it('should support --js flag', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/next:app ${appName} --no-interactive --js`);

    checkFilesExist(`apps/${appName}/pages/index.js`);

    await checkApp(appName, {
      checkUnitTest: true,
      checkLint: true,
      checkE2E: true,
    });
  }, 180000);

  it('should fail the build when TS errors are present', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nrwl/next:app ${appName} --no-interactive --style=@emotion/styled`
    );

    updateFile(
      `apps/${appName}/pages/index.tsx`,
      `
        import React from 'react';

        export function Index() {
          let x = '';
          // below is an intentional TS error
          x = 3;
          return <div />;
        }

        export default Index;
        `
    );

    expect(() => runCLI(`build ${appName}`)).toThrowError(
      `Type error: Type 'number' is not assignable to type 'string'.`
    );
  }, 120000);

  it('should be able to consume a react lib writen in JavaScript', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(`generate @nrwl/next:app ${appName} --no-interactive`);

    runCLI(
      `generate @nrwl/react:lib ${libName} --no-interactive --style=none --js`
    );

    const mainPath = `apps/${appName}/pages/index.tsx`;
    updateFile(
      mainPath,
      `import '@${proj}/${libName}';\n` + readFile(mainPath)
    );

    // Update lib to use css modules
    updateFile(
      `libs/${libName}/src/lib/${libName}.js`,
      `
        import React from 'react';
        import styles from './style.module.css';
        export function Test() {
          return <div className={styles.container}>Hello</div>;
        }
      `
    );
    updateFile(
      `libs/${libName}/src/lib/style.module.css`,
      `
        .container {}
      `
    );

    await checkApp(appName, {
      checkUnitTest: true,
      checkLint: true,
      checkE2E: false,
    });
  }, 120000);
});

async function checkApp(
  appName: string,
  opts: { checkUnitTest: boolean; checkLint: boolean; checkE2E: boolean }
) {
  if (opts.checkLint) {
    const lintResults = runCLI(`lint ${appName}`);
    expect(lintResults).toContain('All files pass linting.');
  }

  if (opts.checkUnitTest) {
    const testResults = await runCLIAsync(`test ${appName}`);
    expect(testResults.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }

  if (opts.checkE2E) {
    const e2eResults = runCLI(`e2e ${appName}-e2e --headless`);
    expect(e2eResults).toContain('All specs passed!');
  }

  const buildResult = runCLI(`build ${appName}`);
  expect(buildResult).toContain(`Compiled successfully`);
  checkFilesExist(`dist/apps/${appName}/.next/build-manifest.json`);
  checkFilesExist(`dist/apps/${appName}/public/star.svg`);

  const packageJson = readJson(`dist/apps/${appName}/package.json`);
  expect(packageJson.dependencies.react).toBeDefined();
  expect(packageJson.dependencies['react-dom']).toBeDefined();
  expect(packageJson.dependencies.next).toBeDefined();

  runCLI(`export ${appName}`);
  checkFilesExist(`dist/apps/${appName}/exported/index.html`);
}
