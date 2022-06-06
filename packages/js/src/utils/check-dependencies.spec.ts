import { calculateProjectDependencies } from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { checkDependencies } from './check-dependencies';

jest.mock('@nrwl/workspace/src/utilities/buildable-libs-utils');

describe('checkDependencies', () => {
  test('collects shallow dependencies', () => {
    const mockedCalculateProjectDependencies = jest.mocked(
      calculateProjectDependencies
    );
    mockedCalculateProjectDependencies.mockReturnValueOnce({
      target: {
        name: 'example',
        type: 'lib',
        data: {},
      },
      dependencies: [],
      nonBuildableDependencies: [],
      topLevelDependencies: [],
    });

    checkDependencies(
      {
        root: 'root',
        projectName: 'example',
        targetName: 'build',
        cwd: '?',
        workspace: null,
        isVerbose: false,
      },
      'pathToTsConfig.json'
    );

    expect(calculateProjectDependencies).toBeCalledWith(
      expect.anything(),
      'root',
      'example',
      'build',
      undefined,
      true
    );
  });
});
