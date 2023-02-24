import { Tree, updateJson } from '@nrwl/devkit';
import { jestProjectGenerator } from '@nrwl/jest';
import { join } from 'path';

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
    project: projectName,
    supportTsx: true,
    skipSerializers: true,
    setupFile: 'none',
    babelJest: true,
  });

  // overwrite the jest.config.ts file because react native needs to have special transform property
  const configPath = `${appProjectRoot}/jest.config.${js ? 'js' : 'ts'}`;
  const content = `module.exports = {
    displayName: '${projectName}',
    resolver: '@nrwl/jest/plugins/resolver',
    preset: 'react-native',
    transformIgnorePatterns: [
      'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
    ],
    moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
    setupFilesAfterEnv: ['<rootDir>/test-setup.${js ? 'js' : 'ts'}'],
    moduleNameMapper: {
      '\\\\.svg$': '@nrwl/expo/plugins/jest/svg-mock'
    }
  };`;
  host.write(configPath, content);

  await updateJson(
    host,
    join(appProjectRoot, 'tsconfig.spec.json'),
    (json: any) => {
      if (
        json.compilerOptions &&
        json.compilerOptions.types &&
        !json.compilerOptions.types.some(
          (type: string) => type === '@testing-library/jest-native'
        )
      ) {
        json.compilerOptions.types.push('@testing-library/jest-native');
      }
      return json;
    }
  );

  return jestTask;
}
