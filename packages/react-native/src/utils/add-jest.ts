import { Tree } from '@nx/devkit';
import { jestProjectGenerator } from '@nx/jest';

export async function addJest(
  host: Tree,
  unitTestRunner: 'jest' | 'none',
  projectName: string,
  appProjectRoot: string,
  js: boolean,
  skipPackageJson: boolean
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
    skipPackageJson,
    skipFormat: true,
  });

  // overwrite the jest.config.ts file because react native needs to have special transform property
  const configPath = `${appProjectRoot}/jest.config.${js ? 'js' : 'ts'}`;
  const content = `module.exports = {
  displayName: '${projectName}',
  preset: 'react-native',
  resolver: '@nx/jest/plugins/resolver',
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/test-setup.${js ? 'js' : 'ts'}'],
  moduleNameMapper: {
    '\\\\.svg$': '@nx/react-native/plugins/jest/svg-mock'
  }
};`;
  host.write(configPath, content);

  return jestTask;
}
