import { readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import updateUnitTestRunnerOption from './update-unit-test-runner-option';

describe('update-unit-test-runner-option migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update vitest to vitest-analog in flat generator key format', async () => {
    updateNxJson(tree, {
      generators: {
        '@nx/angular:application': {
          unitTestRunner: 'vitest',
        },
      },
    });

    await updateUnitTestRunnerOption(tree);

    const nxJson = readNxJson(tree);
    expect(nxJson.generators['@nx/angular:application']).toEqual({
      unitTestRunner: 'vitest-analog',
    });
  });

  it('should update vitest to vitest-analog in nested generator format', async () => {
    updateNxJson(tree, {
      generators: {
        '@nx/angular': {
          application: {
            unitTestRunner: 'vitest',
          },
        },
      },
    });

    await updateUnitTestRunnerOption(tree);

    const nxJson = readNxJson(tree);
    expect(nxJson.generators['@nx/angular']['application']).toEqual({
      unitTestRunner: 'vitest-analog',
    });
  });

  it('should update multiple generators', async () => {
    updateNxJson(tree, {
      generators: {
        '@nx/angular:application': {
          unitTestRunner: 'vitest',
        },
        '@nx/angular:library': {
          unitTestRunner: 'vitest',
        },
        '@nx/angular:host': {
          unitTestRunner: 'vitest',
        },
      },
    });

    await updateUnitTestRunnerOption(tree);

    const nxJson = readNxJson(tree);
    expect(nxJson.generators['@nx/angular:application'].unitTestRunner).toBe(
      'vitest-analog'
    );
    expect(nxJson.generators['@nx/angular:library'].unitTestRunner).toBe(
      'vitest-analog'
    );
    expect(nxJson.generators['@nx/angular:host'].unitTestRunner).toBe(
      'vitest-analog'
    );
  });

  it('should not update jest or none values', async () => {
    updateNxJson(tree, {
      generators: {
        '@nx/angular:application': {
          unitTestRunner: 'jest',
        },
        '@nx/angular:library': {
          unitTestRunner: 'none',
        },
      },
    });

    await updateUnitTestRunnerOption(tree);

    const nxJson = readNxJson(tree);
    expect(nxJson.generators['@nx/angular:application'].unitTestRunner).toBe(
      'jest'
    );
    expect(nxJson.generators['@nx/angular:library'].unitTestRunner).toBe(
      'none'
    );
  });

  it('should handle missing generators section', async () => {
    updateNxJson(tree, {});

    await expect(updateUnitTestRunnerOption(tree)).resolves.not.toThrow();
  });

  it('should preserve other generator options', async () => {
    updateNxJson(tree, {
      generators: {
        '@nx/angular:application': {
          unitTestRunner: 'vitest',
          style: 'scss',
          routing: true,
        },
      },
    });

    await updateUnitTestRunnerOption(tree);

    const nxJson = readNxJson(tree);
    expect(nxJson.generators['@nx/angular:application']).toEqual({
      unitTestRunner: 'vitest-analog',
      style: 'scss',
      routing: true,
    });
  });
});
