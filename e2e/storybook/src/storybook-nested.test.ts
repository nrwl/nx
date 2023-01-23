import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  newProject,
  runCLI,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateJson,
  getPackageManagerCommand,
  runCommand,
  runCreateWorkspace,
  getSelectedPackageManager,
  updateFile,
  readJson,
} from '@nrwl/e2e/utils';
import { writeFileSync } from 'fs';

describe('Storybook generators and executors for nested workspaces', () => {
  const previousPM = process.env.SELECTED_PM;
  const wsName = uniq('react');
  const appName = uniq('app');
  const packageManager = getSelectedPackageManager() || 'yarn';

  beforeAll(() => {
    process.env.SELECTED_PM = 'yarn';

    // create a workspace with a single react app at the root
    runCreateWorkspace(wsName, {
      preset: 'react-experimental',
      appName,
      style: 'css',
      packageManager,
    });

    runCLI(
      `generate @nrwl/react:storybook-configuration ${appName} --generateStories --no-interactive`
    );

    // TODO(jack): Overriding enhanced-resolve to 5.10.0 now until the package is fixed.
    // See: https://github.com/webpack/enhanced-resolve/issues/362
    updateJson('package.json', (json) => {
      json['overrides'] = {
        'enhanced-resolve': '5.10.0',
      };

      return json;
    });

    // TODO(katerina): Once Storybook vite generators are fixed, remove this.
    updateJson('package.json', (json) => {
      json['devDependencies'] = {
        ...json['devDependencies'],
        '@storybook/builder-vite': '0.2.5',
      };
      return json;
    });

    runCommand(getPackageManagerCommand().install);

    // TODO(katerina): Once Storybook vite generators are fixed, remove this.
    updateFile(
      './storybook/main.js',
      `const rootMain = require(‘./main.root’);
    module.exports = {
      …rootMain,
      core: { …rootMain.core, builder: ‘@storybook/builder-vite’ },
      stories: [
        …rootMain.stories,
        ‘../src/app/**/*.stories.mdx’,
        ‘../src/app/**/*.stories.@(js|jsx|ts|tsx)’,
      ],
      addons: […rootMain.addons, ‘@nrwl/react/plugins/storybook’],
      webpackFinal: async (config, { configType }) => {
        if (rootMain.webpackFinal) {
          config = await rootMain.webpackFinal(config, { configType });
        }
        return config;
      },
    };`
    );
  });

  afterAll(() => {
    cleanupProject();
    process.env.SELECTED_PM = previousPM;
  });

  describe('Storybook generated files', () => {
    it('should generate storybook files', () => {
      checkFilesExist(
        '.storybook/main.js',
        '.storybook/main.root.js',
        '.storybook/preview.js',
        '.storybook/tsconfig.json'
      );
    });

    it('should edit root tsconfig.json', () => {
      const tsconfig = readJson(`tsconfig.base.json`);
      expect(tsconfig['ts-node']?.compilerOptions?.module).toEqual('commonjs');
    });

    it('should generate correct files for nested app', () => {
      const nestedAppName = uniq('other-app');
      runCLI(`generate @nrwl/react:app ${nestedAppName} --no-interactive`);
      runCLI(
        `generate @nrwl/react:storybook-configuration ${nestedAppName} --generateStories --no-interactive`
      );
      checkFilesExist(
        `${nestedAppName}/.storybook/main.js`,
        `${nestedAppName}/.storybook/tsconfig.json`
      );
    });
  });

  describe('serve storybook', () => {
    afterEach(() => killPorts());

    it('should run a React based Storybook setup', async () => {
      // serve the storybook
      const p = await runCommandUntil(`run ${appName}:storybook`, (output) => {
        return /Storybook.*started/gi.test(output);
      });
      p.kill();
    }, 1000000);
  });

  describe('build storybook', () => {
    it('should build and lint a React based storybook', () => {
      // build
      runCLI(`run ${appName}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${appName}/index.html`);

      // lint
      const output = runCLI(`run ${appName}:lint`);
      expect(output).toContain('All files pass linting.');
    }, 1000000);

    it('should build a React based storybook that references another lib', () => {
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
    }, 1000000);
  });
});
