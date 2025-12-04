import { Tree, offsetFromRoot, generateFiles, ensurePackage } from '@nx/devkit';
import { join } from 'path';
import { updateTsConfigFiles } from '../update-tsconfig-files';
import { nxVersion } from '../versions';
import { isExpoV54 } from '../version-utils';

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

  // Check if using Expo v54 to determine Jest configuration approach
  const useExpoV54 = await isExpoV54(host);

  // Overwrite the jest.config.ts file because react native needs to have special transform property
  // use preset from https://github.com/expo/expo/blob/main/packages/jest-expo/jest-preset.js
  // Workaround issue where Jest is not picking tyope node nor jest types from tsconfig by using <reference>.
  const configPath = `${appProjectRoot}/jest.config.${js ? 'js' : 'cts'}`;

  // For Expo v54, we don't use the custom resolver - instead we mock ImportMetaRegistry in test-setup
  const resolverLine = useExpoV54
    ? ''
    : "resolver: require.resolve('./jest.resolver.js'),\n  ";

  const content = `/// <reference types="jest" />
/// <reference types="node" />
module.exports = {
  displayName: '${projectName}',
  ${resolverLine}preset: 'jest-expo',
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

  if (useExpoV54) {
    // For Expo v54, generate test-setup with ImportMetaRegistry mock and structuredClone polyfill
    const testSetupPath = `${appProjectRoot}/src/test-setup.${
      js ? 'js' : 'ts'
    }`;
    const testSetupContent = `jest.mock('expo/src/winter/ImportMetaRegistry', () => ({
  ImportMetaRegistry: {
    get url() {
      return null;
    },
  },
}));

if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (object) => JSON.parse(JSON.stringify(object));
}
`;
    host.write(testSetupPath, testSetupContent);
  } else {
    // For Expo v53, generate the Jest resolver file from template
    generateFiles(host, join(__dirname, 'files'), appProjectRoot, {
      projectName,
      coverageDirectory: `${offsetFromRoot(
        appProjectRoot
      )}coverage/${appProjectRoot}`,
      js,
    });

    // Update tsconfig files to handle jest.resolver.js properly (only for v53)
    updateTsConfigFiles(host, projectName, appProjectRoot);
  }

  return jestTask;
}
