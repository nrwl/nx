import {
  exampleE2eProjectTslintJson,
  exampleAngularProjectTslintJson,
  exampleRootTslintJson,
  exampleNonAngularProjectTslintJson,
} from './example-tslint-configs';
import { convertToESLintConfig } from './convert-to-eslint-config';

/**
 * The actual `findReportedConfiguration()` function is used to execute
 * `tslint --print-config` in a child process and read from the real
 * file system. This won't work for us in tests where we are dealing
 * with a Tree, so we mock out the responses from `findReportedConfiguration()`
 * with previously captured result data from that same command.
 */

export function mockFindReportedConfiguration(_, pathToTSLintJson) {
  if (
    pathToTSLintJson === 'tslint.json' ||
    pathToTSLintJson === '/tslint.json'
  ) {
    return exampleRootTslintJson.tslintPrintConfigResult;
  }

  if (
    pathToTSLintJson === 'apps/app1/tslint.json' ||
    pathToTSLintJson === 'libs/lib1/tslint.json'
  ) {
    return exampleAngularProjectTslintJson.tslintPrintConfigResult;
  }

  if (pathToTSLintJson === 'apps/app1-e2e/tslint.json') {
    return exampleE2eProjectTslintJson.tslintPrintConfigResult;
  }

  if (pathToTSLintJson === 'apps/app2/tslint.json') {
    return exampleNonAngularProjectTslintJson.tslintPrintConfigResult;
  }

  throw new Error(
    `${pathToTSLintJson} is not a part of the supported mock data for these tests`
  );
}

/**
 * See ./mock-tslint-to-eslint-config.ts for why this is needed
 */
jest.mock('tslint-to-eslint-config', () => {
  return {
    // Since upgrading to (ts-)jest 26 this usage of this mock has caused issues...
    // @ts-ignore
    ...jest.requireActual('tslint-to-eslint-config'),
    findReportedConfiguration: jest.fn(mockFindReportedConfiguration),
  };
});

describe('convertToESLintConfig()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should work for a root tslint.json file', async () => {
    const converted = await convertToESLintConfig(
      'tslint.json',
      exampleRootTslintJson.raw,
      []
    );
    // Ensure no-console snapshot is deterministic
    converted.convertedESLintConfig.rules['no-console'][1].allow.sort();
    expect(converted).toMatchSnapshot();
  });

  it('should work for a project tslint.json file', async () => {
    await expect(
      convertToESLintConfig(
        'apps/app1/tslint.json',
        exampleAngularProjectTslintJson.raw,
        []
      )
    ).resolves.toMatchSnapshot();
  });

  it('should work for an e2e project tslint.json file', async () => {
    await expect(
      convertToESLintConfig(
        'apps/app1-e2e/tslint.json',
        exampleE2eProjectTslintJson.raw,
        []
      )
    ).resolves.toMatchSnapshot();
  });

  it('should work for a non-Angular project tslint.json file', async () => {
    await expect(
      convertToESLintConfig(
        'apps/app2/tslint.json',
        exampleNonAngularProjectTslintJson.raw,
        []
      )
    ).resolves.toMatchSnapshot();
  });
});
