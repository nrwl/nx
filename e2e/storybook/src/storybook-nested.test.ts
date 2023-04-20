import {
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  killPorts,
  readJson,
  runCLI,
  runCommandUntil,
  runCreateWorkspace,
  tmpProjPath,
  uniq,
} from '@nx/e2e/utils';
import { writeFileSync } from 'fs';
import { createFileSync } from 'fs-extra';

describe('Storybook generators and executors for standalone workspaces - using React + Vite', () => {
  const wsName = uniq('react');
  const appName = uniq('app');

  beforeAll(() => {
    // create a workspace with a single react app at the root
    runCreateWorkspace(wsName, {
      preset: 'react-standalone',
      appName,
      style: 'css',
      bundler: 'vite',
      packageManager: getSelectedPackageManager(),
    });

    runCLI(
      `generate @nx/react:storybook-configuration ${appName} --generateStories --no-interactive`
    );

    runCLI(`report`);
  });

  afterAll(() => {
    cleanupProject();
  });

  describe('Storybook generated files', () => {
    it('should generate storybook files', () => {
      checkFilesExist(
        '.storybook/main.js',
        '.storybook/preview.js',
        '.storybook/tsconfig.json'
      );
    });

    it('should edit root tsconfig.json', () => {
      const tsconfig = readJson(`tsconfig.json`);
      expect(tsconfig['ts-node']?.compilerOptions?.module).toEqual('commonjs');
    });
  });

  describe('serve storybook', () => {
    afterEach(() => killPorts());

    it('should serve a React based Storybook setup that uses Vite', async () => {
      const p = await runCommandUntil(`run ${appName}:storybook`, (output) => {
        return /Storybook.*started/gi.test(output);
      });
      p.kill();
    }, 60000);
  });

  describe('build storybook', () => {
    it('should build a React based storybook that uses Vite', () => {
      runCLI(`run ${appName}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${appName}/index.html`);
    }, 60000);

    // This needs fixing on the Storybook side
    // vite paths resolution is not working on standalone
    xit('should build a React based storybook that references another lib and uses Vite', () => {
      const anotherReactLib = uniq('test-another-lib-react');
      runCLI(`generate @nx/react:lib ${anotherReactLib} --no-interactive`);
      // create a React component we can reference
      createFileSync(tmpProjPath(`${anotherReactLib}/src/lib/mytestcmp.tsx`));
      writeFileSync(
        tmpProjPath(`${anotherReactLib}/src/lib/mytestcmp.tsx`),
        `
        export function MyTestCmp() {
          return (
            <div>
              <h1>Welcome to OtherLib!</h1>
            </div>
          );
        }
        
        export default MyTestCmp;
        `
      );
      // update index.ts and export it
      writeFileSync(
        tmpProjPath(`${anotherReactLib}/src/index.ts`),
        `
            export * from './lib/mytestcmp';
        `
      );

      // create a component and a story in the first lib to reference the cmp from the 2nd lib
      createFileSync(tmpProjPath(`src/app/test-button.tsx`));
      writeFileSync(
        tmpProjPath(`src/app/test-button.tsx`),
        `
          import { MyTestCmp } from '@${wsName}/${anotherReactLib}';

          export function TestButton() {
            return (
              <div>
                <MyTestCmp />
              </div>
            );
          }

          export default TestButton;
        `
      );

      // create a story in the first lib to reference the cmp from the 2nd lib
      createFileSync(tmpProjPath(`src/app/test-button.stories.tsx`));
      writeFileSync(
        tmpProjPath(`src/app/test-button.stories.tsx`),
        `
        import type { Meta } from '@storybook/react';
        import { TestButton } from './test-button';
        
        const Story: Meta<typeof TestButton> = {
          component: TestButton,
          title: 'TestButton',
        };
        export default Story;
        
        export const Primary = {
          args: {},
        };
              `
      );

      // build React lib
      runCLI(`run ${appName}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${appName}/index.html`);
    }, 60000);
  });
});
