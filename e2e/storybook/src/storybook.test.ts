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

// TODO: re-enable once the issue is fixed with long build times
describe.skip('Storybook generators and executors for monorepos', () => {
  const reactStorybookLib = uniq('test-ui-lib-react');
  let proj;
  beforeAll(() => {
    proj = newProject();
    runCLI(`generate @nx/react:lib ${reactStorybookLib} --no-interactive`);
    runCLI(
      `generate @nx/react:storybook-configuration ${reactStorybookLib} --generateStories --no-interactive --bundler=webpack`
    );
  });

  afterAll(() => {
    cleanupProject();
  });

  describe('serve and build storybook', () => {
    afterEach(() => killPorts());

    it('should serve a React based Storybook setup that uses webpack', async () => {
      // serve the storybook
      const p = await runCommandUntil(
        `run ${reactStorybookLib}:storybook`,
        (output) => {
          return /Storybook.*started/gi.test(output);
        }
      );
      p.kill();
    }, 60000);

    it('should build a React based storybook setup that uses webpack', () => {
      // build
      runCLI(`run ${reactStorybookLib}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${reactStorybookLib}/index.html`);
    }, 60000);

    // This test makes sure path resolution works
    it('should build a React based storybook that references another lib and uses webpack', () => {
      const anotherReactLib = uniq('test-another-lib-react');
      runCLI(`generate @nx/react:lib ${anotherReactLib} --no-interactive`);
      // create a React component we can reference
      writeFileSync(
        tmpProjPath(`libs/${anotherReactLib}/src/lib/mytestcmp.tsx`),
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
            import type { Meta } from '@storybook/react';
            import { MyTestCmp } from '@${proj}/${anotherReactLib}';

            const Story: Meta<typeof MyTestCmp> = {
              component: MyTestCmp,
              title: 'MyTestCmp',
            };
            export default Story;

            export const Primary = {
              args: {},
            };

        `
      );

      // build React lib
      runCLI(`run ${reactStorybookLib}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${reactStorybookLib}/index.html`);
    }, 60000);
  });
});
