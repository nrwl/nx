import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  runCLI,
  runCommandUntil,
  tmpProjPath,
  uniq,
  getPackageManagerCommand,
  runCommand,
  newProject,
  updateJson,
} from '@nrwl/e2e/utils';
import { writeFileSync } from 'fs';

describe('Storybook generators for non-angular projects', () => {
  const reactStorybookLib = uniq('test-ui-lib-react');
  let proj;
  beforeAll(() => {
    proj = newProject();
    runCLI(`generate @nrwl/react:lib ${reactStorybookLib} --no-interactive`);
    runCLI(
      `generate @nrwl/react:storybook-configuration ${reactStorybookLib} --generateStories --no-interactive`
    );

    // TODO(jack): Overriding enhanced-resolve to 5.10.0 now until the package is fixed.
    // TODO: Use --storybook7Configuration and remove this
    // See: https://github.com/webpack/enhanced-resolve/issues/362
    updateJson('package.json', (json) => {
      json['overrides'] = {
        'enhanced-resolve': '5.10.0',
      };

      return json;
    });
    runCommand(getPackageManagerCommand().install);

    console.log('Here is the Nx report: ');
    runCLI(`report`);
  });

  afterAll(() => {
    cleanupProject();
  });

  // TODO: Use --storybook7Configuration and re-enable this test
  xdescribe('serve storybook', () => {
    afterEach(() => killPorts());

    it('should run a React based Storybook setup', async () => {
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

  // TODO: Use --storybook7Configuration and re-enable this test
  xdescribe('build storybook', () => {
    it('should build and lint a React based storybook', () => {
      // build
      runCLI(`run ${reactStorybookLib}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${reactStorybookLib}/index.html`);

      // lint
      const output = runCLI(`run ${reactStorybookLib}:lint`);
      expect(output).toContain('All files pass linting.');
    }, 1000000);

    // I am not sure how much sense this test makes - Maybe it's just adding noise
    xit('should build a React based storybook that references another lib', () => {
      const anotherReactLib = uniq('test-another-lib-react');
      runCLI(`generate @nrwl/react:lib ${anotherReactLib} --no-interactive`);
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
    }, 1000000);
  });
});
