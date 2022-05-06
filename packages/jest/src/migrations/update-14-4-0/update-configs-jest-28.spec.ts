import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { libraryGenerator as workspaceLib } from '@nrwl/workspace';
import {
  checkDeps,
  updateConfigsJest28,
  updateJestConfig,
} from './update-configs-jest-28';

const mockJestConfig = `
import { nxPreset } from '@nrwl/jest/preset'
const myGlobals = ['Math', 'Promise'];

export default {
  ...nxPreset,
  displayName: 'test-ng-app',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  extraGlobals: ['Math', 'Something'],
  extraGlobals: [],
  extraGlobals: myGlobals,
  timers: 'fake',
  timers: 'modern',
  timers: 'legacy',
  timers: 'real',
  testURL: 'http://localhost',
  testURL: "123abc",
  testURL: \`BLAH\`,
  testEnvironment: 'jsdom',
  testRunner: 'jest-jasmine2',
}
`;
describe('Jest Migration - jest 28 config support', () => {
  it('should update "extraGlobals" config option', () => {
    const actual = updateJestConfig(mockJestConfig);
    expect(actual).not.toContain(`extraGlobals`);
    expect(actual).toContain(`sandboxInjectedGlobals: ['Math', 'Something'],`);
    expect(actual).toContain(`sandboxInjectedGlobals: [],`);
    expect(actual).toContain(`sandboxInjectedGlobals: myGlobals,`);
  });

  it('should update "testURL" config option', () => {
    const actual = updateJestConfig(mockJestConfig);
    expect(actual).not.toContain(`testURL`);
    expect(actual).toContain(
      `testEnvironmentOptions: {url: 'http://localhost'},`
    );
    expect(actual).toContain(`testEnvironmentOptions: {url: "123abc"},`);
    expect(actual).toContain(`testEnvironmentOptions: {url: \`BLAH\`},`);
  });

  it('should update "timers" config option', () => {
    const actual = updateJestConfig(mockJestConfig);
    expect(actual).not.toContain(`timers`);
    expect(actual).toContain(`fakeTimers: { enableGlobally: false },`);
    expect(actual).toContain(`fakeTimers: { enableGlobally: true },`);
    expect(actual).toContain(`fakeTimers: { enableGlobally: true },`);
    expect(actual).toContain(
      `fakeTimers: { enableGlobally: true, legacyFakeTimers: true },`
    );
  });

  it('should update jest-environment-jsdom if being used', async () => {
    let tree = createTreeWithEmptyWorkspace(2);
    tree.write(
      `package.json`,
      `{
  "name": "jest-28-test",
  "version": "0.0.0",
  "license": "MIT",
  "devDependencies": {
    "jest": "^28.1.1",
    "jest-environment-jsdom": "^27.1.0",
    "jest-preset-angular": "^11.0.0",
    "nx": "14.1.6",
    "ts-jest": "^27.0.2",
    "ts-node": "9.1.1",
    "typescript": "~4.6.2"
  },
  "dependencies": {
  }
}
`
    );

    const actual = checkDeps(tree);
    expect(actual).toEqual({
      'jest-environment-jsdom': '28.1.1',
    });
  });

  it('should update jest-jasmine2 if being used as a test runner', () => {
    let tree = createTreeWithEmptyWorkspace(2);
    tree.write(
      `package.json`,
      `{
  "name": "jest-28-test",
  "version": "0.0.0",
  "license": "MIT",
  "devDependencies": {
    "jest": "^27.1.1",
    "jest-jasmine2": "^27.1.0",
    "nx": "14.1.6",
    "ts-jest": "^27.0.2",
    "ts-node": "9.1.1",
    "typescript": "~4.6.2"
  },
  "dependencies": {
  }
}
`
    );

    const actual = checkDeps(tree);
    expect(actual).toEqual({
      'jest-jasmine2': '28.1.1',
    });
  });

  it('should not install deps if they are not used', () => {
    let tree = createTreeWithEmptyWorkspace(2);
    tree.write(
      `package.json`,
      `{
  "name": "jest-28-test",
  "version": "0.0.0",
  "license": "MIT",
  "devDependencies": {
    "jest": "^27.1.0",
    "nx": "14.1.6",
    "ts-jest": "^27.0.2",
    "ts-node": "9.1.1",
    "typescript": "~4.6.2"
  },
  "dependencies": {
  }
}
`
    );

    const actual = checkDeps(tree);
    expect(actual).toEqual({});
  });

  it('should update deps from jest.config.ts', async () => {
    let tree = createTreeWithEmptyWorkspace(2);
    await workspaceLib(tree, { name: 'my-lib', unitTestRunner: 'jest' });
    tree.write(
      'libs/my-lib/jest.config.ts',
      `
export default {
  displayName: 'test-ng-app',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: '<rootDir>/tsconfig.spec.json',
      stringifyContentPathRegex: '\\\\.(html|svg)$',
    },
  },
  testEnvironment: 'jsdom',
  testRunner: 'jest-jasmine2',
  coverageDirectory: '../../coverage/apps/test-ng-app',
  transform: {
    '^.+\\\\.(ts|mjs|js|html)$': 'jest-preset-angular',
  },
  transformIgnorePatterns: [
    'node_modules/(?!.*\\\\.mjs$|rxjs)',
    // 'node_modules/(?!rxjs)'
  ],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
}`
    );
    updateConfigsJest28(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies).toEqual(
      expect.objectContaining({
        'jest-environment-jsdom': '28.1.1',
        'jest-jasmine2': '28.1.1',
      })
    );
  });
});
