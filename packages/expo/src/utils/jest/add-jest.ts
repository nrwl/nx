import { Tree, offsetFromRoot, generateFiles, ensurePackage } from '@nx/devkit';
import { join } from 'path';
import { updateTsConfigFiles } from '../update-tsconfig-files';
import { nxVersion } from '../versions';

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

  const { configurationGenerator } = ensurePackage<typeof import('@nx/jest')>(
    '@nx/jest',
    nxVersion
  );

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

  // Overwrite the jest.config.ts file because react native needs to have special transform property
  // use preset from https://github.com/expo/expo/blob/main/packages/jest-expo/jest-preset.js
  const configPath = `${appProjectRoot}/jest.config.${js ? 'js' : 'ts'}`;
  const content = `module.exports = {
  displayName: '${projectName}',
  resolver: require.resolve('./jest.resolver.js'),
  preset: 'jest-expo',
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.${js ? 'js' : 'ts'}'],
  moduleNameMapper: {
    '\\\\.svg$': '@nx/expo/plugins/jest/svg-mock'
  },
  transform: {
    '\\\\.[jt]sx?$': [
      'babel-jest',
      {
        configFile: __dirname + '/.babelrc.js',
      },
    ],
    '^.+\\\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp|ttf|otf|m4v|mov|mp4|mpeg|mpg|webm|aac|aiff|caf|m4a|mp3|wav|html|pdf|obj)$': require.resolve(
      'jest-expo/src/preset/assetFileTransformer.js'
    ),
  },
  coverageDirectory: '${offsetFromRoot(
    appProjectRoot
  )}coverage/${appProjectRoot}'
};`;
  host.write(configPath, content);

  // Generate only the Jest resolver file from template
  generateFiles(host, join(__dirname, 'files'), appProjectRoot, {
    projectName,
    coverageDirectory: `${offsetFromRoot(
      appProjectRoot
    )}coverage/${appProjectRoot}`,
    js,
  });

  // Update tsconfig files to handle jest.resolver.js properly
  updateTsConfigFiles(host, projectName, appProjectRoot);

  return jestTask;
}
