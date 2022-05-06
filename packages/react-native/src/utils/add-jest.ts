import { addDependenciesToPackageJson, Tree } from '@nrwl/devkit';
import { jestProjectGenerator } from '@nrwl/jest';
import { jestVersion } from '@nrwl/jest/src/utils/versions';

export async function addJest(
  host: Tree,
  unitTestRunner: 'jest' | 'none',
  projectName: string,
  appProjectRoot: string,
  js: boolean
) {
  if (unitTestRunner !== 'jest') {
    return () => {};
  }

  const jestTask = await jestProjectGenerator(host, {
    js,
    project: projectName,
    supportTsx: true,
    skipSerializers: true,
    setupFile: 'none',
    compiler: 'babel',
  });

  // overwrite the jest.config.ts file because react native needs to have special transform property
  const configPath = `${appProjectRoot}/jest.config.${js ? 'js' : 'ts'}`;
  const content = `module.exports = {
  displayName: '${projectName}',
  preset: 'react-native',
  testRunner: 'jest-jasmine2',
  resolver: '@nrwl/jest/plugins/resolver',
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/test-setup.${js ? 'js' : 'ts'}'],
  moduleNameMapper: {
    '\\.svg': '@nrwl/react-native/plugins/jest/svg-mock'
  },
  transform: {
    '\\\\.(js|ts|tsx)$': require.resolve('react-native/jest/preprocessor.js'),
    '^.+\\\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': require.resolve(
      'react-native/jest/assetFileTransformer.js',
    ),
  }
};`;
  host.write(configPath, content);

  const installTask = addDependenciesToPackageJson(
    host,
    {},
    { 'jest-jasmine2': jestVersion }
  );

  return () => {
    jestTask();
    installTask();
  };
}
