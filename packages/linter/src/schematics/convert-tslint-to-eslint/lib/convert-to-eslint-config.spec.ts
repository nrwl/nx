import {
  exampleE2eProjectTslintJson,
  exampleAngularProjectTslintJson,
  exampleRootTslintJson,
  exampleNonAngularProjectTslintJson,
} from './example-tslint-configs';

// Since upgrading to (ts-)jest 26 this usage of this mock has caused issues...
// @ts-ignore
const {
  mockFindReportedConfiguration,
} = require('./mock-tslint-to-eslint-config');

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

const { convertToESLintConfig } = require('./convert-to-eslint-config');

describe('convertToESLintConfig()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should work for a root tslint.json file', async () => {
    const converted = await convertToESLintConfig(
      'tslint.json',
      exampleRootTslintJson.raw
    );
    // Ensure no-console snapshot is deterministic
    converted.convertedESLintConfig.rules['no-console'][1].allow.sort();
    expect(converted).toMatchSnapshot();
  });

  it('should work for a project tslint.json file', async () => {
    await expect(
      convertToESLintConfig(
        'apps/app1/tslint.json',
        exampleAngularProjectTslintJson.raw
      )
    ).resolves.toMatchSnapshot();
  });

  it('should work for an e2e project tslint.json file', async () => {
    await expect(
      convertToESLintConfig(
        'apps/app1-e2e/tslint.json',
        exampleE2eProjectTslintJson.raw
      )
    ).resolves.toMatchSnapshot();
  });

  it('should work for a non-Angular project tslint.json file', async () => {
    await expect(
      convertToESLintConfig(
        'apps/app2/tslint.json',
        exampleNonAngularProjectTslintJson.raw
      )
    ).resolves.toMatchSnapshot();
  });
});
