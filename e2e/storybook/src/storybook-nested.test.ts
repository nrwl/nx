import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  readJson,
  runCLI,
  runCommandUntil,
  runCreateWorkspace,
  tmpProjPath,
  uniq,
} from '@nrwl/e2e/utils';
import { writeFileSync } from 'fs';

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
    });

    runCLI(
      `generate @nrwl/react:storybook-configuration ${appName} --generateStories --no-interactive`
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

  // TODO: Use --storybook7Configuration and re-enable this test - or else it NEEDS NODE 16
  xdescribe('serve storybook', () => {
    afterEach(() => killPorts());

    it('should serve a React based Storybook setup that uses Vite', async () => {
      const p = await runCommandUntil(`run ${appName}:storybook`, (output) => {
        return /Storybook.*started/gi.test(output);
      });
      p.kill();
    }, 40000);
  });

  // TODO: Use --storybook7Configuration and re-enable this test - or else it NEEDS NODE 16
  xdescribe('build storybook', () => {
    it('should build a React based storybook that uses Vite', () => {
      runCLI(`run ${appName}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${appName}/index.html`);
    }, 40000);

    // This test makes sure path resolution works
    xit('should build a React based storybook that references another lib and uses Vite', () => {
      const reactLib = uniq('test-lib-react');
      runCLI(`generate @nrwl/react:lib ${reactLib} --no-interactive`);
      // create a React component we can reference
      writeFileSync(
        tmpProjPath(`${reactLib}/src/lib/mytestcmp.tsx`),
        `
            import React from 'react';

            /* eslint-disable-next-line */
            export interface MyTestCmpProps {}

            export const MyTestCmp = (props: MyTestCmpProps) => {
              return (
                <div>
                  <h1>Welcome to test cmp!</h1>
                </div>
              );
            };

            export default MyTestCmp;
        `
      );
      // update index.ts and export it
      writeFileSync(
        tmpProjPath(`${reactLib}/src/index.ts`),
        `
            export * from './lib/mytestcmp';
        `
      );

      // create a story in the first lib to reference the cmp from the 2nd lib
      writeFileSync(
        tmpProjPath(`${reactLib}/src/lib/myteststory.stories.tsx`),
        `
            import React from 'react';

            import { MyTestCmp, MyTestCmpProps } from '@${wsName}/${reactLib}';

            export default {
              component: MyTestCmp,
              title: 'MyTestCmp',
            };

            export const primary = () => {
              /* eslint-disable-next-line */
              const props: MyTestCmpProps = {};

              return <MyTestCmp />;
            };
        `
      );

      // build React lib
      runCLI(`run ${reactLib}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${reactLib}/index.html`);
    }, 40000);
  });
});
