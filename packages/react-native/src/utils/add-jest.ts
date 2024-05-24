import { Tree, offsetFromRoot } from '@nx/devkit';
import { configurationGenerator } from '@nx/jest';

export async function addJest(
  host: Tree,
  unitTestRunner: 'jest' | 'none',
  projectName: string,
  appProjectRoot: string,
  js: boolean,
  skipPackageJson: boolean,
  addPlugin: boolean
) {
  if (unitTestRunner !== 'jest') {
    return () => {};
  }

  const jestTask = await configurationGenerator(host, {
    js,
    project: projectName,
    supportTsx: true,
    skipSerializers: true,
    setupFile: 'react-native',
    compiler: 'babel',
    skipPackageJson,
    skipFormat: true,
    addPlugin,
  });

  // overwrite the jest.config.ts file because react native needs to have special transform property
  const configPath = `${appProjectRoot}/jest.config.${js ? 'js' : 'ts'}`;
  const content = `module.exports = {
  displayName: '${projectName}',
  preset: 'react-native',
  resolver: '@nx/jest/plugins/resolver',
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.${js ? 'js' : 'ts'}'],
  moduleNameMapper: {
    '\\\\.svg$': '@nx/react-native/plugins/jest/svg-mock'
  },
  transform: {
    '^.+\\.(js|ts|tsx)$': [
      'babel-jest',
      {
        configFile: __dirname + '/.babelrc.js',
      },
    ],
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': require.resolve(
      'react-native/jest/assetFileTransformer.js'
    ),
  },
  coverageDirectory: '${offsetFromRoot(
    appProjectRoot
  )}coverage/${appProjectRoot}'
};`;
  host.write(configPath, content);

  return jestTask;
}
