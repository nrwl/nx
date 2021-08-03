import { NxJsonConfiguration, ProjectGraph } from '@nrwl/devkit';
import { getSharedNpmDeps, getSharedNxDeps } from './shared-mappings';

describe('SharedMappings', () => {
  const nxJson: NxJsonConfiguration = {
    implicitDependencies: {},
    npmScope: 'nrwl',
    projects: {},
  };

  const projectGraph: ProjectGraph = {
    dependencies: {
      host: [
        {
          type: 'static',
          target: 'lib1',
          source: 'host',
        },
        {
          type: 'static',
          target: 'npm:@angular/core',
          source: 'host',
        },
      ],
      remote1: [
        {
          type: 'static',
          target: 'lib1',
          source: 'remote1',
        },

        {
          type: 'static',
          target: 'npm:@angular/core',
          source: 'remote1',
        },
      ],
      lib1: [],
    },
    nodes: {
      host: {
        type: 'app',
        name: 'host',
        data: {
          root: 'apps/host',
          files: [],
        },
      },
      remote1: {
        type: 'app',
        name: 'remote1',
        data: {
          root: 'apps/remote1',
          files: [],
        },
      },
      lib1: {
        type: 'lib',
        name: 'lib1',
        data: {
          root: 'packages/lib1',
          files: [],
        },
      },
    },
  };

  it('should form the shared mappings for nx deps', () => {
    expect(getSharedNxDeps(nxJson, projectGraph, 'host', ['remote1'])).toEqual([
      '@nrwl/lib1',
    ]);
  });

  it('should form the shared mappings for npm deps', () => {
    expect(getSharedNpmDeps(nxJson, projectGraph, 'host', ['remote1'])).toEqual(
      ['@angular/core']
    );
  });
});
