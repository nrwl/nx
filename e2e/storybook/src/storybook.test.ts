import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  listFiles,
  newProject,
  readFile,
  runCLI,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { writeFileSync } from 'fs';
import { createFileSync } from 'fs-extra';

describe('Storybook generators and executors for monorepos', () => {
  const reactStorybookApp = uniq('react-app');
  let proj;
  beforeAll(async () => {
    proj = newProject({
      packages: ['@nx/react'],
    });
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

    it('should serve a React based Storybook setup that uses webpack', async () => {
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
      checkFilesExist(`${reactStorybookApp}/storybook-static/index.html`);
    }, 300_000);

    // This test makes sure path resolution works
    it('should build a React based storybook that references another lib and uses rollup', () => {
      runCLI(
        `generate @nx/react:lib my-lib --bundler=rollup --unitTestRunner=none --no-interactive`
      );

      // create a component in the first lib to reference the cmp from the 2nd lib
      createFileSync(
        tmpProjPath(`${reactStorybookApp}/src/app/test-button.tsx`)
      );
      writeFileSync(
        tmpProjPath(`${reactStorybookApp}/src/app/test-button.tsx`),
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
        tmpProjPath(`${reactStorybookApp}/src/app/test-button.stories.tsx`)
      );
      writeFileSync(
        tmpProjPath(`${reactStorybookApp}/src/app/test-button.stories.tsx`),
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
      checkFilesExist(`${reactStorybookApp}/storybook-static/index.html`);
    }, 300_000);

    it('should not bundle in sensitive NX_ environment variables', () => {
      updateFile(
        `${reactStorybookApp}/.storybook/main.ts`,
        (content) => `
      ${content}
      console.log(process.env);
      `
      );
      runCLI(`run ${reactStorybookApp}:build-storybook --verbose`, {
        env: {
          NX_SOME_SECRET: 'MY SECRET',
          NX_SOME_TOKEN: 'MY SECRET',
        },
      });

      // Check all output chunks for bundled environment variables
      const outDir = `${reactStorybookApp}/storybook-static`;
      const files = listFiles(outDir);
      for (const file of files) {
        if (!file.endsWith('.js')) continue;
        const content = readFile(`${outDir}/${file}`);
        expect(content).not.toMatch(/NX_SOME_SECRET/);
        expect(content).not.toMatch(/NX_SOME_TOKEN/);
        expect(content).not.toMatch(/MY SECRET/);
      }
    }, 300_000);
  });
});
