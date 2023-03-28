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
      `generate @nrwl/react:storybook-configuration --storybook7betaConfiguration ${appName} --generateStories --no-interactive  --verbose`
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
    }, 200_000);
  });

  describe('build storybook', () => {
    it('should build a React based storybook that uses Vite', () => {
      runCLI(`run ${appName}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${appName}/index.html`);
    }, 200_000);

    // This test makes sure path resolution works
    it('should build a React based storybook that references another lib and uses Vite', () => {
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
        tmpProjPath(`src/lib/myteststory.stories.tsx`),
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
      runCLI(`run ${appName}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${appName}/index.html`);
    }, 40000);
  });
});
