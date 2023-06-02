import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  newProject,
  runCLI,
  runCommandUntil,
  tmpProjPath,
  uniq,
} from '@nx/e2e/utils';
import { writeFileSync } from 'fs';
import { createFileSync } from 'fs-extra';

describe('Storybook generators and executors for monorepos', () => {
  const reactStorybookApp = uniq('react-app');
  let proj;
  beforeAll(() => {
    proj = newProject();
    runCLI(
      `generate @nx/react:app ${reactStorybookApp} --bundler=webpack --no-interactive`
    );
    runCLI(
      `generate @nx/react:storybook-configuration ${reactStorybookApp} --generateStories --no-interactive --bundler=webpack`
    );
  });

  afterAll(() => {
    cleanupProject();
  });

  // TODO: enable this when Storybook webpack server becomes a bit faster
  xdescribe('serve storybook', () => {
    afterEach(() => killPorts());

    it('should serve a React based Storybook setup that uses Vite', async () => {
      const p = await runCommandUntil(
        `run ${reactStorybookApp}:storybook`,
        (output) => {
          return /Storybook.*started/gi.test(output);
        }
      );
      p.kill();
    }, 600_000);
  });

  describe('build storybook', () => {
    it('should build a React based storybook setup that uses webpack', () => {
      // build
      runCLI(`run ${reactStorybookApp}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${reactStorybookApp}/index.html`);
    }, 300_000);

    // This test makes sure path resolution works
    it('should build a React based storybook that references another lib and uses rollup', () => {
      runCLI(
        `generate @nx/react:lib my-lib --bundler=rollup --unitTestRunner=none --no-interactive`
      );

      // create a component in the first lib to reference the cmp from the 2nd lib
      createFileSync(
        tmpProjPath(`apps/${reactStorybookApp}/src/app/test-button.tsx`)
      );
      writeFileSync(
        tmpProjPath(`apps/${reactStorybookApp}/src/app/test-button.tsx`),
        `
          import { MyLib } from '@${proj}/my-lib';

          export function TestButton() {
            return (
              <div>
                <MyLib />
              </div>
            );
          }

          export default TestButton;
        `
      );

      // create a story in the first lib to reference the cmp from the 2nd lib
      createFileSync(
        tmpProjPath(`apps/${reactStorybookApp}/src/app/test-button.stories.tsx`)
      );
      writeFileSync(
        tmpProjPath(
          `apps/${reactStorybookApp}/src/app/test-button.stories.tsx`
        ),
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
      runCLI(`run ${reactStorybookApp}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${reactStorybookApp}/index.html`);
    }, 300_000);
  });
});
