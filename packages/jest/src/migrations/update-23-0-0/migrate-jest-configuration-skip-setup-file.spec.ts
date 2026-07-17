import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  type NxJsonConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migrate-jest-configuration-skip-setup-file';

describe('migrate-jest-configuration-skip-setup-file', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it("should rewrite `skipSetupFile: true` to `setupFile: 'none'` in nx.json (flat form)", async () => {
    const nxJson = readNxJson(tree) ?? ({} as NxJsonConfiguration);
    nxJson.generators = {
      '@nx/jest:configuration': {
        skipSetupFile: true,
      },
    };
    updateNxJson(tree, nxJson);

    await migration(tree);

    expect(readNxJson(tree)?.generators?.['@nx/jest:configuration']).toEqual({
      setupFile: 'none',
    });
  });

  it('should drop `skipSetupFile: false` without adding setupFile in nx.json (flat form)', async () => {
    const nxJson = readNxJson(tree) ?? ({} as NxJsonConfiguration);
    nxJson.generators = {
      '@nx/jest:configuration': {
        skipSetupFile: false,
        testEnvironment: 'jsdom',
      },
    };
    updateNxJson(tree, nxJson);

    await migration(tree);

    expect(readNxJson(tree)?.generators?.['@nx/jest:configuration']).toEqual({
      testEnvironment: 'jsdom',
    });
  });

  it('should not clobber an existing setupFile value when skipSetupFile is true', async () => {
    const nxJson = readNxJson(tree) ?? ({} as NxJsonConfiguration);
    nxJson.generators = {
      '@nx/jest:configuration': {
        skipSetupFile: true,
        setupFile: 'angular',
      },
    };
    updateNxJson(tree, nxJson);

    await migration(tree);

    expect(readNxJson(tree)?.generators?.['@nx/jest:configuration']).toEqual({
      setupFile: 'angular',
    });
  });

  it('should rewrite the nested form (`@nx/jest` -> `configuration`) in nx.json', async () => {
    const nxJson = readNxJson(tree) ?? ({} as NxJsonConfiguration);
    nxJson.generators = {
      '@nx/jest': {
        configuration: {
          skipSetupFile: true,
        },
      },
    };
    updateNxJson(tree, nxJson);

    await migration(tree);

    expect(readNxJson(tree)?.generators?.['@nx/jest']).toEqual({
      configuration: { setupFile: 'none' },
    });
  });

  it('should remove an empty generator entry after stripping the option', async () => {
    const nxJson = readNxJson(tree) ?? ({} as NxJsonConfiguration);
    nxJson.generators = {
      '@nx/jest:configuration': {
        skipSetupFile: false,
      },
    };
    updateNxJson(tree, nxJson);

    await migration(tree);

    expect(
      readNxJson(tree)?.generators?.['@nx/jest:configuration']
    ).toBeUndefined();
  });

  it('should rewrite generator defaults stored on a project', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      generators: {
        '@nx/jest:configuration': {
          skipSetupFile: true,
        },
      },
    });

    await migration(tree);

    const updated = readProjectConfiguration(tree, 'app1');
    expect(updated.generators?.['@nx/jest:configuration']).toEqual({
      setupFile: 'none',
    });
  });

  it('should leave unrelated generator defaults untouched', async () => {
    const nxJson = readNxJson(tree) ?? ({} as NxJsonConfiguration);
    nxJson.generators = {
      '@nx/react:application': {
        skipSetupFile: true,
      },
      '@nx/jest:configuration': {
        testEnvironment: 'node',
      },
    };
    updateNxJson(tree, nxJson);

    await migration(tree);

    const generators = readNxJson(tree)?.generators ?? {};
    expect(generators['@nx/react:application']).toEqual({
      skipSetupFile: true,
    });
    expect(generators['@nx/jest:configuration']).toEqual({
      testEnvironment: 'node',
    });
  });
});
