import {
  checkFilesExist,
  getSelectedPackageManager,
  newProject,
  readJson,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import { join } from 'path';

describe('react native', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  it('should test, create ios and android JS bundles', async () => {
    // currently react native does not support pnpm: https://github.com/pnpm/pnpm/issues/3321
    if (getSelectedPackageManager() === 'pnpm') return;

    const appName = uniq('my-app');
    const libName = uniq('lib');
    const componentName = uniq('component');

    runCLI(`generate @nrwl/react-native:application ${appName}`);
    runCLI(`generate @nrwl/react-native:library ${libName}`);
    runCLI(
      `generate @nrwl/react-native:component ${componentName} --project=${libName} --export`
    );

    updateFile(`apps/${appName}/src/app/App.tsx`, (content) => {
      let updated = `import ${componentName} from '${proj}/${libName}';\n${content}`;
      return updated;
    });

    const appTestResults = await runCLIAsync(`test ${appName}`);
    expect(appTestResults.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );

    const libTestResults = await runCLIAsync(`test ${libName}`);
    expect(libTestResults.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );

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
  });

  it('sync npm dependencies for autolink', async () => {
    // currently react native does not support pnpm: https://github.com/pnpm/pnpm/issues/3321
    if (getSelectedPackageManager() === 'pnpm') return;

    const appName = uniq('my-app');
    runCLI(`generate @nrwl/react-native:application ${appName}`);
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
