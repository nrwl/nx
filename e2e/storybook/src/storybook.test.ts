import {
  checkFilesExist,
  killPorts,
  newProject,
  runCLI,
  runCommandUntil,
  tmpProjPath,
  uniq,
} from '@nrwl/e2e/utils';
import { writeFileSync } from 'fs';

describe('Storybook schematics', () => {
  let proj: string;
  beforeAll(() => {
    proj = newProject();
  });

  describe('serve storybook', () => {
    afterEach(() => killPorts());

    it('should run a React based Storybook setup', async () => {
      const reactStorybookLib = uniq('test-ui-lib-react');
      runCLI(`generate @nrwl/react:lib ${reactStorybookLib} --no-interactive`);
      runCLI(
        `generate @nrwl/react:storybook-configuration ${reactStorybookLib} --generateStories --no-interactive`
      );

      // serve the storybook
      const p = await runCommandUntil(
        `run ${reactStorybookLib}:storybook`,
        (output) => {
          return /Storybook.*started/gi.test(output);
        }
      );
      p.kill();
    }, 1000000);
  });

  describe('build storybook', () => {
    it('should build a React based storybook', () => {
      const reactStorybookLib = uniq('test-ui-lib-react');
      runCLI(`generate @nrwl/react:lib ${reactStorybookLib} --no-interactive`);
      runCLI(
        `generate @nrwl/react:storybook-configuration ${reactStorybookLib} --generateStories --no-interactive`
      );

      // build React lib
      runCLI(`run ${reactStorybookLib}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${reactStorybookLib}/index.html`);
    }, 1000000);

    it('should lint a React based storybook without errors', () => {
      const reactStorybookLib = uniq('test-ui-lib-react');
      runCLI(`generate @nrwl/react:lib ${reactStorybookLib} --no-interactive`);
      runCLI(
        `generate @nrwl/react:storybook-configuration ${reactStorybookLib} --generateStories --no-interactive`
      );

      // build React lib
      const output = runCLI(`run ${reactStorybookLib}:lint`);
      expect(output).toContain('All files pass linting.');
    }, 1000000);

    it('should build a React based storybook that references another lib', () => {
      const reactStorybookLib = uniq('test-ui-lib-react');
      runCLI(`generate @nrwl/react:lib ${reactStorybookLib} --no-interactive`);
      runCLI(
        `generate @nrwl/react:storybook-configuration ${reactStorybookLib} --generateStories --no-interactive`
      );

      const anotherReactLib = uniq('test-another-lib-react');
      runCLI(`generate @nrwl/react:lib ${anotherReactLib} --no-interactive`);
      // create a React component we can reference
      writeFileSync(
        tmpProjPath(`libs/${anotherReactLib}/src/lib/mytestcmp.tsx`),
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
        tmpProjPath(`libs/${anotherReactLib}/src/index.ts`),
        `
            export * from './lib/mytestcmp';
        `
      );

      // create a story in the first lib to reference the cmp from the 2nd lib
      writeFileSync(
        tmpProjPath(
          `libs/${reactStorybookLib}/src/lib/myteststory.stories.tsx`
        ),
        `
            import React from 'react';

            import { MyTestCmp, MyTestCmpProps } from '@${proj}/${anotherReactLib}';

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
      runCLI(`run ${reactStorybookLib}:build-storybook`);
      checkFilesExist(`dist/storybook/${reactStorybookLib}/index.html`);
    }, 1000000);
  });
});
