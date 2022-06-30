import {
  checkFilesExist,
  expectTestsPass,
  newProject,
  readJson,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import { join } from 'path';

describe('react native minor change', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  it('should test, create ios and android JS bundles', async () => {
    const appName = uniq('my-app');
    const libName = uniq('lib');
    const componentName = uniq('component');

    runCLI(
      `generate @nrwl/react-native:application ${appName} --install=false`
    );
    runCLI(`generate @nrwl/react-native:library ${libName}`);
    runCLI(
      `generate @nrwl/react-native:component ${componentName} --project=${libName} --export`
    );

    updateFile(`apps/${appName}/src/app/App.tsx`, (content) => {
      let updated = `// eslint-disable-next-line @typescript-eslint/no-unused-vars\nimport ${componentName} from '${proj}/${libName}';\n${content}`;
      return updated;
    });

    expectTestsPass(await runCLIAsync(`test ${appName}`));
    expectTestsPass(await runCLIAsync(`test ${libName}`));

    const appLintResults = await runCLIAsync(`lint ${appName}`);
    expect(appLintResults.combinedOutput).toContain('All files pass linting.');

    const libLintResults = await runCLIAsync(`lint ${libName}`);
    expect(libLintResults.combinedOutput).toContain('All files pass linting.');

    const iosBundleResult = await runCLIAsync(`bundle-ios ${appName}`);
    expect(iosBundleResult.combinedOutput).toContain(
      'Done writing bundle output'
    );
    expect(() =>
      checkFilesExist(`dist/apps/${appName}/ios/main.jsbundle`)
    ).not.toThrow();

    const androidBundleResult = await runCLIAsync(`bundle-android ${appName}`);
    expect(androidBundleResult.combinedOutput).toContain(
      'Done writing bundle output'
    );
    expect(() =>
      checkFilesExist(`dist/apps/${appName}/android/main.jsbundle`)
    ).not.toThrow();
  }, 1000000);

  it('should create storybook with application', async () => {
    const appName = uniq('my-app');
    runCLI(
      `generate @nrwl/react-native:application ${appName} --install=false`
    );
    runCLI(
      `generate @nrwl/react-native:storybook-configuration ${appName} --generateStories --no-interactive`
    );
    expect(() =>
      checkFilesExist(
        `.storybook/story-loader.js`,
        `apps/${appName}/src/storybook/storybook.ts`,
        `apps/${appName}/src/storybook/toggle-storybook.tsx`,
        `apps/${appName}/src/app/App.stories.tsx`
      )
    ).not.toThrow();

    await runCLIAsync(`storybook ${appName}`);
    const result = readJson(join('apps', appName, 'package.json'));
    expect(result).toMatchObject({
      dependencies: {
        '@storybook/addon-ondevice-actions': '*',
        '@storybook/addon-ondevice-backgrounds': '*',
        '@storybook/addon-ondevice-controls': '*',
        '@storybook/addon-ondevice-notes': '*',
      },
    });
  });

  it('sync npm dependencies for autolink', async () => {
    const appName = uniq('my-app');
    runCLI(
      `generate @nrwl/react-native:application ${appName} --install=false`
    );
    // Add npm package with native modules
    updateFile(join('package.json'), (content) => {
      const json = JSON.parse(content);
      json.dependencies['react-native-image-picker'] = '1.0.0';
      json.dependencies['react-native-gesture-handler'] = '1.0.0';
      json.dependencies['react-native-safe-area-contex'] = '1.0.0';
      return JSON.stringify(json, null, 2);
    });
    // Add import for Nx to pick up
    updateFile(join('apps', appName, 'src/app/App.tsx'), (content) => {
      return `import { launchImageLibrary } from 'react-native-image-picker';\n${content}`;
    });

    await runCLIAsync(
      `sync-deps ${appName} --include=react-native-gesture-handler,react-native-safe-area-context`
    );

    const result = readJson(join('apps', appName, 'package.json'));
    expect(result).toMatchObject({
      dependencies: {
        'react-native-image-picker': '*',
        'react-native-gesture-handler': '*',
        'react-native-safe-area-context': '*',
      },
    });
  });
});
